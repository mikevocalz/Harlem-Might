import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';
import type { RouteRequest } from '../navigation/model/route.ts';
import { navigationFixStore, resetNavigationStores, useNavigationStore } from '../navigation/session/navigationStore.ts';
import { fixtureRoute } from '../navigation/testing/fixtures.ts';
import { flush } from '../navigation/testing/manualClock.ts';
import type { LocationWatchHandlers } from '../navigation/view/locationSource.ts';
import { useNavigationUi } from '../navigation/view/navigationUi.store.ts';
import * as runtime from '../navigation/view/runtime.ts';
import { startJourneyRouteIntent } from './route-intent.ts';

const identity = { sessionId: 'walk', revision: 1, stopId: 'stop', stopSlug: 'apollo' };
const destination = { placeId: 'apollo', name: 'Apollo', coordinate: { latitude: 40.81, longitude: -73.94 } };
const coordinate = { latitude: 40.82, longitude: -73.96 };
const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  runtime.resetNavigationRuntimeForTests();
  resetNavigationStores();
  useNavigationUi.getState().resetTrip();
  useNavigationUi.getState().setLocation('unknown');
});

/** Real route-intent/runtime/controller/stores, with no real location or I/O. */
function fixture(synchronousFix = false) {
  const requests: RouteRequest[] = [];
  let handlers: LocationWatchHandlers | undefined;
  let started = 0;
  let stopped = 0;
  const freshFix = () => ({ coordinate, accuracy: { horizontalM: 5 }, timestampMs: Date.now(), source: 'device-gps' as const });
  runtime.configureNavigationRuntime({
    provider: {
      id: 'mapbox', supportedModes: ['walking'],
      async getRoutes(request) {
        requests.push(request);
        return { kind: 'routes', provider: 'mapbox', routes: [fixtureRoute('apollo-theater--sylvias-restaurant')] };
      },
    },
    locationSource: {
      kind: 'native', check: async () => 'granted',
      watch(next) {
        started++;
        handlers = next;
        next.onAvailability('granted');
        if (synchronousFix) next.onFix(freshFix());
        return () => { stopped++; handlers = undefined; };
      },
    },
  });
  async function trip(phase: 'arrived' | 'paused' | 'navigating' | 'rerouting', manual = false) {
    const controller = runtime.navigationController();
    await controller.planRoute({ origin: manual ? { kind: 'manual', coordinate, label: 'Chosen start' } : { kind: 'device-location' }, originCoordinate: coordinate, destination, mode: 'walking' });
    assert.equal(controller.start(), true);
    if (phase === 'paused') assert.equal(controller.pause(), true);
    if (phase === 'rerouting') assert.equal(controller.reroute(), true);
    if (phase === 'arrived') {
      const current = useNavigationStore.getState().session;
      assert.ok('activeRoute' in current);
      useNavigationStore.setState({ session: { ...current, phase: 'arrived', arrival: { kind: 'arrived', confidence: 'confirmed', arrivedAtMs: Date.now() } } });
    }
  }
  function intent(beforeRequest?: () => void) {
    const errors: string[] = [];
    const outcomes: boolean[] = [];
    let listeners = 0;
    let timers = 0;
    let timerCleared = false;
    let deadline = () => {};
    let lateNotification = () => {};
    const cancel = startJourneyRouteIntent({
      identity, getJourney: () => identity,
      getNavigation: () => useNavigationStore.getState().session,
      getDirectionsPlaceId: () => useNavigationUi.getState().directionsPlaceId,
      getLastFix: () => navigationFixStore.getState().lastFix,
      getLocation: () => useNavigationUi.getState().location,
      isLocationRunning: runtime.isLocationRunning, startLocation: runtime.startLocation, stopLocation: runtime.stopLocation,
      subscribe(listener) {
        listeners++;
        lateNotification = listener;
        const subscriptions = [navigationFixStore, useNavigationStore, useNavigationUi].map((store) => store.subscribe(listener));
        return () => { listeners--; subscriptions.forEach((unsubscribe) => unsubscribe()); };
      },
      timeout(callback) { timers++; deadline = callback; return () => { timerCleared = true; }; },
      request() {
        beforeRequest?.();
        const accepted = runtime.requestDirections({ destination, mode: 'walking', originChoice: { kind: 'device' } });
        outcomes.push(accepted);
        return accepted;
      },
      reroute() {
        const accepted = runtime.navigationController().reroute();
        outcomes.push(accepted);
        return accepted;
      },
      setError(message) { errors.push(message); },
    });
    cleanups.push(cancel);
    return { errors, outcomes, cancel, expire: () => deadline(), late: () => lateNotification(),
      listeners: () => listeners, timers: () => timers, timerCleared: () => timerCleared };
  }
  return { requests, trip, intent, emit: () => handlers?.onFix(freshFix()), started: () => started, stopped: () => stopped };
}

