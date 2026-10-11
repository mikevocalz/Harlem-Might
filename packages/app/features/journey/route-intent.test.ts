import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { NavigationSession } from '../navigation/model/session.ts';
import type { NavigationFixState } from '../navigation/session/navigationStore.ts';
import { applyJourneyNavigationCommand } from './navigation-effects.ts';
import { startJourneyRouteIntent, type JourneyRouteIdentity } from './route-intent.ts';

const now = 1800000000000;
const identity: JourneyRouteIdentity = { sessionId: 'session', revision: 2, stopId: '1', stopSlug: 'apollo' };
const fix = { kind: 'accepted', fix: { source: 'device-gps', timestampMs: now, accuracy: { horizontalM: 5 } } } as NavigationFixState['lastFix'];
const trip = (placeId = 'apollo', kind = 'device-location', phase = 'navigating') => ({
  phase, destination: { placeId }, origin: { kind }, ...(phase === 'navigating' ? { activeRoute: {} } : {}),
}) as NavigationSession;

function setup(running = false, initialSelection: string | null = null) {
  let journey: JourneyRouteIdentity | undefined = identity;
  let navigation: NavigationSession = { phase: 'idle' };
  let lastFix: NavigationFixState['lastFix'];
  let location: 'granted' | 'denied' = 'granted';
  let selection = initialSelection;
  const calls: string[] = [];
  const errors: string[] = [];
  const listeners = new Set<() => void>();
  let tick = () => {};
  let expired = false;
  let staleListener = () => {};
  const cancel = startJourneyRouteIntent({
    identity, getJourney: () => journey, getNavigation: () => navigation,
    getDirectionsPlaceId: () => selection,
    getLastFix: () => lastFix, getLocation: () => location, now: () => now,
    isLocationRunning: () => running,
    startLocation() { calls.push('start'); running = true; },
    stopLocation() { calls.push('stop'); running = false; },
    subscribe(listener) { staleListener = listener; listeners.add(listener); return () => { listeners.delete(listener); }; },
    timeout(callback) { tick = callback; return () => { expired = true; }; },
    request() { calls.push('request'); navigation = trip('apollo', 'device-location', 'calculatingRoute'); for (const listener of listeners) listener(); return true; },
    reroute() { calls.push('reroute'); for (const listener of listeners) listener(); return true; },
    setError(message) { errors.push(message); },
  });
  return {
    calls, errors, cancel,
    navigation(value: NavigationSession) { navigation = value; },
    selection(value: string | null) { selection = value; },
    journey(value: JourneyRouteIdentity | undefined) { journey = value; },
    fix(value = fix) { lastFix = value; },
    denied() { location = 'denied'; },
    emit() { for (const listener of listeners) listener(); },
    expire() { tick(); },
    lateNotification() { staleListener(); },
    listeners: () => listeners.size, timeoutCleared: () => expired,
  };
}

it('pause, stop and clear release a pending feed before its first fix, even with an idle navigation session', () => {
  for (const type of ['pause', 'stop', 'clear']) {
    const test = setup();
    test.cancel(); // The shared runtime cancels before all three effects.
    applyJourneyNavigationCommand({ type, targetSlug: identity.stopSlug, session: { phase: 'idle' }, foreground: true, location: 'granted',
      pause: () => { throw new Error('No route exists to pause'); }, resume: () => false, end: () => {}, startLocation: () => {}, stopLocation: () => { test.calls.push('extra-stop'); } });
    assert.deepEqual(test.calls, ['start', 'stop'], type);
    assert.equal(test.listeners(), 0); assert.equal(test.timeoutCleared(), true);
    test.fix(); test.lateNotification(); test.expire(); test.cancel();
    assert.deepEqual(test.calls, ['start', 'stop']); assert.deepEqual(test.errors, []);
  }
});

it('a newer Explore destination cancels the waiting request and keeps the new device trip feed', () => {
  const test = setup();
  test.navigation(trip('new-explore-place')); test.emit();
  assert.equal(test.errors.length, 1); assert.match(test.errors[0]!, /Another trip/);
  test.fix(); test.lateNotification();
  assert.deepEqual(test.calls, ['start']); assert.equal(test.listeners(), 0);
});

it('rechecks destination immediately before either request or reroute, even without a trip notification', () => {
  for (const phase of ['calculatingRoute', 'navigating']) {
    const test = setup();
    test.navigation(trip('another-place', 'device-location', phase)); test.fix(); test.emit();
    assert.deepEqual(test.calls, ['start']); assert.match(test.errors[0]!, /Another trip/);
  }
});

it('a newer Explore selection cancels before its trip has a destination or a GPS fix', () => {
  const test = setup(); test.selection('new-explore-place'); test.emit();
  test.navigation({ phase: 'selectingDestination', origin: { kind: 'device-location' } });
  test.fix(); test.lateNotification();
  assert.deepEqual(test.calls, ['start', 'stop']); assert.match(test.errors[0]!, /Another destination was selected/);
  assert.equal(test.listeners(), 0);
});

it('reopening the same preexisting Explore selection is also a newer destination intent', () => {
  const test = setup(false, 'other-place');
  test.navigation({ phase: 'selectingDestination', origin: { kind: 'device-location' } });
  test.fix(); test.emit();
  assert.deepEqual(test.calls, ['start', 'stop']); assert.match(test.errors[0]!, /Another destination was selected/);
});

it('a changed session, revision, stop or inactive journey cannot use the captured destination', () => {
  for (const next of [undefined, { ...identity, sessionId: 'new' }, { ...identity, revision: 3 }, { ...identity, stopId: '2' }, { ...identity, stopSlug: 'sylvias' }]) {
    const test = setup(); test.journey(next); test.fix(); test.emit();
    assert.deepEqual(test.calls, ['start', 'stop']); assert.match(test.errors[0]!, /walk or stop changed/);
  }
});

it('a pending request cannot leave its GPS feed running for a newer manual-origin trip', () => {
  const test = setup(); test.navigation(trip('another-place', 'manual')); test.emit();
  assert.deepEqual(test.calls, ['start', 'stop']);
});

it('a fresh current-stop route takes over the feed once and ignores synchronous or late notifications', () => {
  const test = setup(); test.fix(); test.emit(); test.lateNotification(); test.cancel();
  assert.deepEqual(test.calls, ['start', 'request']); assert.equal(test.timeoutCleared(), true);
  assert.equal(test.listeners(), 0); assert.deepEqual(test.errors, []);
});

it('only the captured current stop is rerouted', () => {
  const test = setup(); test.navigation(trip()); test.fix(); test.emit(); test.cancel();
  assert.deepEqual(test.calls, ['start', 'reroute']); assert.deepEqual(test.errors, []);
});

it('denied or absent fresh GPS expires and releases a feed owned by the pending request', () => {
  for (const denied of [true, false]) {
    const test = setup(); if (denied) { test.fix(); test.denied(); } test.emit(); test.expire();
    assert.deepEqual(test.calls, ['start', 'stop']); assert.match(test.errors[0]!, /No precise, recent location/);
    assert.equal(test.listeners(), 0);
  }
});

it('cancelling does not release a preexisting feed that the pending request did not acquire', () => {
  const test = setup(true); test.cancel(); assert.deepEqual(test.calls, ['start']);
});
