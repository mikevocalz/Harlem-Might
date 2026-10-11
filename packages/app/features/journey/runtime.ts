import { AppState } from 'react-native';
import { useNavigationUi } from '../navigation/view/navigationUi.store.ts';
import { createContentReaders } from '../../content/readers.ts';
import type { ContentReaders } from '../../content/readers.ts';
import { createRestContentSource } from '../../content/rest-source.ts';
import { useMemberAuth } from '../auth/member-auth.store.ts';
import { haptics } from '@acme/ui/haptics';
import type { WalkCommand } from '@acme/widgets';
import { createJourneyController, commandId, type JourneyTransport } from './controller.ts';
import { journeyStorage } from './storage';
import { createMemberJourneyTransport } from './member-transport.ts';
import { applyJourneyNavigationCommand } from './navigation-effects.ts';
import { createJourneyCueTracker } from './cues.ts';
import { startJourneyRouteIntent, type JourneyRouteIdentity } from './route-intent.ts';
import { synopsisFromRoute, verifiedDestination } from './model.ts';
import { endNavigation, isLocationRunning, navigationController, requestDirections, startLocation, stopLocation } from '../navigation/view/runtime.ts';
import { navigationFixStore, useNavigationStore } from '../navigation/session/navigationStore.ts';

let configured: { readers: ContentReaders; transport?: JourneyTransport } | undefined;
let controller: ReturnType<typeof createJourneyController> | undefined;
let routeCleanup: (() => void) | undefined;
const cancelRouteIntent = () => { routeCleanup?.(); routeCleanup = undefined; };

/** Host data binding only. Native deliberately supplies no member transport until secure native auth exists. */
export function configureJourneyRuntime(options: { readers: ContentReaders; transport?: JourneyTransport }): void {
  if (controller) {
    if (configured?.readers === options.readers && configured?.transport === options.transport) return;
    throw new Error('Configure the walk journey before first use.');
  }
  configured = options;
}
export function journeyController() {
  if (controller) return controller;
  const readers = configured?.readers ?? createContentReaders(createRestContentSource({ apiUrl: '/payload-api', fetch: (url, init) => fetch(url, init) }));
  controller = createJourneyController({
    readers, storage: journeyStorage,
    transport: configured ? configured.transport : createMemberJourneyTransport(),
    onClear() {
      cancelRouteIntent();
      const active = useNavigationStore.getState().session;
      if ('destination' in active && controller?.getSnapshot().plan?.stops.some(stop => stop.slug === active.destination.placeId)) endNavigation();
    },
    onTransition(previous, session, command) {
      cancelRouteIntent();
      const active = useNavigationStore.getState().session;
      const target = controller?.getSnapshot().plan?.stops[previous?.completedStopIds.length ?? 0]?.slug;
      const navigation = navigationController();
      applyJourneyNavigationCommand({ type: command.type, targetSlug: target, session: active,
        foreground: AppState.currentState === 'active', location: useNavigationUi.getState().location,
        pause: navigation.pause, resume: navigation.resume, end: endNavigation, startLocation, stopLocation });
      if (!controller?.getSnapshot().hapticsEnabled) return;
      if (!previous) haptics.walkStarted();
      else if (command.type === 'confirm-stop') {
        haptics.stopConfirmed();
        if (session.status === 'completed') haptics.tourCompleted();
      }
    },
  });
  // Account changes clear private UI on every platform, before any login request.
  useMemberAuth.subscribe((state, previous) => { if (state.pending && !previous.pending) { endNavigation(); controller?.clear(); } });
  // Save only route synopsis, never the route geometry or raw sensor feed.
  let routeId: string | undefined;
  const cues = createJourneyCueTracker();
  useNavigationStore.subscribe(state => {
    const session = controller!.getSnapshot().session;
    const stop = currentJourneyStop();
    if (session && stop) {
      const ui = useNavigationUi.getState();
      for (const cue of cues({ sessionId: session.sessionId, stopSlug: stop.slug, active: session.status === 'active', enabled: controller!.getSnapshot().hapticsEnabled, foreground: AppState.currentState === 'active', state, fixes: navigationFixStore.getState(), location: ui.location, online: ui.online, now: Date.now() })) haptics[cue]();
    }
    if (!session || !stop || !('destination' in state.session) || state.session.destination.placeId !== stop.slug) return;
    const route = state.session.phase === 'routeReady' ? state.session.routes[state.session.selectedRouteIndex] : 'activeRoute' in state.session ? state.session.activeRoute.route : undefined;
    const key = route ? `${session.sessionId}:${stop.id}:${route.id}` : undefined;
    if (!route || key === routeId) return;
    routeId = key;
    controller!.cacheRoute(synopsisFromRoute(route, stop.id));
  });
  return controller;
}
export function currentJourneyStop() {
  const state = journeyController().getSnapshot();
  if (!state.session || state.session.status === 'stopped' || state.session.status === 'completed') return undefined;
  return state.plan?.stops[state.session.completedStopIds.length];
}
function currentRouteIdentity(): JourneyRouteIdentity | undefined {
  const session = journeyController().getSnapshot().session;
  const stop = currentJourneyStop();
  if (session?.status !== 'active' || !stop) return undefined;
  return { sessionId: session.sessionId, revision: session.revision, stopId: stop.id, stopSlug: stop.slug };
}
export function journeyCommand(type: 'pause' | 'resume' | 'stop' | 'confirm-stop', confirmed?: true) {
  const state = journeyController().getSnapshot();
  const session = state.session;
  if (!session) return Promise.resolve(false);
  const base = { schemaVersion: 1 as const, commandId: commandId(), sessionId: session.sessionId, expectedRevision: session.revision };
  const command: WalkCommand = type === 'confirm-stop'
    ? { ...base, type, confirmed: confirmed!, stopId: currentJourneyStop()?.id ?? '' }
    : type === 'stop' ? { ...base, type, confirmed: confirmed! } : { ...base, type };
  return journeyController().dispatch(command);
}

/** Opt-in starts foreground location. The first precise fresh fix plans via the existing shared provider. */
export function requestJourneyDirections(): void {
  cancelRouteIntent();
  const journey = journeyController();
  const state = journey.getSnapshot();
  const stop = currentJourneyStop();
  const destination = state.place && verifiedDestination(state.place);
  const identity = currentRouteIdentity();
  if (!stop || !identity) return;
  if (!destination || state.place?.slug !== stop.slug) {
    journey.setError('We need a freshly checked, sourced location for this stop. You can still read the walk and confirm a visit yourself.'); return;
  }
  const active = useNavigationStore.getState().session;
  if ('destination' in active && active.destination.placeId !== stop.slug) {
    journey.setError('End the other trip before getting directions to this stop.'); return;
  }
  journey.setError(null);
  routeCleanup = startJourneyRouteIntent({
    identity, getJourney: currentRouteIdentity,
    getNavigation: () => useNavigationStore.getState().session,
    getDirectionsPlaceId: () => useNavigationUi.getState().directionsPlaceId,
    getLastFix: () => navigationFixStore.getState().lastFix,
    getLocation: () => useNavigationUi.getState().location,
    isLocationRunning, startLocation, stopLocation,
    subscribe(listener) {
      const fix = navigationFixStore.subscribe(listener);
      const trip = useNavigationStore.subscribe(listener);
      const selection = useNavigationUi.subscribe(listener);
      return () => { fix(); trip(); selection(); };
    },
    reroute: () => navigationController().reroute(),
    request: () => requestDirections({ destination, mode: 'walking', originChoice: { kind: 'device' } }),
    setError: message => journey.setError(message),
  });
}
