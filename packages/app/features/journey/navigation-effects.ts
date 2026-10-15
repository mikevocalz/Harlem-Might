import type { NavigationSession } from '../navigation/model/session.ts';
import type { LocationAvailability } from '../navigation/view/locationSource.ts';

/** Apply tour controls only to its current leg, never an unrelated Explore trip. */
export function applyJourneyNavigationCommand(input: {
  type: string;
  targetSlug: string | undefined;
  session: NavigationSession;
  foreground: boolean;
  location: LocationAvailability;
  pause(): boolean;
  resume(): boolean;
  end(): void;
  startLocation(): void;
  stopLocation(): void;
}): void {
  const active = input.session;
  const destination = 'destination' in active ? active.destination : active.phase === 'error' ? active.trip?.destination : undefined;
  if (!destination || destination.placeId !== input.targetSlug) return;
  if (input.type === 'pause') {
    // A pending route/reroute has no pausable route state. Cancel its request;
    // retain the tour's synopsis so Resume can request a fresh route.
    if (!input.pause()) input.end();
    input.stopLocation();
  }
  if (input.type === 'resume') {
    // An approximate fix is still an authorized feed. Restart it so a later
    // precise sample can recover guidance, just as the directions UI does.
    if (input.resume() && input.foreground && 'activeRoute' in active
      && active.origin.kind === 'device-location'
      && (input.location === 'granted' || input.location === 'approximate')) input.startLocation();
  }
  if (input.type === 'stop' || input.type === 'confirm-stop') input.end();
}
