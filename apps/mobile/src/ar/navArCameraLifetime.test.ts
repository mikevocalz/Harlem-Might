import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';
import { fixtureDestination, fixtureRoute } from '@acme/app/features/navigation/testing/fixtures.ts';
import { resetNavigationStores, useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { configureNavigationRuntime, isLocationRunning, navigationController, resetNavigationRuntimeForTests, startLocation } from '@acme/app/features/navigation/view/runtime.ts';
import { projectNavRoute, type NavPlacement } from './navAr.ts';
import { useNavAr } from './navAr.store.ts';
import { attachNavigationArCamera } from './navArCameraLifetime.ts';

afterEach(() => {
  useNavAr.getState().reset();
  resetNavigationRuntimeForTests();
  resetNavigationStores();
});

function calibrateCamera() {
  const frame = projectNavRoute({ route: fixtureRoute('apollo-theater--sylvias-restaurant'),
    generation: 1, receivedAtMs: 0, alternatives: [] });
  const target: NavPlacement = { source: 'compass', confidence: 'high',
    placement: { position: [3, 0, 5], rotation: [0, 90, 0] }, yawAccuracyDeg: 6, solvedAtMs: 1000, solvedAtAlongM: 20 };
  const state = useNavAr.getState();
  state.setWorld({ frame, target, displayed: target.placement });
  state.setAlongM(20);
  state.setCompassSamples(12);
  state.setGeospatial('available');
  state.acknowledgeAwareness();
  return useNavAr.getState();
}

function assertUncalibrated() {
  const state = useNavAr.getState();
  assert.equal(state.world, undefined);
  assert.equal(state.alongM, undefined);
  assert.equal(state.compassSamples, 0);
  assert.equal(state.geospatial, 'checking');
  assert.equal(state.isAwarenessAcknowledged, false);
}

it('discarding and restarting the native camera clears placement even while its HUD host stays mounted', () => {
  const navigation = useNavigationStore.getState();
  const detach = attachNavigationArCamera();
  calibrateCamera();
  detach();
  assertUncalibrated();
  assert.equal(useNavigationStore.getState(), navigation);

  // A new Viro world origin must never inherit even accidentally retained evidence.
  calibrateCamera();
  const detachRestart = attachNavigationArCamera();
  assertUncalibrated();
  assert.equal(useNavigationStore.getState(), navigation);
  detachRestart();
});

it('effect replay clears the first origin without letting its old cleanup erase the next one', () => {
  const replayCleanup = attachNavigationArCamera();
  calibrateCamera();
  replayCleanup();
  assertUncalibrated();
  const detach = attachNavigationArCamera();
  const current = calibrateCamera();
  replayCleanup();
  assert.equal(useNavAr.getState(), current);
  detach();
  assertUncalibrated();
});

it('a superseded camera cleanup cannot invalidate a newer camera owner', () => {
  const oldDetach = attachNavigationArCamera();
  calibrateCamera();
  const detach = attachNavigationArCamera();
  assertUncalibrated();
  const current = calibrateCamera();
  oldDetach();
  assert.equal(useNavAr.getState(), current);
  detach();
  assertUncalibrated();
});

it('camera visibility changes retain the active walk and its single location watch', async () => {
  const route = fixtureRoute('apollo-theater--sylvias-restaurant');
  let watches = 0;
  let stops = 0;
  configureNavigationRuntime({
    provider: { id: 'mapbox', supportedModes: ['walking'], async getRoutes() { return { kind: 'routes', provider: 'mapbox', routes: [route] }; } },
    locationSource: { kind: 'native', async check() { return 'granted'; }, watch() {
      watches += 1;
      return () => { stops += 1; };
    } },
  });
  const controller = navigationController();
  await controller.planRoute({ origin: { kind: 'device-location' }, originCoordinate: route.geometry.coordinates[0]!,
    destination: fixtureDestination('apollo-theater--sylvias-restaurant', false), mode: 'walking' });
  assert.ok(controller.start());
  assert.ok(controller.enterAR());
  startLocation();
  const session = useNavigationStore.getState().session;
  const detach = attachNavigationArCamera();
  calibrateCamera();
  detach();
  const detachRestart = attachNavigationArCamera();
  assert.equal(useNavigationStore.getState().session, session);
  assert.equal(isLocationRunning(), true);
  assert.equal(watches, 1);
  assert.equal(stops, 0);
  assertUncalibrated();
  detachRestart();
});
