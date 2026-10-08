import { bearingOfVector, normalizeDegrees, toRadians } from '../geo/angles.ts';
import type { HeadingEstimate, HeadingSample, ConfidenceLevel } from '../model/location.ts';

/** Tuning for {@linkcode HeadingSmoother}. */
export interface HeadingSmootherConfig {
  /** Exponential smoothing time constant in seconds. Larger is steadier and slower. */
  readonly timeConstantS: number;
  /** Samples kept for the consistency (mean resultant length) window. */
  readonly windowSize: number;
  /** Consistency at or above which confidence is `high`. */
  readonly highConsistency: number;
  /** Consistency at or above which confidence is `medium`. */
  readonly mediumConsistency: number;
  /** Platform accuracy in degrees above which a sample can be at most `medium`. */
  readonly maxHighAccuracyDeg: number;
  /** Platform accuracy in degrees above which a sample is ignored. */
  readonly maxUsableAccuracyDeg: number;
}

/**
 * Smooths compass or AR headings on the unit circle so 359° and 1° average
 * to 0°, never 180°.
 *
 * Each sample is a unit vector (sin θ, cos θ). The smoothed vector is an
 * exponential moving average with a time-based gain α = 1 − e^(−Δt/τ), so a
 * burst of fast samples does not smooth harder than slow ones. Confidence
 * comes from the mean resultant length R of the last `windowSize` samples
 * (Mardia & Jupp, "Directional Statistics", 2000, §2.3.1): R near 1 means the
 * samples agree.
 */
export class HeadingSmoother {
  readonly #config: HeadingSmootherConfig;
  #sin = 0;
  #cos = 0;
  #lastMs: number | undefined;
  #window: { sin: number; cos: number }[] = [];
  #source: HeadingSample['source'] = 'compass';
  #lastAccuracyDeg: number | undefined;

  constructor(config: HeadingSmootherConfig) {
    if (!(config.timeConstantS > 0)) throw new RangeError('timeConstantS must be > 0');
    if (!(config.windowSize >= 1)) throw new RangeError('windowSize must be >= 1');
    this.#config = config;
  }

  reset(): void {
    this.#sin = 0;
    this.#cos = 0;
    this.#lastMs = undefined;
    this.#window = [];
    this.#lastAccuracyDeg = undefined;
  }

  /**
   * Adds a sample and returns the new estimate, or `undefined` when the
   * sample was ignored (non-finite, out of order, duplicate time, or worse
   * than `maxUsableAccuracyDeg`). A source change restarts smoothing so a
   * compass bias never blends into an AR heading.
   */
  add(sample: HeadingSample): HeadingEstimate | undefined {
    if (!Number.isFinite(sample.headingDeg) || !Number.isFinite(sample.timestampMs)) return undefined;
    if (sample.accuracyDeg !== undefined && !(sample.accuracyDeg <= this.#config.maxUsableAccuracyDeg)) {
      return undefined;
    }
    if (this.#lastMs !== undefined && sample.timestampMs <= this.#lastMs) return undefined;
    if (this.#lastMs !== undefined && sample.source !== this.#source) this.reset();

    const theta = toRadians(normalizeDegrees(sample.headingDeg));
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    if (this.#lastMs === undefined) {
      this.#sin = s;
      this.#cos = c;
    } else {
      const dt = (sample.timestampMs - this.#lastMs) / 1000;
      const alpha = 1 - Math.exp(-dt / this.#config.timeConstantS);
      this.#sin += alpha * (s - this.#sin);
      this.#cos += alpha * (c - this.#cos);
    }
    this.#lastMs = sample.timestampMs;
    this.#source = sample.source;
    this.#lastAccuracyDeg = sample.accuracyDeg;
    this.#window.push({ sin: s, cos: c });
    if (this.#window.length > this.#config.windowSize) this.#window.shift();
    return this.current();
  }

  /** The latest estimate, or `undefined` before the first usable sample. */
  current(): HeadingEstimate | undefined {
    if (this.#lastMs === undefined) return undefined;
    let sumSin = 0;
    let sumCos = 0;
    for (const v of this.#window) {
      sumSin += v.sin;
      sumCos += v.cos;
    }
    const consistency = Math.hypot(sumSin, sumCos) / this.#window.length;
    return {
      headingDeg: bearingOfVector(this.#sin, this.#cos),
      source: this.#source,
      confidence: this.#confidence(consistency),
      consistency,
      timestampMs: this.#lastMs,
    };
  }

  #confidence(consistency: number): ConfidenceLevel {
    const { highConsistency, mediumConsistency, maxHighAccuracyDeg } = this.#config;
    // A single sample has R = 1 by definition; it says nothing about agreement.
    const enoughSamples = this.#window.length >= Math.min(3, this.#config.windowSize);
    const accurate = this.#lastAccuracyDeg === undefined || this.#lastAccuracyDeg <= maxHighAccuracyDeg;
    if (enoughSamples && consistency >= highConsistency && accurate) return 'high';
    if (consistency >= mediumConsistency) return 'medium';
    return 'low';
  }
}