for (const phase of ['arrived', 'paused'] as const) {
  for (const running of [false, true]) {
    it(`${phase} current-stop trips fail before GPS acquisition and preserve a ${running ? 'pre-existing' : 'stopped'} feed`, async () => {
      const f = fixture();
      await f.trip(phase);
      if (running) runtime.startLocation();
      const current = useNavigationStore.getState().session;
      const intent = f.intent();
      assert.equal(intent.errors.length, 1);
      assert.match(intent.errors[0]!, phase === 'paused' ? /Resume.*end/i : /End.*trip/i);
      assert.doesNotMatch(intent.errors[0]!, /precise|location/i);
      assert.equal(f.started(), running ? 1 : 0);
      assert.equal(f.stopped(), 0);
      assert.equal(runtime.isLocationRunning(), running);
      assert.equal(intent.listeners(), 0);
      assert.equal(intent.timers(), 0);
      assert.deepEqual(intent.outcomes, []);
      f.emit(); intent.expire(); intent.late(); intent.cancel();
      assert.equal(f.requests.length, 1);
      assert.equal(intent.errors.length, 1);
      assert.equal(useNavigationStore.getState().session, current);
    });
  }
}

for (const phase of ['arrived', 'paused'] as const) {
  it(`a trip becoming ${phase} while GPS is pending releases only the intent-owned watch`, async () => {
    const f = fixture();
    const intent = f.intent();
    assert.equal(f.started(), 1);
    await f.trip(phase);
    assert.equal(intent.errors.length, 1);
    assert.equal(intent.listeners(), 0);
    assert.equal(intent.timerCleared(), true);
    assert.equal(f.stopped(), 1);
    assert.equal(runtime.isLocationRunning(), false);
    const current = useNavigationStore.getState().session;
    f.emit(); intent.expire(); intent.late(); intent.cancel();
    assert.equal(f.requests.length, 1);
    assert.equal(useNavigationStore.getState().session, current);
  });
}

for (const running of [false, true]) {
  it(`a real refused request ends immediately and ${running ? 'retains the pre-existing' : 'releases its own'} watch`, async () => {
    const f = fixture();
    if (running) runtime.startLocation();
    // A source can withdraw its fix between readiness and the runtime command.
    const intent = f.intent(() => navigationFixStore.setState({ lastFix: undefined }));
    f.emit();
    await flush();
    assert.deepEqual(intent.outcomes, [false]);
    assert.equal(intent.errors.length, 1);
    assert.match(intent.errors[0]!, /could not|couldn’t|unable/i);
    assert.doesNotMatch(intent.errors[0]!, /No precise/);
    assert.equal(intent.listeners(), 0);
    assert.equal(intent.timerCleared(), true);
    assert.equal(runtime.isLocationRunning(), running);
    assert.equal(f.stopped(), running ? 0 : 1);
    intent.expire(); intent.late(); f.emit(); intent.cancel();
    assert.equal(intent.errors.length, 1);
    assert.equal(f.requests.length, 0);
  });
}

