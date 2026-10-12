import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { arEntryRoute, createArNavigationEntry } from './arNavigationEntry.ts';
import { configureNavigationRuntime, endNavigation, isLocationRunning, navigationController, resetNavigationRuntimeForTests, startGuidance } from '@acme/app/features/navigation/view/runtime.ts';
import { resetNavigationStores, useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { useNavigationUi } from '@acme/app/features/navigation/view/navigationUi.store.ts';
import { fixtureDestination, fixtureRoute, loadFixture, lngLatToCoordinate } from '@acme/app/features/navigation/testing/fixtures.ts';
import { deferred } from '@acme/app/features/navigation/testing/manualClock.ts';
import type { NavigationOrigin } from '@acme/app/features/navigation/model/session.ts';
import type { TravelMode } from '@acme/app/features/navigation/model/route.ts';

const NAME = 'apollo-theater--sylvias-restaurant';
const origin = lngLatToCoordinate(loadFixture(NAME).origin.lngLat);
afterEach(() => { resetNavigationRuntimeForTests(); resetNavigationStores(); useNavigationUi.getState().resetTrip(); });

// Real shared runtime; only external routing and device boundaries are substituted.
async function harness(options: { mode?: TravelMode; origin?: NavigationOrigin } = {}) {
  const counts = { requests: 0, watches: 0, stops: 0, opens: 0 };
  configureNavigationRuntime({
    provider: { id: 'mapbox', supportedModes: ['walking', 'cycling', 'driving'], async getRoutes() {
      counts.requests += 1; return { kind: 'routes', provider: 'mapbox', routes: [fixtureRoute(NAME)] };
    } },
    locationSource: { kind: 'browser', check: async () => 'granted', watch() { counts.watches += 1; return () => { counts.stops += 1; }; } },
  });
  const controller = navigationController();
  const plan = () => controller.planRoute({ origin: options.origin ?? { kind: 'device-location' }, originCoordinate: origin, destination: fixtureDestination(NAME), mode: options.mode ?? 'walking' });
  await plan();
  const native = { supported: async () => true, camera: async () => true, mounted: true, phoneLayout: true, foreground: true };
  const pending: boolean[] = [];
  const entry = createArNavigationEntry({
    getSession: () => useNavigationStore.getState().session, supported: () => native.supported(), requestCamera: () => native.camera(),
    startGuidance, enterAR: () => controller.enterAR(), exitAR: () => controller.exitAR(), setPending: (value) => pending.push(value),
  });
  return { controller, entry, native, counts, pending, plan, open: () => entry.open(() => { counts.opens += 1; }, () => native.mounted && native.phoneLayout && native.foreground) };
}

describe('Take Me There → phone AR', () => {
  it('starts the selected route and one location watch without another route request', async () => {
    const h = await harness(); const selected = arEntryRoute(useNavigationStore.getState().session);
    assert.equal(await h.open(), 'opened');
    const session = useNavigationStore.getState().session;
    assert.equal(session.phase, 'calibratingAR'); assert.ok('activeRoute' in session); assert.equal(session.activeRoute.route, selected);
    assert.deepEqual(h.counts, { requests: 1, watches: 1, stops: 0, opens: 1 }); assert.deepEqual(h.pending, [true, false]);
  });
  it('carries a map walk into AR and back without restarting it; End stops the watch', async () => {
    const h = await harness(); startGuidance(); const before = useNavigationStore.getState().session;
    assert.equal(await h.open(), 'opened'); assert.equal(h.controller.exitAR(), true);
    const after = useNavigationStore.getState().session;
    assert.equal(after.phase, 'navigating'); assert.ok('activeRoute' in before && 'activeRoute' in after); assert.equal(after.activeRoute, before.activeRoute);
    assert.deepEqual(h.counts, { requests: 1, watches: 1, stops: 0, opens: 1 });
    endNavigation(); assert.equal(isLocationRunning(), false); assert.equal(h.counts.stops, 1);
  });
  it('leaves the map unchanged on unsupported hardware, camera denial and native failure', async () => {
    const h = await harness(); const before = useNavigationStore.getState().session;
    h.native.supported = async () => false; assert.equal(await h.open(), 'unsupported');
    h.native.supported = async () => true; h.native.camera = async () => false; assert.equal(await h.open(), 'camera-denied');
    h.native.camera = async () => { throw new Error('native unavailable'); }; assert.equal(await h.open(), 'unavailable');
    assert.equal(useNavigationStore.getState().session, before); assert.deepEqual(h.counts, { requests: 1, watches: 0, stops: 0, opens: 0 });
  });
  it('deduplicates presses while the native permission prompt is pending', async () => {
    const h = await harness(); const permission = deferred<boolean>(); h.native.camera = () => permission.promise;
    const first = h.open(); assert.equal(await h.open(), 'busy'); permission.resolve(true);
    assert.equal(await first, 'opened'); assert.equal(h.counts.opens, 1);
  });
  for (const cause of ['cancel', 'unmount', 'new route', 'non-phone layout', 'background'] as const) {
    it(`ignores a late permission result after ${cause}`, async () => {
      const h = await harness(); const permission = deferred<boolean>(); h.native.camera = () => permission.promise;
      const first = h.open(); await Promise.resolve();
      if (cause === 'cancel') endNavigation(); else if (cause === 'unmount') h.native.mounted = false; else if (cause === 'non-phone layout') h.native.phoneLayout = false; else if (cause === 'background') h.native.foreground = false; else await h.plan();
      permission.resolve(true); assert.equal(await first, 'cancelled'); assert.equal(h.counts.opens, 0); assert.equal(h.counts.watches, 0);
    });
  }
  it('keeps map guidance if opening the AR route throws', async () => {
    const h = await harness();
    assert.equal(await h.entry.open(() => { throw new Error('router unavailable'); }, () => true), 'unavailable');
    assert.equal(useNavigationStore.getState().session.phase, 'navigating'); assert.equal(isLocationRunning(), true);
  });
  for (const mode of ['cycling', 'driving', 'transit'] as const) {
    it(`does not offer walking AR for ${mode}`, async () => {
      const h = await harness({ mode }); assert.equal(await h.open(), 'cancelled'); assert.deepEqual(h.pending, []);
    });
  }
  it('does not treat a manual start as the phone position', async () => {
    const h = await harness({ origin: { kind: 'manual', coordinate: origin, label: 'Apollo' } });
    assert.equal(await h.open(), 'cancelled'); assert.equal(h.counts.watches, 0);
  });
});
