import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createStore } from 'zustand/vanilla';
import { createNavigationController } from '@acme/app/features/navigation/session/navigationController.ts';
import { INITIAL_FIX_STATE, INITIAL_NAVIGATION_STATE, type NavigationFixState, type NavigationState } from '@acme/app/features/navigation/session/navigationStore.ts';
import { fixtureRoute, fixtureDestination } from '@acme/app/features/navigation/testing/fixtures.ts';
import { solveCompassPlacement } from '@mapbox/react-native-mapbox-ar-reactvision/src/compassPlacement.ts';
import { positioningRadius68M } from './navAr.ts';

it('uses the actual controller radius once: an 18m matched GPS fix remains medium compass placement', async () => {
  const route = fixtureRoute('apollo-theater--sylvias-restaurant');
  const store = createStore<NavigationState>()(() => INITIAL_NAVIGATION_STATE);
  const fixStore = createStore<NavigationFixState>()(() => INITIAL_FIX_STATE);
  const controller = createNavigationController({ store, fixStore, now: () => 1000,
    provider: { id: 'mapbox', supportedModes: ['walking'],
      getRoutes: async () => ({ kind: 'routes', provider: 'mapbox', routes: [route] }) } });
  const origin = route.geometry.coordinates[0]!;
  await controller.planRoute({ origin: { kind: 'device-location' }, originCoordinate: origin,
    destination: fixtureDestination('apollo-theater--sylvias-restaurant'), mode: 'walking' });
  assert.equal(controller.start(), true);
  controller.ingestFix({ coordinate: origin, accuracy: { horizontalM: 18 }, timestampMs: 1000, source: 'device-gps' });
  assert.equal(fixStore.getState().lastFix?.kind, 'accepted');
  assert.equal(fixStore.getState().match?.kind, 'matched');
  const positioning = store.getState().positioning;
  assert.equal(positioning.kind, 'tracking');
  const horizontalAccuracyM = positioningRadius68M(positioning);
  assert.equal(horizontalAccuracyM, 18, 'the controller has already converted filtered per-axis sigma to r68');
  const solved = solveCompassPlacement({ cameraWorldPosition: [0, 1.4, 0], cameraForward: [0, 0, -1],
    trueHeadingDeg: 0, headingAccuracyDeg: 6, cameraEnuOffset: { eastM: 0, northM: 0, upM: 1.4 }, horizontalAccuracyM });
  assert.equal(solved.confidence, 'medium', 'double conversion would make 18m become27.17m and incorrectly low');
  controller.cancel();
});
