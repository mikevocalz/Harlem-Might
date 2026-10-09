import type { GeographicCoordinate } from '../model/geo.ts';
import type { RouteDestination, TravelMode } from '../model/route.ts';
import type { NavigationOrigin } from '../model/session.ts';
import { buildExternalMapsHandoff } from '../providers/externalMaps.ts';
import { createMapboxDirectionsProvider } from '../providers/mapboxDirections.ts';
import { mapboxTokenFromEnv } from '../providers/mapboxToken.ts';
import { RouteProviderError, type RouteProvider } from '../providers/routeProvider.ts';
import { createNavigationController, type NavigationController } from '../session/navigationController.ts';
import { hasActiveTrip } from '../model/session.ts';
import { navigationFixStore, useNavigationStore, type NavigationFixState } from '../session/navigationStore.ts';
import { NO_LOCATION_SOURCE, type LocationSource } from './locationSource.ts';
import { useNavigationUi, type OriginChoice } from './navigationUi.store.ts';

/**
 * The one navigation controller per app, shared by the map, the directions
 * sheet, the HUD and (Phase 3) the AR view. Screens never construct their
 * own: two controllers would write two sessions into one store.
 *
 * Hosts call {@linkcode configureNavigationRuntime} once at startup with
 * their platform's location source; everything else is lazy.
 */
interface Runtime {
  controller: NavigationController | undefined;
  provider: RouteProvider | undefined;
  source: LocationSource;
  stopWatch: (() => void) | undefined;
  tick: ReturnType<typeof setInterval> | undefined;
}

const runtime: Runtime = { controller: undefined, provider: undefined, source: NO_LOCATION_SOURCE, stopWatch: undefined, tick: undefined };

/**
 * A provider for builds without a usable Mapbox token. Transit still gets
 * its honest handoff; every other mode fails with the token reason, which
 * the directions panel words as "Directions are off in this build".
 */
export function createUnconfiguredProvider(reason: 'missing-token' | 'unauthorized'): RouteProvider {
  return {
    id: 'mapbox',
    supportedModes: [],
    async getRoutes(request) {
      if (request.mode === 'transit') {
        return {
          kind: 'unsupported',
          mode: 'transit',
          reason: 'No provider here routes public transit.',
          handoff: buildExternalMapsHandoff(request),
        };
      }
      throw new RouteProviderError(
        reason,
        'mapbox',
        reason === 'missing-token' ? 'No Mapbox token in this build' : 'The Mapbox token is not a public pk. token',
      );
    },
  };
}

function defaultProvider(): RouteProvider {
  const token = mapboxTokenFromEnv();
  if (token.kind === 'public') return createMapboxDirectionsProvider({ accessToken: token.token });
  return createUnconfiguredProvider(token.kind === 'missing' ? 'missing-token' : 'unauthorized');
}

/** Sets the platform pieces. Call once, before the first screen reads the controller. */
export function configureNavigationRuntime(options: { readonly locationSource?: LocationSource; readonly provider?: RouteProvider }): void {
  if (options.locationSource) {
    stopLocation();
    runtime.source = options.locationSource;
    void runtime.source.check().then((availability) => {
      // A watch that already reported wins over a slower permission query.
      if (useNavigationUi.getState().location === 'unknown') useNavigationUi.getState().setLocation(availability);
    });
  }
  if (options.provider) {
    runtime.controller?.cancel();
    runtime.controller = undefined;
    runtime.provider = options.provider;
  }
}

/** The shared controller, created on first use. */
export function navigationController(): NavigationController {
  runtime.controller ??= createNavigationController({ provider: runtime.provider ?? defaultProvider() });
  return runtime.controller;
}

/** The location source the host configured. */
export function locationSource(): LocationSource {
  return runtime.source;
}

/**
 * Starts the foreground position feed into the controller (this may show the
 * platform prompt) and a 1 Hz positioning check that turns a silent feed
 * into `lost`. Idempotent. Positions go to the controller and nowhere else.
 */
export function startLocation(): void {
  if (runtime.stopWatch) return;
  const controller = navigationController();
  const ui = useNavigationUi.getState();
  runtime.stopWatch = runtime.source.watch({
    onFix: (fix) => controller.ingestFix(fix),
    onAvailability: (availability) => ui.setLocation(availability),
  });
  runtime.tick = setInterval(() => controller.refreshPositioning(), 1000);
}

