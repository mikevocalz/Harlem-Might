import type { StoreApi } from 'zustand/vanilla';
import { createArrivalDetector, type ArrivalDetector } from '../arrival/arrivalDetector.ts';
import { resolveNavigationConfig, type NavigationConfig, type NavigationConfigOverrides } from '../config.ts';
import { createOffRouteDetector, type OffRouteDetector } from '../deviation/offRouteDetector.ts';
import { bearingOfVector } from '../geo/angles.ts';
import { HeadingSmoother } from '../location/heading.ts';
import { createLocationPipeline, type LocationPipeline } from '../location/locationPipeline.ts';
import { createRouteMatcher, type RouteMatcher } from '../matching/routeMatcher.ts';
import type { FilteredPosition, HeadingEstimate, HeadingSample, LocationFix } from '../model/location.ts';
import type { PositioningState } from '../model/progress.ts';
import type { Route, RouteDestination, RouteResponse, TravelMode } from '../model/route.ts';
import type {
  ActiveTrip,
  ArTrackingState,
  NavigationOrigin,
  NavigationSession,
  PlannedTrip,
  ResumablePhase,
} from '../model/session.ts';
import { computeRouteProgress, createStepIndex, type StepIndex } from '../progress/routeProgress.ts';
import { isAbortError, RouteProviderError, type RouteProvider } from '../providers/routeProvider.ts';
import { createRerouteController, type RerouteController, type ScheduleFn } from '../reroute/rerouteController.ts';
import { hasActiveTrip as hasTrip } from '../model/session.ts';
import {
  INITIAL_FIX_STATE,
  INITIAL_NAVIGATION_STATE,
  navigationFixStore,
  useNavigationStore,
  type NavigationFixState,
  type NavigationState,
} from './navigationStore.ts';

/** Options for {@linkcode createNavigationController}. */
export interface NavigationControllerOptions {
  readonly provider: RouteProvider;
  readonly config?: NavigationConfigOverrides;
  /** @default the shared `useNavigationStore` */
  readonly store?: StoreApi<NavigationState>;
  /** @default the shared `navigationFixStore` */
  readonly fixStore?: StoreApi<NavigationFixState>;
  /** @default Date.now */
  readonly now?: () => number;
  /** Timer used for reroute debouncing. @default setTimeout */
  readonly schedule?: ScheduleFn;
}

/** Input for {@linkcode NavigationController.planRoute}. */
export interface PlanRouteInput {
  readonly origin: NavigationOrigin;
  /** Where the route starts. For `device-location` this is the latest fix. */
  readonly originCoordinate: { readonly latitude: number; readonly longitude: number };
  readonly destination: RouteDestination;
  readonly mode: TravelMode;
}

/**
 * The imperative core of navigation. It owns the location pipeline, route
 * matcher, deviation and arrival detectors and reroute controller, and is the
 * only writer of the navigation stores.
 *
 * Commands that do not apply to the current phase are ignored and return
 * `false`; they never throw for a phase mismatch, because UI events race
 * with GPS events.
 */
export interface NavigationController {
  readonly config: NavigationConfig;
  beginSelection(origin: NavigationOrigin): boolean;
  /** Requests routes. Resolves when the session reaches `routeReady` or `error`, or the request is superseded. */
  planRoute(input: PlanRouteInput): Promise<void>;
  selectRoute(index: number): boolean;
  start(): boolean;
  enterAR(): boolean;
  /** The AR view finished aligning the route with the camera. */
  completeARCalibration(): boolean;
  exitAR(): boolean;
  setArTracking(state: ArTrackingState): void;
  pause(): boolean;
  resume(): boolean;
  /** Asks for a new route from the current position now (debounced like automatic reroutes). */
  reroute(): boolean;
  ingestFix(fix: LocationFix): void;
  ingestHeading(sample: HeadingSample): void;
  /** Re-evaluates time-based positioning state (`lost`). Call from a 1 Hz timer while navigating. */
  refreshPositioning(): void;
  /** Ends the session and returns to `idle`, cancelling every request. */
  cancel(): void;
}

const GUIDING_PHASES = new Set<NavigationSession['phase']>(['navigating', 'calibratingAR', 'navigatingAR', 'rerouting']);

