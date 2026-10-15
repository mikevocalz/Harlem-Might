import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createJourneyCueTracker, verifiedArrival } from './cues.ts';
import type { NavigationFixState, NavigationState } from '../navigation/session/navigationStore.ts';
import { fixtureRoute, fixtureDestination } from '../navigation/testing/fixtures.ts';
const now = 1800000000000;
const route = fixtureRoute('apollo-theater--sylvias-restaurant');
const state = { session: { phase: 'navigating', origin: { kind: 'device-location' }, destination: fixtureDestination('apollo-theater--sylvias-restaurant', false), mode: 'walking', activeRoute: { route, generation: 1, receivedAtMs: now }, deviation: { kind: 'on-route' }, arrival: { kind: 'en-route', distanceM: 100 }, reroute: { kind: 'idle' } }, positioning: { kind: 'tracking', confidence: 'high', horizontalRadius68M: 3, isMovingTooFast: false }, progress: { kind: 'tracking', progress: { routeId: route.id, timestampMs: now, nextManeuver: { type: 'turn' }, activeStepIndex: 2, distanceToNextManeuverM: 20 } }, routeLoading: { kind: 'idle' }, arTracking: { kind: 'off' } } as NavigationState;
const fixes = { lastFix: { kind: 'accepted', fix: { source: 'device-gps', timestampMs: now, accuracy: { horizontalM: 5 } }, filtered: { coordinate: fixtureDestination('apollo-theater--sylvias-restaurant', false).coordinate } }, match: { kind: 'matched' } } as NavigationFixState;
const stopSlug = 'destination' in state.session ? state.session.destination.placeId! : '';
const input = { sessionId: 'session', stopSlug, active: true, enabled: true, foreground: true, state, fixes, location: 'granted' as const, online: true, now };
it('emits a verified approaching-turn once, never on stale/wrong-stop/offline input', () => {
  const track = createJourneyCueTracker();
  assert.deepEqual(track({ ...input, now: now + 120000 }), []);
  assert.deepEqual(track({ ...input, stopSlug: 'other' }), []);
  assert.deepEqual(track({ ...input, online: false }), []);
  assert.deepEqual(track(input), ['approachingTurn']); assert.deepEqual(track(input), []);
});
it('honors opt-out and does not replay a passed cue when enabled later', () => {
  const track = createJourneyCueTracker(); assert.deepEqual(track({ ...input, enabled: false }), []); assert.deepEqual(track(input), []);
});
it('confirmed arrival is advisory and requires current same-stop precise GPS', () => {
  const arrived = { ...state, session: { ...state.session, phase: 'arrived', arrival: { kind: 'arrived', confidence: 'confirmed', arrivedAtMs: now } } } as NavigationState;
  assert.equal(verifiedArrival({ state: arrived, fixes, now, stopSlug, location: 'granted', online: true }), true);
  assert.equal(verifiedArrival({ state: arrived, fixes, now, stopSlug, location: 'denied', online: true }), false);
  assert.equal(verifiedArrival({ state: arrived, fixes, now: now + 120000, stopSlug, location: 'granted', online: true }), false);
  const laterFixes = { ...fixes, lastFix: { ...fixes.lastFix!, fix: { ...fixes.lastFix!.fix, timestampMs: now + 60000 } } } as NavigationFixState;
  assert.equal(verifiedArrival({ state: arrived, fixes: laterFixes, now: now + 60000, stopSlug, location: 'granted', online: true }), true);
  const far = { ...laterFixes, lastFix: { ...laterFixes.lastFix!, filtered: { coordinate: { latitude: 0, longitude: 0 } } } } as NavigationFixState;
  assert.equal(verifiedArrival({ state: arrived, fixes: far, now: now + 60000, stopSlug, location: 'granted', online: true }), false);
  const track = createJourneyCueTracker(); assert.deepEqual(track({ ...input, state: arrived }), ['arrived']); assert.deepEqual(track({ ...input, state: arrived }), []);
});
it('emits route change only after an observed reroute has fresh matched progress', () => {
  const track = createJourneyCueTracker(); track(input);
  const rerouted = { ...state, session: { ...state.session, activeRoute: { route: { ...route, id: 'new-route' }, generation: 2, receivedAtMs: now } }, progress: { kind: 'tracking', progress: { ...(state.progress.kind === 'tracking' ? state.progress.progress : {}), routeId: 'new-route', distanceToNextManeuverM: 100 } } } as NavigationState;
  assert.deepEqual(track({ ...input, state: rerouted, now: now + 120000 }), []);
  assert.deepEqual(track({ ...input, state: rerouted }), ['routeChanged']);
});
