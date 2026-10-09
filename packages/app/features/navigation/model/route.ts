import type { GeographicCoordinate } from './geo.ts';

/**
 * How the person is travelling. `transit` is part of the contract so callers
 * can ask for it, but no provider here computes transit routes; providers
 * answer with an `unsupported` {@linkcode RouteResponse} carrying an
 * {@linkcode ExternalMapsHandoff} instead.
 */
export type TravelMode = 'walking' | 'cycling' | 'driving' | 'transit';

/** Which routing backend produced a route. */
export type RouteProviderId = 'mapbox' | 'google';

/**
 * Where a place's door is. Navigation and arrival aim here when it is known,
 * because a building centroid can sit on the wrong street.
 */
export interface EntrancePoint {
  readonly coordinate: GeographicCoordinate;
  /** Human description such as "Main doors on West 125th Street". */
  readonly description?: string;
  /** True when this entrance is step-free. */
  readonly isAccessible?: boolean;
  /** Where the coordinate came from, for auditing. */
  readonly source: 'cms-verified' | 'cms-unverified' | 'provider-routable-point';
}

/** The place a session navigates to. */
export interface RouteDestination {
  /** Display name. */
  readonly name: string;
  /** CMS place id when the destination is a catalogued place. */
  readonly placeId?: string;
  /** The place's own position (often a building centroid). */
  readonly coordinate: GeographicCoordinate;
  /** The door to route and arrive at. Preferred over `coordinate` when present. */
  readonly entrance?: EntrancePoint;
}

/** Initial direction of travel, sent to providers that can use it. */
export interface OriginBearing {
  /** Degrees clockwise from true north, 0..360. */
  readonly headingDeg: number;
  /** Allowed deviation either side, degrees. */
  readonly toleranceDeg: number;
}

/**
 * A request for routes.
 *
 * @see {@linkcode RouteResponse}
 */
export interface RouteRequest {
  readonly origin: GeographicCoordinate;
  /** Current direction of travel; rerouting passes this so the new route does not start with a U-turn. */
  readonly originBearing?: OriginBearing;
  readonly destination: RouteDestination;
  readonly mode: TravelMode;
  /** Ask for alternatives when the provider has them. @default true */
  readonly includeAlternatives?: boolean;
  /** BCP-47 language for instructions. @default 'en' */
  readonly language?: string;
}

/**
 * The full shape of a route as an ordered polyline, at least two positions,
 * in travel order.
 */
export interface RouteGeometry {
  readonly kind: 'line-string';
  readonly coordinates: readonly GeographicCoordinate[];
}

/** What kind of action a maneuver asks for. Mapbox's space-separated types map to kebab-case. */
export type ManeuverType =
  | 'depart'
  | 'arrive'
  | 'turn'
  | 'continue'
  | 'new-name'
  | 'end-of-road'
  | 'fork'
  | 'merge'
  | 'on-ramp'
  | 'off-ramp'
  | 'roundabout'
  | 'rotary'
  | 'roundabout-turn'
  | 'exit-roundabout'
  | 'exit-rotary'
  | 'notification'
  | 'other';

/** Direction qualifier for a maneuver. For `arrive` it names the side the destination is on. */
export type ManeuverModifier =
  | 'uturn'
  | 'sharp-right'
  | 'right'
  | 'slight-right'
  | 'straight'
  | 'slight-left'
  | 'left'
  | 'sharp-left';

/**
 * The action at the start of a {@linkcode RouteStep}.
 *
 * Bearings are degrees clockwise from true north, so an AR turn arrow can be
 * drawn from `bearingBeforeDeg` to `bearingAfterDeg` without consulting the
 * provider again.
 */
export interface NavigationManeuver {
  readonly type: ManeuverType;
  readonly modifier?: ManeuverModifier;
  /** Where the maneuver happens. */
  readonly location: GeographicCoordinate;
  readonly bearingBeforeDeg: number;
  readonly bearingAfterDeg: number;
  /** Provider-written instruction, e.g. "Turn right onto West 126th Street." */
  readonly instruction: string;
}

/** One instruction-sized piece of a route. */
export interface RouteStep {
  /** Position of this step within the whole route (not the leg), from 0. */
  readonly index: number;
  readonly maneuver: NavigationManeuver;
  /** Street or path name. Empty when the provider has no name (walkways, crosswalks). */
  readonly name: string;
  readonly distanceM: number;
  readonly durationS: number;
  readonly geometry: RouteGeometry;
}

/** The part of a route between two waypoints. A two-point request has one leg. */
export interface RouteLeg {
  readonly distanceM: number;
  readonly durationS: number;
  readonly steps: readonly RouteStep[];
}

/**
 * One computed route. Immutable; rerouting replaces the whole object.
 *
 * @see {@linkcode RouteResponse}
 */
export interface Route {
  /** Stable for the lifetime of this object; changes on every reroute. */
  readonly id: string;
  readonly provider: RouteProviderId;
  readonly mode: Exclude<TravelMode, 'transit'>;
  readonly geometry: RouteGeometry;
  readonly distanceM: number;
  readonly durationS: number;
  readonly legs: readonly RouteLeg[];
}

/** Links that open the same trip in a dedicated maps app. */
export interface ExternalMapsHandoff {
  readonly appleMapsUrl: string;
  readonly googleMapsUrl: string;
}

/**
 * What a {@linkcode RouteRequest} produced. Failures are thrown as
 * `RouteProviderError`; an unsupported mode is a normal answer, not a failure.
 */
export type RouteResponse =
  | {
      readonly kind: 'routes';
      readonly provider: RouteProviderId;
      /** Best route first. Never empty. */
      readonly routes: readonly [Route, ...Route[]];
    }
  | {
      readonly kind: 'unsupported';
      readonly mode: TravelMode;
      readonly reason: string;
      readonly handoff: ExternalMapsHandoff;
    };

/** The steps of every leg, in order. */
export function routeSteps(route: Route): readonly RouteStep[] {
  return route.legs.flatMap((leg) => leg.steps);
}

/** The coordinate a route should end at and arrival should be measured to. */
export function arrivalTarget(destination: RouteDestination): GeographicCoordinate {
  return destination.entrance?.coordinate ?? destination.coordinate;
}