it('synchronous first-fix refusal releases the watch after source startup returns', async () => {
  const f = fixture(true);
  const intent = f.intent(() => navigationFixStore.setState({ lastFix: undefined }));
  await flush();
  assert.deepEqual(intent.outcomes, [false]);
  assert.equal(intent.errors.length, 1);
  assert.equal(intent.listeners(), 0);
  assert.equal(intent.timerCleared(), true);
  assert.equal(runtime.isLocationRunning(), false);
  assert.equal(f.started(), 1);
  assert.equal(f.stopped(), 1);
});

it('a real refused reroute ends the GPS deadline while the active trip retains its watch', async () => {
  const f = fixture();
  await f.trip('rerouting');
  const current = useNavigationStore.getState().session;
  const intent = f.intent();
  f.emit();
  assert.deepEqual(intent.outcomes, [false]);
  assert.equal(intent.errors.length, 1);
  assert.doesNotMatch(intent.errors[0]!, /No precise/);
  assert.equal(intent.listeners(), 0);
  assert.equal(intent.timerCleared(), true);
  assert.equal(runtime.isLocationRunning(), true);
  assert.equal(f.stopped(), 0);
  const after = useNavigationStore.getState().session;
  assert.ok('activeRoute' in current && 'activeRoute' in after);
  assert.equal(after.phase, current.phase);
  assert.equal(after.activeRoute, current.activeRoute);
  assert.equal(after.destination, current.destination);
  intent.expire(); intent.late(); intent.cancel();
  assert.equal(intent.errors.length, 1);
});

it('a successful real request hands its watch to the ready trip without repeated requests', async () => {
  const f = fixture();
  const intent = f.intent();
  f.emit();
  await flush();
  assert.deepEqual(intent.outcomes, [true]);
  assert.equal(f.requests.length, 1);
  assert.equal(useNavigationStore.getState().session.phase, 'routeReady');
  assert.equal(intent.listeners(), 0);
  assert.equal(intent.timerCleared(), true);
  assert.equal(runtime.isLocationRunning(), true);
  intent.expire(); intent.late(); intent.cancel();
  assert.deepEqual(intent.errors, []);
  assert.equal(f.stopped(), 0);
});


for (const running of [false, true]) {
  it(`a refused manual-origin reroute preserves the trip and ${running ? 'pre-existing' : 'releases its acquired'} feed`, async () => {
    const f = fixture();
    await f.trip('rerouting', true);
    if (running) runtime.startLocation();
    const current = useNavigationStore.getState().session;
    const intent = f.intent();
    f.emit();
    assert.deepEqual(intent.outcomes, [false]);
    assert.equal(intent.errors.length, 1);
    assert.doesNotMatch(intent.errors[0]!, /No precise/);
    assert.equal(intent.listeners(), 0);
    assert.equal(intent.timerCleared(), true);
    assert.equal(runtime.isLocationRunning(), running);
    assert.equal(f.stopped(), running ? 0 : 1);
    const after = useNavigationStore.getState().session;
    assert.ok('activeRoute' in current && 'activeRoute' in after);
    assert.equal(after.phase, current.phase);
    assert.equal(after.activeRoute, current.activeRoute);
    assert.equal(after.destination, current.destination);
    assert.equal(after.origin, current.origin);
    intent.expire(); intent.late(); intent.cancel();
    assert.equal(intent.errors.length, 1);
    assert.equal(f.requests.length, 1);
  });
}

it('a navigating device trip can still request a real reroute and keep its shared feed', async () => {
  const f = fixture();
  await f.trip('navigating');
  const current = useNavigationStore.getState().session;
  assert.ok('activeRoute' in current);
  const intent = f.intent();
  f.emit();
  assert.deepEqual(intent.outcomes, [true]);
  assert.deepEqual(intent.errors, []);
  const after = useNavigationStore.getState().session;
  assert.equal(after.phase, 'rerouting');
  assert.ok('activeRoute' in after);
  assert.equal(after.activeRoute, current.activeRoute);
  assert.equal(intent.listeners(), 0);
  assert.equal(intent.timerCleared(), true);
  assert.equal(runtime.isLocationRunning(), true);
  assert.equal(f.stopped(), 0);
  intent.expire(); intent.late(); intent.cancel();
  assert.deepEqual(intent.errors, []);
});
