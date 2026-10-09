import type { NavigationConfig } from '../config.ts';
import { createLocalFrame, type LocalFrame } from '../geo/localFrame.ts';
import type { ConfidenceLevel, FilteredPosition, LocationFix } from '../model/location.ts';
import type { TravelMode } from '../model/route.ts';
import { ConstantVelocityKalman } from './kalman.ts';

/** Why the pipeline refused a fix. */
export type FixRejectionReason =
  | 'invalid'
  | 'inaccurate'
  | 'stale'
  | 'future'
  | 'duplicate'
  | 'out-of-order'
  | 'outlier'
  | 'implausible-speed';

/** What happened to one {@linkcode LocationFix}. The raw fix is always echoed back unchanged. */
export type FixResult =
  | {
      readonly kind: 'accepted';
      readonly fix: LocationFix;
      readonly filtered: FilteredPosition;
      /** True when the filter restarted at this fix (first fix, manual origin, or after repeated outliers). */
      readonly didReset: boolean;
    }
  | { readonly kind: 'rejected'; readonly fix: LocationFix; readonly reason: FixRejectionReason };

/**
 * Turns raw fixes into filtered positions: validation, accuracy gating,
 * timestamp checks, outlier rejection, then a constant-velocity Kalman filter
 * in a local ENU frame anchored at the first accepted fix.
 */
export interface LocationPipeline {
  /** Feeds one fix. `nowMs` is the caller's clock, used only for staleness. */
  ingest(fix: LocationFix, nowMs: number): FixResult;
  /** Latest filtered position, or `undefined` before the first accepted fix. */
  readonly latest: FilteredPosition | undefined;
  /** When filtered speed first exceeded the too-fast guard, while it still does. */
  readonly tooFastSinceMs: number | undefined;
  /** Forgets all state, e.g. when navigation stops. */
  reset(): void;
}

/** Creates a {@linkcode LocationPipeline} for one travel mode. */
export function createLocationPipeline(config: NavigationConfig['location'], mode: TravelMode): LocationPipeline {
  const kalman = new ConstantVelocityKalman({
    accelerationDensity: config.accelerationDensity,
    initialSpeedSigmaMps: config.initialSpeedSigmaMps,
  });
  let frame: LocalFrame | undefined;
  let lastSeen: LocationFix | undefined;
  let lastAccepted: LocationFix | undefined;
  let latest: FilteredPosition | undefined;
  let consecutiveRejections = 0;
  let tooFastSinceMs: number | undefined;

  const sigmaOf = (fix: LocationFix) => fix.accuracy.horizontalM * config.radiusToSigma;

  const confidenceFor = (sigmaM: number): ConfidenceLevel => {
    const radius = sigmaM / config.radiusToSigma;
    if (radius <= config.highConfidenceRadiusM) return 'high';
    if (radius <= config.mediumConfidenceRadiusM) return 'medium';
    return 'low';
  };

  const snapshot = (timestampMs: number): FilteredPosition => {
    const position = kalman.position;
    const velocity = kalman.velocity;
    const sigmaM = kalman.positionSigmaM;
    return {
      coordinate: frame!.toGeographic(position),
      sigmaM,
      velocityEastMps: velocity.eastMps,
      velocityNorthMps: velocity.northMps,
      speedMps: Math.hypot(velocity.eastMps, velocity.northMps),
      timestampMs,
      confidence: confidenceFor(sigmaM),
    };
  };

  const accept = (fix: LocationFix, didReset: boolean): FixResult => {
    lastAccepted = fix;
    consecutiveRejections = 0;
    latest = snapshot(fix.timestampMs);
    if (latest.speedMps > config.tooFastSpeedMps) {
      if (tooFastSinceMs === undefined) tooFastSinceMs = fix.timestampMs;
    } else {
      tooFastSinceMs = undefined;
    }
    return { kind: 'accepted', fix, filtered: latest, didReset };
  };

  const restartAt = (fix: LocationFix): FixResult => {
    frame = createLocalFrame(fix.coordinate);
    kalman.initialize({ eastM: 0, northM: 0 }, sigmaOf(fix), fix.timestampMs);
    tooFastSinceMs = undefined;
    return accept(fix, true);
  };

  const reject = (fix: LocationFix, reason: FixRejectionReason, countsTowardReset: boolean): FixResult => {
    if (countsTowardReset) consecutiveRejections += 1;
    return { kind: 'rejected', fix, reason };
  };

  return {
    get latest() {
      return latest;
    },
    get tooFastSinceMs() {
      return tooFastSinceMs;
    },
    reset() {
      kalman.reset();
      frame = undefined;
      lastSeen = undefined;
      lastAccepted = undefined;
      latest = undefined;
      consecutiveRejections = 0;
      tooFastSinceMs = undefined;
    },
    ingest(fix, nowMs) {
      const { latitude, longitude } = fix.coordinate;
      const valid =
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        Math.abs(latitude) <= 90 &&
        Math.abs(longitude) <= 180 &&
        Number.isFinite(fix.timestampMs) &&
        fix.accuracy.horizontalM > 0 &&
        Number.isFinite(fix.accuracy.horizontalM);
      if (!valid) return reject(fix, 'invalid', false);

      const previous = lastSeen;
      if (previous && fix.timestampMs <= previous.timestampMs) {
        const same =
          fix.timestampMs === previous.timestampMs &&
          latitude === previous.coordinate.latitude &&
          longitude === previous.coordinate.longitude;
        return reject(fix, same ? 'duplicate' : 'out-of-order', false);
      }
      lastSeen = fix;

      if (fix.timestampMs > nowMs + config.maxFutureSkewMs) return reject(fix, 'future', false);
      if (nowMs - fix.timestampMs > config.maxFixAgeMs) return reject(fix, 'stale', false);
      if (fix.accuracy.horizontalM > config.maxAccuracyM) return reject(fix, 'inaccurate', false);

      // A person-chosen origin is a statement, not a measurement.
      if (fix.source === 'manual' || !kalman.isInitialized || !frame || !lastAccepted) {
        return restartAt(fix);
      }

      const point = frame.toLocal(fix.coordinate);
      const sigma = sigmaOf(fix);
      const dtS = (fix.timestampMs - lastAccepted.timestampMs) / 1000;
      const jumpM = Math.hypot(
        point.eastM - frame.toLocal(lastAccepted.coordinate).eastM,
        point.northM - frame.toLocal(lastAccepted.coordinate).northM,
      );
      const unexplainedM = Math.max(0, jumpM - fix.accuracy.horizontalM - lastAccepted.accuracy.horizontalM);
      const impliedSpeed = dtS > 0 ? unexplainedM / dtS : 0;
      const tooFast = impliedSpeed > config.maxPlausibleSpeedMps[mode];
      const outlier = kalman.innovationDistanceSq(point, sigma, fix.timestampMs) > config.outlierGateChiSq;

      if (tooFast || outlier) {
        if (consecutiveRejections + 1 >= config.outliersBeforeReset) return restartAt(fix);
        return reject(fix, tooFast ? 'implausible-speed' : 'outlier', true);
      }

      kalman.update(point, sigma, fix.timestampMs);
      return accept(fix, false);
    },
  };
}
