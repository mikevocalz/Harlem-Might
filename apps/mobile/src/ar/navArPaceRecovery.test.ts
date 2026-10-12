import assert from 'node:assert/strict';
import { afterEach, describe, it, type TestContext } from 'node:test';
import type { LocationFix } from '@acme/app/features/navigation/model/location.ts';
import type { LocationAvailability, LocationWatchHandlers } from '@acme/app/features/navigation/view/locationSource.ts';
import { createLocalFrame } from '@acme/app/features/navigation/geo/localFrame.ts';
import { fixtureDestination, fixtureRoute } from '@acme/app/features/navigation/testing/fixtures.ts';
import { resetNavigationStores, useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { useNavigationUi } from '@acme/app/features/navigation/view/navigationUi.store.ts';
import { configureNavigationRuntime, isLocationRunning, navigationController, resetNavigationRuntimeForTests, startLocation, stopLocation } from '@acme/app/features/navigation/view/runtime.ts';
import { deferred } from '@acme/app/features/navigation/testing/manualClock.ts';
import { canCheckWalkingPace, checkWalkingPace } from './navArPaceRecovery.ts';

const route = fixtureRoute('apollo-theater--sylvias-restaurant');
const frame = createLocalFrame(route.geometry.coordinates[0]!);
afterEach(() => {
  resetNavigationRuntimeForTests();
  resetNavigationStores();
  useNavigationUi.getState().setLocation('unknown');
});
async function pausedTrip(t: TestContext, device = true) {
  let now = 1_800_000_000_000;
  t.mock.method(Date, 'now', () => now);
  let handlers: LocationWatchHandlers | undefined;
  let watches = 0;
  let check = async (): Promise<LocationAvailability> => 'granted';
  configureNavigationRuntime({
    provider: { id: 'mapbox', supportedModes: ['walking'], async getRoutes() { return { kind: 'routes', provider: 'mapbox', routes: [route] }; } },
    locationSource: {
      kind: 'native', check() { return check(); },
      watch(next) { watches += 1; handlers = next; return () => { handlers = undefined; }; },
    },
  });
  const controller = navigationController();
  await controller.planRoute({ origin: device ? { kind: 'device-location' } : { kind: 'manual', coordinate: frame.origin, label: 'Apollo' },
    originCoordinate: frame.origin, destination: fixtureDestination('apollo-theater--sylvias-restaurant', false), mode: 'walking' });
  controller.start();
  controller.enterAR();
  controller.pause();
  useNavigationUi.getState().setLocation('granted');
  startLocation();
  return {
    watches: () => watches,
    setCheck(next: () => Promise<LocationAvailability>) { check = next; },
    advance(ms: number) { now += ms; },
    feed(northM: number) {
      now += 1_000;
      const fix: LocationFix = { coordinate: frame.toGeographic({ eastM: 0, northM }), accuracy: { horizontalM: 6 }, timestampMs: now, source: 'device-gps' };
      handlers?.onFix(fix);
    },
  };
}

describe('paused AR walking-pace recovery', () => {
  it('restarts a stopped feed without resuming and lets fresh stationary fixes clear the stale speed guard', async (t) => {
    const trip = await pausedTrip(t);
    for (let i = 0; i < 20; i += 1) trip.feed(i * 8);
    const fast = useNavigationStore.getState().positioning;
    assert.ok(fast.kind === 'tracking' && fast.isMovingTooFast, 'real location pipeline reports driving speed');
    stopLocation(); // background
    trip.advance(60_000); // foreground does not restart a paused session
    assert.equal(isLocationRunning(), false);
    assert.equal(useNavigationStore.getState().positioning, fast, 'the speed flag stays stale without a watch');
    assert.ok(await checkWalkingPace(() => true));
    assert.equal(useNavigationStore.getState().session.phase, 'paused');
    assert.ok(isLocationRunning());
    assert.ok(await checkWalkingPace(() => true));
    assert.equal(trip.watches(), 2, 'repeated checks never duplicate the restarted watch');
    for (let i = 0; i < 20; i += 1) trip.feed(152);
    const slow = useNavigationStore.getState().positioning;
    assert.ok(slow.kind === 'tracking' && !slow.isMovingTooFast);
    assert.equal(useNavigationStore.getState().session.phase, 'paused', 'only explicit Resume may restart guidance');
  });
  it('keeps guidance paused while fresh fixes still show high speed', async (t) => {
    const trip = await pausedTrip(t);
    for (let i = 0; i < 20; i += 1) trip.feed(i * 8);
    stopLocation();
    assert.ok(await checkWalkingPace(() => true));
    for (let i = 20; i < 24; i += 1) trip.feed(i * 8);
    const position = useNavigationStore.getState().positioning;
    assert.ok(position.kind === 'tracking' && position.isMovingTooFast);
    assert.equal(useNavigationStore.getState().session.phase, 'paused');
  });
  it('does not check location for a manual origin or an idle session', async (t) => {
    const trip = await pausedTrip(t, false);
    stopLocation();
    assert.equal(await checkWalkingPace(() => true), false);
    assert.equal(trip.watches(), 1);
    const session = useNavigationStore.getState().session;
    assert.equal(canCheckWalkingPace({ session }), false);
    assert.equal(canCheckWalkingPace({ session: { phase: 'idle' } }), false);
  });
  it('rechecks permission at action time after an enabled button was rendered', async (t) => {
    const trip = await pausedTrip(t);
    stopLocation();
    assert.equal(canCheckWalkingPace({ session: useNavigationStore.getState().session }), true);
    useNavigationUi.getState().setLocation('denied');
    trip.setCheck(async () => 'denied');
    assert.equal(await checkWalkingPace(() => true), false);
    assert.equal(isLocationRunning(), false);
    assert.equal(trip.watches(), 1);
    assert.equal(useNavigationStore.getState().session.phase, 'paused');
  });
});


describe('async walking-pace recovery boundaries', () => {
  it('rechecks the source instead of trusting stale UI permission', async (t) => {
    const trip = await pausedTrip(t);
    stopLocation();
    trip.setCheck(async () => 'denied');
    assert.equal(useNavigationUi.getState().location, 'granted');
    assert.equal(await checkWalkingPace(() => true), false);
    assert.equal(useNavigationUi.getState().location, 'denied');
    assert.equal(trip.watches(), 1);
    assert.equal(isLocationRunning(), false);
  });
  for (const change of ['cancel', 'new-trip', 'background', 'unmount', 'permission-revoked'] as const) {
    it(`ignores a late permission check after ${change}`, async (t) => {
      const trip = await pausedTrip(t);
      stopLocation();
      const pending = deferred<LocationAvailability>();
      trip.setCheck(() => pending.promise);
      let foregroundAndMounted = true;
      const recovery = checkWalkingPace(() => foregroundAndMounted);
      if (change === 'cancel') navigationController().cancel();
      if (change === 'new-trip') {
        navigationController().cancel();
        await navigationController().planRoute({ origin: { kind: 'device-location' }, originCoordinate: frame.origin,
          destination: fixtureDestination('apollo-theater--sylvias-restaurant', false), mode: 'walking' });
        navigationController().start();
        navigationController().enterAR();
        navigationController().pause();
      }
      if (change === 'background' || change === 'unmount') foregroundAndMounted = false;
      if (change === 'permission-revoked') useNavigationUi.getState().setLocation('denied');
      pending.resolve('granted');
      assert.equal(await recovery, false);
      assert.equal(trip.watches(), 1);
      assert.equal(isLocationRunning(), false);
    });
  }
  it('keeps the trip paused when the permission read fails', async (t) => {
    const trip = await pausedTrip(t);
    stopLocation();
    trip.setCheck(async () => { throw new Error('location service unavailable'); });
    assert.equal(await checkWalkingPace(() => true), false);
    assert.equal(useNavigationStore.getState().session.phase, 'paused');
    assert.equal(trip.watches(), 1);
  });
});


describe('walking-pace checks after restoring permission in Settings', () => {
  for (const cached of ['denied', 'disabled'] as const) {
    for (const restored of ['granted', 'approximate'] as const) {
      it(`refreshes a cached ${cached} status from a current ${restored} result`, async (t) => {
        const trip = await pausedTrip(t);
        stopLocation();
        useNavigationUi.getState().setLocation(cached);
        let checks = 0;
        trip.setCheck(async () => { checks += 1; return restored; });
        assert.equal(canCheckWalkingPace({ session: useNavigationStore.getState().session }), true, 'the HUD check remains enabled');
        assert.equal(await checkWalkingPace(() => true), true);
        assert.equal(checks, 1);
        assert.equal(useNavigationUi.getState().location, restored);
        assert.equal(trip.watches(), 2);
        assert.equal(useNavigationStore.getState().session.phase, 'paused');
      });
    }
    it(`leaves location stopped when the fresh result is still ${cached}`, async (t) => {
      const trip = await pausedTrip(t);
      stopLocation();
      useNavigationUi.getState().setLocation(cached);
      let checks = 0;
      trip.setCheck(async () => { checks += 1; return cached; });
      assert.equal(await checkWalkingPace(() => true), false);
      assert.equal(checks, 1, 'an eligible paused trip performs the non-prompting read');
      assert.equal(trip.watches(), 1);
      assert.equal(isLocationRunning(), false);
      assert.equal(useNavigationStore.getState().session.phase, 'paused');
    });
    it(`rejects a newer ${cached} event even when its value matches the initial cache`, async (t) => {
      const trip = await pausedTrip(t);
      stopLocation();
      useNavigationUi.getState().setLocation(cached);
      const pending = deferred<LocationAvailability>();
      trip.setCheck(() => pending.promise);
      const recovery = checkWalkingPace(() => true);
      useNavigationUi.getState().setLocation(cached);
      pending.resolve('granted');
      assert.equal(await recovery, false);
      assert.equal(trip.watches(), 1);
      assert.equal(useNavigationUi.getState().location, cached);
    });
  }
});
