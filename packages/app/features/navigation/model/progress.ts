import type { GeographicCoordinate } from './geo.ts';
import type { ConfidenceLevel } from './location.ts';
import type { NavigationManeuver, RouteStep } from './route.ts';

/**
 * How far along the active route the person is. Computed from a matched
 * position only; an unmatched fix leaves the previous progress in place.
 */
export interface RouteProgress {
  readonly routeId: string;
  readonly distanceTravelledM: number;
  readonly distanceRemainingM: number;
  /** 0..1 */
  readonly fractionTravelled: number;
  readonly durationRemainingS: number;
  /** `timestampMs + durationRemainingS`, epoch milliseconds. */
  readonly etaMs: number;
  readonly activeStepIndex: number;
  readonly activeStep: RouteStep;
  /** The maneuver that ends the active step. Absent only while on the final `arrive` step. */
  readonly nextManeuver?: NavigationManeuver;
  readonly distanceToNextManeuverM: number;
  readonly timestampMs: number;
}

/**
 * Whether the person is following the route.
 *
 * `suspected` counts reliable fixes beyond the threshold; only `off-route`
 * triggers a reroute. Unreliable fixes neither advance nor reset the count.
 */
export type RouteDeviation =
  | { readonly kind: 'on-route' }
  | {
      readonly kind: 'suspected';
      readonly consecutiveFixes: number;
      readonly distanceM: number;
      readonly sinceMs: number;
    }
  | {
      readonly kind: 'off-route';
      readonly distanceM: number;
      readonly sinceMs: number;
    }
  | {
      readonly kind: 'wrong-direction';
      readonly consecutiveFixes: number;
      readonly sinceMs: number;
    };

/**
 * Arrival at the destination's entrance (or its coordinate when no entrance
 * is known).
 *
 * `confirmed` needs a precise fix inside the radius; `estimated` means the
 * fix was inside the radius but too coarse to be sure. Screens should word
 * the two differently.
 */
export type ArrivalState =
  | { readonly kind: 'en-route'; readonly distanceM: number }
  | { readonly kind: 'approaching'; readonly distanceM: number }
  | {
      readonly kind: 'arrived';
      readonly confidence: 'confirmed' | 'estimated';
      readonly target: GeographicCoordinate;
      readonly distanceM: number;
      readonly arrivedAtMs: number;
    };

/**
 * Trust in the current position, separate from AR tracking and route
 * progress so each can be shown on its own.
 */
export type PositioningState =
  | { readonly kind: 'acquiring' }
  | {
      readonly kind: 'tracking';
      readonly confidence: ConfidenceLevel;
      /** Rounded one-sigma uncertainty in whole metres, for display. */
      readonly sigmaM: number;
      /** True when filtered speed is above the walking guard; screens should ask the person to stop using AR. */
      readonly isMovingTooFast: boolean;
    }
  | { readonly kind: 'lost'; readonly sinceMs: number };
