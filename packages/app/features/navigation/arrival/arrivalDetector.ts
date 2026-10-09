import type { NavigationConfig } from '../config.ts';
import { distanceM } from '../geo/localFrame.ts';
import type { GeographicCoordinate } from '../model/geo.ts';
import type { FilteredPosition, LocationFix } from '../model/location.ts';
import type { ArrivalState } from '../model/progress.ts';
import { arrivalTarget, type RouteDestination } from '../model/route.ts';

/**
 * Decides arrival at the destination's entrance.
 *
 * Distance is measured from the filtered position (not the route-snapped
 * one, since an entrance can sit a few metres off the route line) to the
 * entrance when the place has one. Measuring to a building centroid would
 * call "arrived" from the wrong side of the building.
 *
 * Entering `arrived` needs `dwellFixes` fixes in a row inside
 * `arriveRadiusM + min(accuracy, accuracyAllowanceCapM)`. Leaving needs
 * `exitFixes` fixes beyond `exitRadiusM`. Between the two radii the state
 * holds, which is the hysteresis.
 */
export interface ArrivalDetector {
  readonly target: GeographicCoordinate;
  readonly state: ArrivalState;
  observe(fix: LocationFix, filtered: FilteredPosition): ArrivalState;
}

/** Creates an {@linkcode ArrivalDetector} for `destination`. */
export function createArrivalDetector(
  destination: RouteDestination,
  config: NavigationConfig['arrival'],
): ArrivalDetector {
  const target = arrivalTarget(destination);
  let state: ArrivalState = { kind: 'en-route', distanceM: Number.POSITIVE_INFINITY };
  let insideRun = 0;
  let outsideRun = 0;

  return {
    target,
    get state() {
      return state;
    },
    observe(fix, filtered) {
      const distance = distanceM(filtered.coordinate, target);
      const accuracy = fix.accuracy.horizontalM;
      const enterRadius = config.arriveRadiusM + Math.min(accuracy, config.accuracyAllowanceCapM);

      if (state.kind === 'arrived') {
        outsideRun = distance > config.exitRadiusM ? outsideRun + 1 : 0;
        if (outsideRun < config.exitFixes) {
          // A later precise fix inside the radius upgrades an estimate.
          const upgrade = distance <= enterRadius && accuracy <= config.confirmAccuracyM;
          state = { ...state, distanceM: distance, ...(upgrade ? { confidence: 'confirmed' as const } : {}) };
          return state;
        }
        outsideRun = 0;
        insideRun = 0;
      }

      if (distance <= enterRadius) {
        insideRun += 1;
        if (insideRun >= config.dwellFixes) {
          state = {
            kind: 'arrived',
            confidence: accuracy <= config.confirmAccuracyM ? 'confirmed' : 'estimated',
            target,
            distanceM: distance,
            arrivedAtMs: fix.timestampMs,
          };
          return state;
        }
      } else {
        insideRun = 0;
      }
      state =
        distance <= config.approachRadiusM ? { kind: 'approaching', distanceM: distance } : { kind: 'en-route', distanceM: distance };
      return state;
    },
  };
}
