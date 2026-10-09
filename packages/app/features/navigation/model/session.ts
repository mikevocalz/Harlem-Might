import type { GeographicCoordinate } from './geo.ts';
import type { ArrivalState, RouteDeviation } from './progress.ts';
import type { ExternalMapsHandoff, Route, RouteDestination, TravelMode } from './route.ts';

/**
 * Where the trip starts. Headsets have no GPS, so they use a paired phone or
 * a place the person chose; the UI must label a manual origin as such.
 */
export type NavigationOrigin =
  | { readonly kind: 'device-location' }
  | { readonly kind: 'companion-phone'; readonly deviceLabel: string }
  | { readonly kind: 'manual'; readonly coordinate: GeographicCoordinate; readonly label: string };

/** Machine-readable reason a route request failed. */
export type RouteFailureKind =
  | 'no-route'
  | 'unauthorized'
  | 'rate-limited'
  | 'unavailable'
  | 'network'
  | 'invalid-request'
  | 'missing-token';

/** Why a session is in the `error` phase. */
export type NavigationError =
  | { readonly kind: 'route-failed'; readonly reason: RouteFailureKind; readonly message: string }
  | {
      readonly kind: 'unsupported-mode';
      readonly mode: TravelMode;
      readonly message: string;
      readonly handoff: ExternalMapsHandoff;
    }
  | { readonly kind: 'location'; readonly reason: 'permission-denied' | 'unavailable'; readonly message: string };

/** State of a reroute running alongside an active route. */
export type RerouteStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pending'; readonly reason: 'off-route' | 'wrong-direction' | 'manual'; readonly sinceMs: number }
  | { readonly kind: 'failed'; readonly reason: RouteFailureKind; readonly message: string; readonly atMs: number };

/**
 * The route being followed. `generation` increases on every reroute so
 * consumers (map line, AR chevrons) can tell a replacement from a re-render.
 */
export interface ActiveRoute {
  readonly route: Route;
  readonly alternatives: readonly Route[];
  readonly generation: number;
  readonly receivedAtMs: number;
}

/** Fields every session with a chosen destination carries. */
export interface PlannedTrip {
  readonly origin: NavigationOrigin;
  readonly destination: RouteDestination;
  readonly mode: TravelMode;
}

/** Fields every session with a route being followed carries. */
export interface ActiveTrip extends PlannedTrip {
  readonly activeRoute: ActiveRoute;
  readonly deviation: RouteDeviation;
  readonly arrival: ArrivalState;
  readonly reroute: RerouteStatus;
}

/** Phases that a pause or reroute returns to. */
export type ResumablePhase = 'navigating' | 'calibratingAR' | 'navigatingAR';

/**
 * The one navigation session shared by the map, AR view, inspector, web and
 * spatial panels. `phase` is the discriminant; each phase carries exactly the
 * data that exists in it.
 *
 * Phase names follow the product spec.
 */
export type NavigationSession =
  | { readonly phase: 'idle' }
  | { readonly phase: 'selectingDestination'; readonly origin: NavigationOrigin }
  | ({ readonly phase: 'calculatingRoute'; readonly requestId: number } & PlannedTrip)
  | ({
      readonly phase: 'routeReady';
      readonly routes: readonly [Route, ...Route[]];
      readonly selectedRouteIndex: number;
    } & PlannedTrip)
  | ({ readonly phase: 'navigating' | 'calibratingAR' | 'navigatingAR' } & ActiveTrip)
  | ({ readonly phase: 'rerouting'; readonly resumePhase: ResumablePhase } & ActiveTrip)
  | ({ readonly phase: 'paused'; readonly resumePhase: ResumablePhase } & ActiveTrip)
  | ({ readonly phase: 'arrived' } & ActiveTrip)
  | {
      readonly phase: 'error';
      readonly error: NavigationError;
      /** The trip to retry, when the error happened after a destination was chosen. */
      readonly trip?: PlannedTrip;
    };

/** Every phase name. */
export type NavigationPhase = NavigationSession['phase'];

/** The session phases that carry an {@linkcode ActiveTrip}. */
export type ActiveSession = Extract<NavigationSession, { readonly activeRoute: ActiveRoute }>;

/** Narrows a session to one with an active route. */
export function hasActiveTrip(session: NavigationSession): session is ActiveSession {
  return 'activeRoute' in session;
}

/** AR camera tracking, reported by the AR view. Independent of GPS confidence. */
export type ArTrackingState =
  | { readonly kind: 'off' }
  | { readonly kind: 'initializing' }
  | { readonly kind: 'normal' }
  | {
      readonly kind: 'limited';
      readonly reason: 'insufficient-features' | 'excessive-motion' | 'relocalizing' | 'heading-unreliable';
    }
  | { readonly kind: 'unavailable'; readonly reason: 'unsupported-device' | 'permission-denied' | 'no-location-source' };
