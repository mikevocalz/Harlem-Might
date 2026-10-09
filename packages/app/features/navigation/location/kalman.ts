import type { LocalPoint } from '../geo/localFrame.ts';

/**
 * A 2D constant-velocity Kalman filter in local east/north metres.
 *
 * State x = [east, north, vEast, vNorth]. Process noise is the discrete
 * white-noise-acceleration model with spectral density `accelerationDensity`
 * (m²/s³); see Bar-Shalom, Li & Kirubarajan, "Estimation with Applications
 * to Tracking and Navigation" (2001), §6.2.2. Measurements are position only,
 * with independent per-axis variance.
 *
 * The class is a plain value holder with no clock of its own: callers pass
 * timestamps, so tests are deterministic.
 */
export class ConstantVelocityKalman {
  // State and covariance, row-major 4x4.
  #x = [0, 0, 0, 0];
  #p = new Array<number>(16).fill(0);
  #timestampMs: number | undefined = undefined;
  readonly #accelerationDensity: number;
  readonly #initialSpeedSigmaMps: number;

  constructor(options: { accelerationDensity: number; initialSpeedSigmaMps: number }) {
    if (!(options.accelerationDensity > 0)) throw new RangeError('accelerationDensity must be > 0');
    if (!(options.initialSpeedSigmaMps > 0)) throw new RangeError('initialSpeedSigmaMps must be > 0');
    this.#accelerationDensity = options.accelerationDensity;
    this.#initialSpeedSigmaMps = options.initialSpeedSigmaMps;
  }

  /** True once the first measurement has been applied. */
  get isInitialized(): boolean {
    return this.#timestampMs !== undefined;
  }

  get timestampMs(): number | undefined {
    return this.#timestampMs;
  }

  /** Discards all state; the next measurement re-initialises the filter. */
  reset(): void {
    this.#x = [0, 0, 0, 0];
    this.#p.fill(0);
    this.#timestampMs = undefined;
  }

  /** Starts the filter at a measurement with zero velocity. */
  initialize(point: LocalPoint, sigmaM: number, timestampMs: number): void {
    const v = this.#initialSpeedSigmaMps ** 2;
    const r = sigmaM * sigmaM;
    this.#x = [point.eastM, point.northM, 0, 0];
    this.#p = [r, 0, 0, 0, 0, r, 0, 0, 0, 0, v, 0, 0, 0, 0, v];
    this.#timestampMs = timestampMs;
  }

  /** Current position estimate. */
  get position(): LocalPoint {
    return { eastM: this.#x[0]!, northM: this.#x[1]! };
  }

  /** Current velocity estimate in m/s. */
  get velocity(): { readonly eastMps: number; readonly northMps: number } {
    return { eastMps: this.#x[2]!, northMps: this.#x[3]! };
  }

  /** One-sigma horizontal position uncertainty: sqrt of the mean of the two position variances. */
  get positionSigmaM(): number {
    return Math.sqrt((this.#p[0]! + this.#p[5]!) / 2);
  }

  /**
   * The state propagated to `timestampMs` without changing the filter.
   * Used to gate a measurement before committing to it.
   */
  predicted(timestampMs: number): { x: number[]; p: number[] } {
    const last = this.#timestampMs;
    if (last === undefined) throw new Error('predicted() called before initialize()');
    const dt = Math.max(0, (timestampMs - last) / 1000);
    const [e, n, ve, vn] = this.#x as [number, number, number, number];
    const x = [e + ve * dt, n + vn * dt, ve, vn];

    // P' = F P Fᵀ + Q, with F = [[I, dt·I], [0, I]] applied per axis.
    const p = this.#p;
    const q = this.#accelerationDensity;
    const q11 = (q * dt ** 3) / 3;
    const q12 = (q * dt ** 2) / 2;
    const q22 = q * dt;
    const out = new Array<number>(16).fill(0);
    // Axis-coupled terms (east/north cross covariances) are propagated too,
    // so the filter stays correct after a non-diagonal update.
    const at = (r: number, c: number) => p[r * 4 + c]!;
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        // (F P)[r][c]
        const fp = (row: number, col: number) => (row < 2 ? at(row, col) + dt * at(row + 2, col) : at(row, col));
        // (F P Fᵀ)[r][c] = (FP)[r][c] + dt·(FP)[r][c+2] for c < 2
        out[r * 4 + c] = c < 2 ? fp(r, c) + dt * fp(r, c + 2) : fp(r, c);
      }
    }
    out[0] = out[0]! + q11;
    out[5] = out[5]! + q11;
    out[2] = out[2]! + q12;
    out[8] = out[8]! + q12;
    out[7] = out[7]! + q12;
    out[13] = out[13]! + q12;
    out[10] = out[10]! + q22;
    out[15] = out[15]! + q22;
    return { x, p: out };
  }

  /**
   * Squared Mahalanobis distance of a measurement from the predicted state.
   * Under the model it is chi-square distributed with 2 degrees of freedom.
   */
  innovationDistanceSq(point: LocalPoint, sigmaM: number, timestampMs: number): number {
    const { x, p } = this.predicted(timestampMs);
    const r = sigmaM * sigmaM;
    const ye = point.eastM - x[0]!;
    const yn = point.northM - x[1]!;
    const s00 = p[0]! + r;
    const s01 = p[1]!;
    const s11 = p[5]! + r;
    const det = s00 * s11 - s01 * s01;
    return (ye * ye * s11 - 2 * ye * yn * s01 + yn * yn * s00) / det;
  }

  /** Predicts to `timestampMs` and applies a position measurement. */
  update(point: LocalPoint, sigmaM: number, timestampMs: number): void {
    const { x, p } = this.predicted(timestampMs);
    const r = sigmaM * sigmaM;
    const ye = point.eastM - x[0]!;
    const yn = point.northM - x[1]!;
    const s00 = p[0]! + r;
    const s01 = p[1]!;
    const s10 = p[4]!;
    const s11 = p[5]! + r;
    const det = s00 * s11 - s01 * s10;
    const i00 = s11 / det;
    const i01 = -s01 / det;
    const i10 = -s10 / det;
    const i11 = s00 / det;

    // K = P Hᵀ S⁻¹; P Hᵀ is the first two columns of P.
    const k = new Array<number>(8);
    for (let row = 0; row < 4; row += 1) {
      const ph0 = p[row * 4]!;
      const ph1 = p[row * 4 + 1]!;
      k[row * 2] = ph0 * i00 + ph1 * i10;
      k[row * 2 + 1] = ph0 * i01 + ph1 * i11;
    }
    const nextX = x.map((value, row) => value + k[row * 2]! * ye + k[row * 2 + 1]! * yn);

    // P = (I - K H) P
    const nextP = new Array<number>(16);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        nextP[row * 4 + col] = p[row * 4 + col]! - k[row * 2]! * p[col]! - k[row * 2 + 1]! * p[4 + col]!;
      }
    }
    // Keep P symmetric against rounding drift.
    for (let row = 0; row < 4; row += 1) {
      for (let col = row + 1; col < 4; col += 1) {
        const mean = (nextP[row * 4 + col]! + nextP[col * 4 + row]!) / 2;
        nextP[row * 4 + col] = mean;
        nextP[col * 4 + row] = mean;
      }
    }
    this.#x = nextX;
    this.#p = nextP;
    this.#timestampMs = timestampMs;
  }
}
