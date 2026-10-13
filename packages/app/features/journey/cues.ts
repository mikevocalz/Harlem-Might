import { distanceM } from '../navigation/geo/localFrame.ts';
import { arrivalTarget } from '../navigation/model/route.ts';
import { DEFAULT_NAVIGATION_CONFIG } from '../navigation/config.ts';
import { liveProgress, type JourneyNavigationEvidence } from './model.ts';

export function verifiedArrival({ state, fixes, now, stopSlug, location, online }: JourneyNavigationEvidence): boolean {
  const session = state.session;
  const last = fixes.lastFix;
  if (online === false || location !== 'granted' || session.phase !== 'arrived' || session.destination.placeId !== stopSlug || session.origin.kind !== 'device-location' ||
      session.arrival.kind !== 'arrived' || session.arrival.confidence !== 'confirmed' || last?.kind !== 'accepted' || last.fix.source !== 'device-gps' ||
      state.positioning.kind !== 'tracking' || state.positioning.confidence === 'low' || state.positioning.isMovingTooFast) return false;
  return now >= last.fix.timestampMs && now - last.fix.timestampMs <= DEFAULT_NAVIGATION_CONFIG.location.maxFixAgeMs &&
    last.fix.accuracy.horizontalM <= DEFAULT_NAVIGATION_CONFIG.arrival.confirmAccuracyM &&
    distanceM(last.filtered.coordinate, arrivalTarget(session.destination)) <= DEFAULT_NAVIGATION_CONFIG.arrival.arriveRadiusM + Math.min(last.fix.accuracy.horizontalM, DEFAULT_NAVIGATION_CONFIG.arrival.accuracyAllowanceCapM);
}
export type JourneyCue = 'approachingTurn' | 'arrived' | 'routeChanged';
/** No timers or background loops. Events are deduplicated on actual route/stop transitions. */
export function createJourneyCueTracker() {
  let sessionId = '';
  let generation: number | undefined;
  const emitted = new Set<string>();
  return (input: JourneyNavigationEvidence & { sessionId: string; active: boolean; enabled: boolean; foreground: boolean }): JourneyCue[] => {
    const context = `${input.sessionId}:${input.stopSlug}`;
    if (context !== sessionId) { sessionId = context; generation = undefined; emitted.clear(); }
    const cues: JourneyCue[] = [];
    const emit = (cue: JourneyCue, key: string) => { if (emitted.has(key)) return; emitted.add(key); if (input.enabled && input.foreground && input.active) cues.push(cue); };
    const { session } = input.state;
    const live = input.active ? liveProgress(input) : undefined;
    if ('activeRoute' in session && session.destination.placeId === input.stopSlug) {
      const current = session.activeRoute.generation;
      if (generation === undefined) generation = current;
      if (live && current > generation) { emit('routeChanged', `route:${session.activeRoute.route.id}`); generation = current; }
      if (live?.nextManeuver && live.nextManeuver.type !== 'arrive' && live.distanceToNextManeuverM > 0 && live.distanceToNextManeuverM <= 30) {
        emit('approachingTurn', `turn:${session.activeRoute.route.id}:${live.activeStepIndex}`);
      }
      if (verifiedArrival(input)) {
        emit('arrived', `arrival:${session.activeRoute.route.id}`);
      }
    }
    return cues;
  };
}