/** Creates a {@linkcode NavigationController}. */
export function createNavigationController(options: NavigationControllerOptions): NavigationController {
  const config = resolveNavigationConfig(options.config);
  const store = options.store ?? useNavigationStore;
  const fixStore = options.fixStore ?? navigationFixStore;
  const now = options.now ?? Date.now;
  const provider = options.provider;

  let pipelineMode: TravelMode = 'walking';
  let pipeline: LocationPipeline = createLocationPipeline(config.location, pipelineMode);
  const headingSmoother = new HeadingSmoother(config.heading);
  let planning: AbortController | undefined;
  let planAttempt = 0;
  let tracking:
    | { matcher: RouteMatcher; steps: StepIndex; offRoute: OffRouteDetector; arrival: ArrivalDetector }
    | undefined;

  const get = () => store.getState();
  const setSession = (session: NavigationSession) => store.setState({ session });

  const reroute: RerouteController = createRerouteController({
    provider,
    config: config.reroute,
    now,
    ...(options.schedule ? { schedule: options.schedule } : {}),
    callbacks: {
      onStart(attempt) {
        store.setState({ routeLoading: { kind: 'loading', purpose: 'reroute', attempt } });
      },
      onResponse(response) {
        applyReroute(response);
      },
      onFailure(error) {
        const session = get().session;
        store.setState({
          routeLoading: { kind: 'failed', purpose: 'reroute', reason: failureKind(error), message: error.message },
        });
        if (session.phase !== 'rerouting') return;
        const { resumePhase, ...trip } = session;
        setSession({
          ...trip,
          phase: resumePhase,
          reroute: { kind: 'failed', reason: failureKind(error), message: error.message, atMs: now() },
        });
      },
    },
  });

  function failureKind(error: RouteProviderError) {
    return error.kind === 'aborted' ? 'unavailable' : error.kind;
  }

  function beginTracking(trip: PlannedTrip, route: Route) {
    const matcher = createRouteMatcher(route, config.matching);
    tracking = {
      matcher,
      steps: createStepIndex(route, matcher.polyline),
      offRoute: createOffRouteDetector(config.deviation),
      arrival: tracking && sameDestination(tracking.arrival, trip.destination)
        ? tracking.arrival
        : createArrivalDetector(trip.destination, config.arrival),
    };
  }

  function sameDestination(detector: ArrivalDetector, destination: RouteDestination) {
    const target = destination.entrance?.coordinate ?? destination.coordinate;
    return detector.target.latitude === target.latitude && detector.target.longitude === target.longitude;
  }

  /** Replaces the route in one store write, keeping destination and entrance from the session. */
  function applyReroute(response: RouteResponse) {
    const session = get().session;
    if (session.phase !== 'rerouting') return;
    if (response.kind !== 'routes') {
      const { resumePhase, ...trip } = session;
      setSession({ ...trip, phase: resumePhase, reroute: { kind: 'failed', reason: 'no-route', message: response.reason, atMs: now() } });
      store.setState({ routeLoading: { kind: 'idle' } });
      return;
    }
    const [route, ...alternatives] = response.routes;
    const { resumePhase, ...trip } = session;
    beginTracking(trip, route);
    const next: NavigationSession = {
      ...trip,
      phase: resumePhase,
      activeRoute: { route, alternatives, generation: trip.activeRoute.generation + 1, receivedAtMs: now() },
      deviation: { kind: 'on-route' },
      reroute: { kind: 'idle' },
    };
    store.setState({ session: next, routeLoading: { kind: 'idle' }, progress: { kind: 'none' } });
    fixStore.setState({ match: undefined });
  }

  function movementHeading(filtered: FilteredPosition): HeadingEstimate | undefined {
    if (filtered.speedMps >= config.heading.minCourseSpeedMps) {
      return {
        headingDeg: bearingOfVector(filtered.velocityEastMps, filtered.velocityNorthMps),
        source: 'course-over-ground',
        confidence: filtered.speedMps >= 2 * config.heading.minCourseSpeedMps ? 'high' : 'medium',
        consistency: 1,
        timestampMs: filtered.timestampMs,
      };
    }
    return headingSmoother.current();
  }

  function updatePositioning(next: PositioningState) {
    const current = get().positioning;
    const same =
      current.kind === next.kind &&
      (current.kind !== 'tracking' ||
        (next.kind === 'tracking' &&
          current.confidence === next.confidence &&
          current.sigmaM === next.sigmaM &&
          current.isMovingTooFast === next.isMovingTooFast));
    if (!same) store.setState({ positioning: next });
  }

  function requestReroute(reason: 'off-route' | 'wrong-direction' | 'manual') {
    const session = get().session;
    if (!hasTrip(session) || session.phase === 'rerouting' || session.phase === 'arrived' || session.phase === 'paused') return false;
    const resumePhase = session.phase as ResumablePhase;
    setSession({ ...session, phase: 'rerouting', resumePhase, reroute: { kind: 'pending', reason, sinceMs: now() } });
    reroute.request(() => {
      const current = get().session;
      if (!hasTrip(current)) throw new Error('No active trip to reroute');
      const position = pipeline.latest;
      if (!position) throw new Error('No position to reroute from');
      const heading = movementHeading(position);
      return {
        origin: position.coordinate,
        ...(heading && heading.confidence !== 'low'
          ? { originBearing: { headingDeg: heading.headingDeg, toleranceDeg: config.reroute.bearingToleranceDeg } }
          : {}),
        destination: current.destination,
        mode: current.mode,
      };
    });
    return true;
  }

  const controller: NavigationController = {
    config,

    beginSelection(origin) {
      const phase = get().session.phase;
      if (phase !== 'idle' && phase !== 'routeReady' && phase !== 'error' && phase !== 'arrived') return false;
      teardown();
      store.setState({ session: { phase: 'selectingDestination', origin }, routeLoading: { kind: 'idle' }, progress: { kind: 'none' } });
      return true;
    },

    async planRoute(input) {
      if (GUIDING_PHASES.has(get().session.phase) || get().session.phase === 'paused') return;
      planning?.abort();
      const abort = new AbortController();
      planning = abort;
      planAttempt += 1;
      const attempt = planAttempt;
      const trip: PlannedTrip = { origin: input.origin, destination: input.destination, mode: input.mode };
      store.setState({
        session: { phase: 'calculatingRoute', requestId: attempt, ...trip },
        routeLoading: { kind: 'loading', purpose: 'initial', attempt },
        progress: { kind: 'none' },
      });
      try {
        const response = await provider.getRoutes(
          { origin: input.originCoordinate, destination: input.destination, mode: input.mode },
          { signal: abort.signal },
        );
        if (attempt !== planAttempt) return;
        planning = undefined;
        if (response.kind === 'unsupported') {
          store.setState({
            session: {
              phase: 'error',
              trip,
              error: { kind: 'unsupported-mode', mode: response.mode, message: response.reason, handoff: response.handoff },
            },
            routeLoading: { kind: 'idle' },
          });
          return;
        }
        store.setState({
          session: { phase: 'routeReady', ...trip, routes: response.routes, selectedRouteIndex: 0 },
          routeLoading: { kind: 'idle' },
        });
      } catch (error) {
        if (attempt !== planAttempt || isAbortError(error)) return;
        planning = undefined;
        const providerError =
          error instanceof RouteProviderError
            ? error
            : new RouteProviderError('unavailable', provider.id, error instanceof Error ? error.message : 'route request failed');
        const reason = failureKind(providerError);
        store.setState({
          session: { phase: 'error', trip, error: { kind: 'route-failed', reason, message: providerError.message } },
          routeLoading: { kind: 'failed', purpose: 'initial', reason, message: providerError.message },
        });
      }
    },

    selectRoute(index) {
      const session = get().session;
      if (session.phase !== 'routeReady' || !Number.isInteger(index) || !session.routes[index]) return false;
      setSession({ ...session, selectedRouteIndex: index });
      return true;
    },

    start() {
      const session = get().session;
      if (session.phase !== 'routeReady') return false;
      const { routes, selectedRouteIndex, phase: _phase, ...trip } = session;
      const route = routes[selectedRouteIndex]!;
      const alternatives = routes.filter((_, i) => i !== selectedRouteIndex);
      if (pipelineMode !== trip.mode) {
        // The speed gate depends on the mode; fixes gathered while planning
        // keep their filter state when the mode is unchanged.
        pipelineMode = trip.mode;
        pipeline = createLocationPipeline(config.location, trip.mode);
      }
      tracking = undefined;
      beginTracking(trip, route);
      const active: ActiveTrip = {
        ...trip,
        activeRoute: { route, alternatives, generation: 1, receivedAtMs: now() },
        deviation: { kind: 'on-route' },
        arrival: { kind: 'en-route', distanceM: Number.POSITIVE_INFINITY },
        reroute: { kind: 'idle' },
      };
      store.setState({ session: { phase: 'navigating', ...active }, progress: { kind: 'none' } });
      return true;
    },

    enterAR() {
      const session = get().session;
      if (session.phase !== 'navigating') return false;
      setSession({ ...session, phase: 'calibratingAR' });
      return true;
    },

    completeARCalibration() {
      const session = get().session;
      if (session.phase !== 'calibratingAR') return false;
      setSession({ ...session, phase: 'navigatingAR' });
      return true;
    },

    exitAR() {
      const session = get().session;
      if (session.phase === 'calibratingAR' || session.phase === 'navigatingAR') {
        setSession({ ...session, phase: 'navigating' });
        store.setState({ arTracking: { kind: 'off' } });
        return true;
      }
      if ((session.phase === 'rerouting' || session.phase === 'paused') && session.resumePhase !== 'navigating') {
        setSession({ ...session, resumePhase: 'navigating' });
        store.setState({ arTracking: { kind: 'off' } });
        return true;
      }
      return false;
    },

    setArTracking(state) {
      store.setState({ arTracking: state });
      const session = get().session;
      // Losing tracking mid-guidance sends the AR view back to calibration;
      // an unavailable AR session leaves AR entirely.
      if (state.kind === 'unavailable') controller.exitAR();
      else if (state.kind === 'limited' && state.reason === 'relocalizing' && session.phase === 'navigatingAR') {
        setSession({ ...session, phase: 'calibratingAR' });
      }
    },

    pause() {
      const session = get().session;
      if (session.phase !== 'navigating' && session.phase !== 'calibratingAR' && session.phase !== 'navigatingAR') return false;
      reroute.cancel();
      setSession({ ...session, phase: 'paused', resumePhase: session.phase });
      return true;
    },

    resume() {
      const session = get().session;
      if (session.phase !== 'paused') return false;
      const { resumePhase, ...trip } = session;
      setSession({ ...trip, phase: resumePhase });
      return true;
    },

    reroute() {
      return requestReroute('manual');
    },

    ingestFix(fix) {
      const result = pipeline.ingest(fix, now());
      if (result.kind === 'rejected') {
        fixStore.setState({ lastFix: result });
        controller.refreshPositioning();
        return;
      }
      const filtered = result.filtered;
      const tooFastSince = pipeline.tooFastSinceMs;
      updatePositioning({
        kind: 'tracking',
        confidence: filtered.confidence,
        sigmaM: Math.round(filtered.sigmaM / config.location.radiusToSigma),
        isMovingTooFast: tooFastSince !== undefined && filtered.timestampMs - tooFastSince >= config.location.tooFastDurationMs,
      });

      const session = get().session;
      if (!tracking || !hasTrip(session) || !GUIDING_PHASES.has(session.phase)) {
        fixStore.setState({ lastFix: result });
        return;
      }
      if (result.didReset) tracking.matcher.resetContinuity();
      const match = tracking.matcher.match(filtered, movementHeading(filtered), fix.accuracy.horizontalM);
      fixStore.setState({ lastFix: result, match });

      if (match.kind === 'matched') {
        const progress = computeRouteProgress(tracking.steps, match);
        const previous = get().progress;
        const changed =
          previous.kind !== 'tracking' ||
          previous.progress.routeId !== progress.routeId ||
          previous.progress.activeStepIndex !== progress.activeStepIndex ||
          Math.round(previous.progress.distanceRemainingM) !== Math.round(progress.distanceRemainingM);
        if (changed) store.setState({ progress: { kind: 'tracking', progress } });
      }

      const deviation = tracking.offRoute.observe({ fix, filtered, match });
      const arrival = tracking.arrival.observe(fix, filtered);
      const latest = get().session;
      if (!hasTrip(latest)) return;

      if (arrival.kind === 'arrived') {
        reroute.cancel();
        const base = latest.phase === 'rerouting' || latest.phase === 'paused' ? stripResume(latest) : latest;
        setSession({ ...base, phase: 'arrived', arrival, deviation: { kind: 'on-route' }, reroute: { kind: 'idle' } });
        store.setState({ routeLoading: { kind: 'idle' } });
        return;
      }

      // Only kind changes reach the session, so per-fix counters do not re-render screens.
      if (latest.deviation.kind !== deviation.kind || latest.arrival.kind !== arrival.kind) {
        setSession({ ...latest, deviation, arrival });
      }
      if ((deviation.kind === 'off-route' || deviation.kind === 'wrong-direction') && latest.phase !== 'rerouting') {
        requestReroute(deviation.kind);
      }
    },

    ingestHeading(sample) {
      const estimate = headingSmoother.add(sample);
      if (estimate) fixStore.setState({ heading: estimate });
    },

    refreshPositioning() {
      const latest = pipeline.latest;
      if (!latest) return;
      if (now() - latest.timestampMs > config.location.lostAfterMs) {
        if (get().positioning.kind !== 'lost') updatePositioning({ kind: 'lost', sinceMs: latest.timestampMs });
      }
    },

    cancel() {
      teardown();
      pipeline.reset();
      headingSmoother.reset();
      store.setState(INITIAL_NAVIGATION_STATE, true);
      fixStore.setState(INITIAL_FIX_STATE, true);
    },
  };

  function teardown() {
    planning?.abort();
    planning = undefined;
    planAttempt += 1;
    reroute.cancel();
    tracking = undefined;
  }

  return controller;
}


function stripResume<T extends { resumePhase: ResumablePhase }>(session: T): Omit<T, 'resumePhase'> {
  const { resumePhase: _resume, ...rest } = session;
  return rest;
}
