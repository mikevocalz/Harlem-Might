import { create } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { FixResult } from '../location/locationPipeline.ts';
import type { HeadingEstimate, RouteMatch } from '../model/location.ts';
import type { PositioningState, RouteProgress } from '../model/progress.ts';
import { routeSteps, type RouteStep } from '../model/route.ts';
import {
  hasActiveTrip,
  type ArTrackingState,
  type NavigationError,
  type NavigationSession,
  type RouteFailureKind,
} from '../model/session.ts';

/** Whether a route request is running. Separate from the phase so a reroute can load while guidance continues. */
export type RouteLoadingState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly purpose: 'initial' | 'reroute'; readonly attempt: number }
  | { readonly kind: 'failed'; readonly purpose: 'initial' | 'reroute'; readonly reason: RouteFailureKind; readonly message: string };

/** Progress for the active route, or none before the first matched fix. */
export type ProgressState = { readonly kind: 'none' } | { readonly kind: 'tracking'; readonly progress: RouteProgress };

/**
 * The low-frequency navigation state screens subscribe to. Each slice
 * changes on its own: a GPS confidence change does not touch `progress`, an
 * AR tracking change does not touch `session`.
 */
export interface NavigationState {
  readonly session: NavigationSession;
  readonly routeLoading: RouteLoadingState;
  readonly positioning: PositioningState;
  readonly arTracking: ArTrackingState;
  readonly progress: ProgressState;
}

/** The state a new or cancelled session starts from. */
export const INITIAL_NAVIGATION_STATE: NavigationState = {
  session: { phase: 'idle' },
  routeLoading: { kind: 'idle' },
  positioning: { kind: 'acquiring' },
  arTracking: { kind: 'off' },
  progress: { kind: 'none' },
};

/**
 * The canonical navigation store shared by map, AR, inspector, web and
 * spatial panels. Written only by `createNavigationController`; screens read
 * it with selectors such as {@linkcode selectPhase}.
 */
export const useNavigationStore = create<NavigationState>()(() => INITIAL_NAVIGATION_STATE);

/**
 * Per-fix values: the latest raw fix result, route match and heading. These
 * change at sensor rate, so they live outside {@linkcode useNavigationStore}
 * and only components that draw them (the AR scene, the map puck) subscribe,
 * through `useStore(navigationFixStore, selector)` or
 * `navigationFixStore.subscribe`.
 */
export interface NavigationFixState {
  readonly lastFix: FixResult | undefined;
  readonly match: RouteMatch | undefined;
  readonly heading: HeadingEstimate | undefined;
}

export const INITIAL_FIX_STATE: NavigationFixState = { lastFix: undefined, match: undefined, heading: undefined };

/** The transient per-fix store. See {@linkcode NavigationFixState}. */
export const navigationFixStore = createStore<NavigationFixState>()(() => INITIAL_FIX_STATE);

// Selectors. Each returns a value already held in state, so they are safe
// with `useNavigationStore(selector)` without shallow comparison.

export const selectSession = (s: NavigationState) => s.session;
export const selectPhase = (s: NavigationState) => s.session.phase;
export const selectRouteLoading = (s: NavigationState) => s.routeLoading;
export const selectPositioning = (s: NavigationState) => s.positioning;
export const selectArTracking = (s: NavigationState) => s.arTracking;
export const selectProgress = (s: NavigationState) => (s.progress.kind === 'tracking' ? s.progress.progress : undefined);
export const selectActiveRoute = (s: NavigationState) => (hasActiveTrip(s.session) ? s.session.activeRoute : undefined);
export const selectDestination = (s: NavigationState) =>
  'destination' in s.session ? s.session.destination : s.session.phase === 'error' ? s.session.trip?.destination : undefined;
export const selectNavigationError = (s: NavigationState): NavigationError | undefined =>
  s.session.phase === 'error' ? s.session.error : undefined;

/**
 * Everything the spec lists for a navigation session in one plain object:
 * provider, origin, destination, entrance, distance, duration, maneuvers,
 * active step, matched position, rerouting status and confidence.
 *
 * Builds a new object each call; use it outside render (inspector, logging),
 * or with `useShallow` in a component.
 */
export function summarizeSession(state: NavigationState, fixes: NavigationFixState) {
  const session = state.session;
  if (!hasActiveTrip(session)) return undefined;
  const { route } = session.activeRoute;
  const steps: readonly RouteStep[] = routeSteps(route);
  const progress = selectProgress(state);
  return {
    phase: session.phase,
    provider: route.provider,
    origin: session.origin,
    destination: session.destination,
    entrance: session.destination.entrance,
    distanceM: route.distanceM,
    durationS: route.durationS,
    maneuvers: steps.map((step) => step.maneuver),
    activeStep: progress?.activeStep,
    matchedPosition: fixes.match,
    rerouting: session.phase === 'rerouting' ? ('in-progress' as const) : session.reroute.kind,
    confidence: state.positioning.kind === 'tracking' ? state.positioning.confidence : undefined,
  };
}

/** Puts both stores back to their initial state (tests, sign-out). */
export function resetNavigationStores(): void {
  useNavigationStore.setState(INITIAL_NAVIGATION_STATE, true);
  navigationFixStore.setState(INITIAL_FIX_STATE, true);
}
