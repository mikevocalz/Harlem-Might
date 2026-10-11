import { DEFAULT_NAVIGATION_CONFIG } from '../navigation/config.ts';
import type { NavigationSession } from '../navigation/model/session.ts';
import type { NavigationFixState } from '../navigation/session/navigationStore.ts';
import type { LocationAvailability } from '../navigation/view/locationSource.ts';

export interface JourneyRouteIdentity {
  sessionId: string;
  revision: number;
  stopId: string;
  stopSlug: string;
}

/** Pending GPS belongs to this request until a device-origin trip takes over. */
function tripOwnsLocation(session: NavigationSession): boolean {
  return 'destination' in session && session.origin.kind === 'device-location' && session.phase !== 'paused';
}

/** Wait for a new fix without retaining permission to route a superseded walk or trip. */
export function startJourneyRouteIntent(input: {
  identity: JourneyRouteIdentity;
  getJourney(): JourneyRouteIdentity | undefined;
  getNavigation(): NavigationSession;
  getLastFix(): NavigationFixState['lastFix'];
  getLocation(): LocationAvailability;
  isLocationRunning(): boolean;
  startLocation(): void;
  stopLocation(): void;
  subscribe(listener: () => void): () => void;
  request(): boolean;
  reroute(): boolean;
  setError(message: string): void;
  now?: () => number;
  timeout?: (callback: () => void, milliseconds: number) => () => void;
}): () => void {
  const now = input.now ?? Date.now;
  const requestedAt = now();
  let done = false;
  let planning = false;
  let ownsFeed = false;
  let unsubscribe = () => {};
  let clearTimeout = () => {};
  const finish = (transferred = false) => {
    if (done) return;
    done = true;
    unsubscribe(); clearTimeout();
    if (ownsFeed && !transferred && !tripOwnsLocation(input.getNavigation())) input.stopLocation();
    ownsFeed = false;
  };
  const cancel = (message: string) => { finish(); input.setError(message); };
  const tryPlan = () => {
    if (done || planning) return;
    const current = input.getJourney();
    const captured = input.identity;
    if (!current || current.sessionId !== captured.sessionId || current.revision !== captured.revision || current.stopId !== captured.stopId || current.stopSlug !== captured.stopSlug) {
      cancel('This walk or stop changed while location was loading. Choose directions again for the current stop.'); return;
    }
    const trip = input.getNavigation();
    const destination = 'destination' in trip ? trip.destination : trip.phase === 'error' ? trip.trip?.destination : undefined;
    if (destination && destination.placeId !== captured.stopSlug) {
      cancel('Another trip was opened while location was loading. End that trip before getting directions to this stop.'); return;
    }
    const last = input.getLastFix();
    const timestamp = now();
    if (input.getLocation() !== 'granted' || last?.kind !== 'accepted' || last.fix.timestampMs < requestedAt || last.fix.source !== 'device-gps' ||
        last.fix.accuracy.horizontalM > DEFAULT_NAVIGATION_CONFIG.matching.maxSnapAccuracyM || timestamp - last.fix.timestampMs > DEFAULT_NAVIGATION_CONFIG.location.maxFixAgeMs || timestamp < last.fix.timestampMs) return;
    // No asynchronous boundary between identity/destination validation and the
    // command. Ignore synchronous store notifications from our own route action.
    planning = true;
    const requested = 'activeRoute' in trip && trip.destination.placeId === captured.stopSlug && trip.phase !== 'arrived' && trip.phase !== 'paused'
      ? input.reroute() : input.request();
    planning = false;
    if (requested) finish(true);
  };
  unsubscribe = input.subscribe(tryPlan);
  const timeout = input.timeout ?? ((callback, milliseconds) => { const timer = setTimeout(callback, milliseconds); return () => globalThis.clearTimeout(timer); });
  clearTimeout = timeout(() => {
    if (!done) cancel('No precise, recent location yet. Check location access and try again. The saved walk remains available.');
  }, 25_000);
  ownsFeed = !input.isLocationRunning();
  input.startLocation();
  tryPlan();
  return () => finish();
}
