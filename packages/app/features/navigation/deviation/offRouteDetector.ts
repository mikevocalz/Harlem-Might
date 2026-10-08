import type { NavigationConfig } from '../config.ts';
import type { FilteredPosition, LocationFix, RouteMatch } from '../model/location.ts';
import type { RouteDeviation } from '../model/progress.ts';

/** One observation for {@linkcode OffRouteDetector.observe}. */
export interface DeviationObservation {
  readonly fix: LocationFix;
  readonly filtered: FilteredPosition;
  readonly match: RouteMatch;
}

/**
 * Confirms a deviation over several reliable fixes before reporting
 * `off-route`, so one multipath jump between Harlem's tall buildings does not
 * trigger a reroute.
 *
 * A fix is reliable when its 68% radius is at most `reliableAccuracyM`.
 * Unreliable fixes hold the current state: they neither count toward a
 * deviation nor clear one.
 */
export interface OffRouteDetector {
  observe(observation: DeviationObservation): RouteDeviation;
  readonly state: RouteDeviation;
  /** Back to `on-route`, e.g. after a reroute replaced the route. */
  reset(): void;
}

/** Creates an {@linkcode OffRouteDetector}. */
export function createOffRouteDetector(config: NavigationConfig['deviation']): OffRouteDetector {
  let state: RouteDeviation = { kind: 'on-route' };
  let backwardRun: { count: number; sinceMs: number } | undefined;

  const distanceFromRoute = (match: RouteMatch) =>
    match.kind === 'matched' ? Math.abs(match.crossTrackM) : match.nearestDistanceM;

  return {
    get state() {
      return state;
    },
    reset() {
      state = { kind: 'on-route' };
      backwardRun = undefined;
    },
    observe({ fix, filtered, match }) {
      if (fix.accuracy.horizontalM > config.reliableAccuracyM) return state;
      const t = fix.timestampMs;
      const threshold = Math.max(config.minDistanceM, config.accuracyMultiplier * fix.accuracy.horizontalM);
      const distance = distanceFromRoute(match);

      if (distance > threshold) {
        backwardRun = undefined;
        if (state.kind === 'off-route') {
          state = { ...state, distanceM: distance };
          return state;
        }
        const count = state.kind === 'suspected' ? state.consecutiveFixes + 1 : 1;
        const sinceMs = state.kind === 'suspected' ? state.sinceMs : t;
        state =
          count >= config.consecutiveFixes && t - sinceMs >= config.minDurationMs
            ? { kind: 'off-route', distanceM: distance, sinceMs }
            : { kind: 'suspected', consecutiveFixes: count, distanceM: distance, sinceMs };
        return state;
      }

      // On the route geometry. Check direction of travel.
      const movingBackward =
        match.kind === 'matched' &&
        match.travelDirection === 'backward' &&
        filtered.speedMps >= config.wrongDirectionMinSpeedMps;
      if (movingBackward) {
        backwardRun = backwardRun ? { count: backwardRun.count + 1, sinceMs: backwardRun.sinceMs } : { count: 1, sinceMs: t };
        state =
          backwardRun.count >= config.wrongDirectionFixes
            ? { kind: 'wrong-direction', consecutiveFixes: backwardRun.count, sinceMs: backwardRun.sinceMs }
            : { kind: 'on-route' };
        return state;
      }
      backwardRun = undefined;
      state = { kind: 'on-route' };
      return state;
    },
  };
}