/** Stops the feed. Hosts call it when the app or tab goes to the background, and on End. */
export function stopLocation(): void {
  runtime.stopWatch?.();
  runtime.stopWatch = undefined;
  if (runtime.tick !== undefined) clearInterval(runtime.tick);
  runtime.tick = undefined;
}

/** True while the position feed runs. */
export function isLocationRunning(): boolean {
  return runtime.stopWatch !== undefined;
}

/**
 * The device position to start a route from: the latest fix the pipeline
 * accepted, or one it rejected only for being coarse (an approximate start is
 * still a real start; guidance will ignore such fixes). Stale, invalid and
 * outlier fixes never start a route.
 */
export function devicePositionForPlanning(fixes: Pick<NavigationFixState, 'lastFix'>): GeographicCoordinate | undefined {
  const last = fixes.lastFix;
  if (!last) return undefined;
  if (last.kind === 'accepted') return last.filtered.coordinate;
  return last.reason === 'inaccurate' ? last.fix.coordinate : undefined;
}

/** A place someone can start from, when they choose one instead of their location. */
export interface OriginPlace {
  readonly id: string;
  readonly name: string;
  readonly coordinate: GeographicCoordinate;
}

/**
 * Asks for routes from the chosen origin. Returns false when the origin is
 * not known yet (no fix, or a place without coordinates); the panel keeps
 * its button disabled in that case, so this is a guard, not a flow.
 */
export function requestDirections(input: {
  readonly destination: RouteDestination;
  readonly mode: TravelMode;
  readonly originChoice: OriginChoice;
  readonly originPlace?: OriginPlace;
}): boolean {
  let origin: NavigationOrigin;
  let originCoordinate: GeographicCoordinate | undefined;
  if (input.originChoice.kind === 'place') {
    if (!input.originPlace) return false;
    origin = { kind: 'manual', coordinate: input.originPlace.coordinate, label: input.originPlace.name };
    originCoordinate = input.originPlace.coordinate;
  } else {
    origin = { kind: 'device-location' };
    originCoordinate = devicePositionForPlanning(navigationFixStore.getState());
  }
  if (!originCoordinate) return false;
  void navigationController().planRoute({ origin, originCoordinate, destination: input.destination, mode: input.mode });
  return true;
}

/**
 * Opens the directions panel for a place. Puts the session in
 * `selectingDestination` unless a trip is already under way (one trip at a
 * time; the panel then says so). Starts the location feed only when access
 * was already granted: a first prompt waits for "Use my location".
 */
export function openDirections(placeId: string): void {
  const ui = useNavigationUi.getState();
  ui.openDirections(placeId);
  if (!hasActiveTrip(useNavigationStore.getState().session)) navigationController().beginSelection({ kind: 'device-location' });
  if (ui.location === 'granted' || ui.location === 'approximate') startLocation();
}

/**
 * Closes the panel. Planning is abandoned (session back to idle, feed
 * stopped); a trip under way is left running, because closing the step
 * list on a phone only uncovers the map.
 */
export function closeDirections(): void {
  if (!hasActiveTrip(useNavigationStore.getState().session)) {
    runtime.controller?.cancel();
    stopLocation();
  }
  useNavigationUi.getState().closeDirections();
}

/** Starts guidance on the selected route; the feed runs when the trip starts from the device. */
export function startGuidance(): boolean {
  const controller = navigationController();
  const session = useNavigationStore.getState().session;
  if (!controller.start()) return false;
  const ui = useNavigationUi.getState();
  ui.setStepsOpen(false);
  ui.setFollowUser(true);
  if (session.phase === 'routeReady' && session.origin.kind === 'device-location') startLocation();
  return true;
}

/**
 * Ends the trip everywhere: cancels requests, resets the session to idle,
 * stops the location feed and clears trip choices. The map line, the HUD
 * and any AR view all read the same store, so they clear in the same commit.
 */
export function endNavigation(): void {
  runtime.controller?.cancel();
  stopLocation();
  useNavigationUi.getState().resetTrip();
}

/** Test-only: drops the controller and source so each test starts clean. */
export function resetNavigationRuntimeForTests(): void {
  stopLocation();
  runtime.controller?.cancel();
  runtime.controller = undefined;
  runtime.provider = undefined;
  runtime.source = NO_LOCATION_SOURCE;
}
