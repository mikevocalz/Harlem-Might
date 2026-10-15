import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { arEntryRoute, createArNavigationEntry } from './arNavigationEntry.ts';
import { configureNavigationRuntime, endNavigation, isLocationRunning, navigationController, resetNavigationRuntimeForTests, startGuidance } from '@acme/app/features/navigation/view/runtime.ts';
import { resetNavigationStores, useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { useNavigationUi } from '@acme/app/features/navigation/view/navigationUi.store.ts';
import { fixtureDestination, fixtureRoute, loadFixture, lngLatToCoordinate } from '@acme/app/features/navigation/testing/fixtures.ts';
import { deferred } from '@acme/app/features/navigation/testing/manualClock.ts';
import type { NavigationOrigin } from '@acme/app/features/navigation/model/session.ts';
import { useExploreLayoutStore } from '../spatial/exploreLayout.store.ts';
import { resolveExploreLayout } from '../spatial/exploreLayout.ts';
import type { TravelMode } from '@acme/app/features/navigation/model/route.ts';
import type { LocationAvailability } from '@acme/app/features/navigation/view/locationSource.ts';

const NAME = 'apollo-theater--sylvias-restaurant';
const origin = lngLatToCoordinate(loadFixture(NAME).origin.lngLat);
afterEach(() => { useExploreLayoutStore.getState().setCompactPane('map'); resetNavigationRuntimeForTests(); resetNavigationStores(); useNavigationUi.getState().resetTrip(); });

// Real shared runtime; only external routing and device boundaries are substituted.
async function harness(options: { mode?: TravelMode; origin?: NavigationOrigin } = {}) {
  const counts = { requests: 0, watches: 0, stops: 0, opens: 0 };
  let location: LocationAvailability = 'granted';
  useNavigationUi.getState().setLocation(location);
  configureNavigationRuntime({
    provider: { id: 'mapbox', supportedModes: ['walking', 'cycling', 'driving'], async getRoutes() {
      counts.requests += 1; return { kind: 'routes', provider: 'mapbox', routes: [fixtureRoute(NAME)] };
    } },
    locationSource: { kind: 'browser', check: async () => location, watch() { counts.watches += 1; return () => { counts.stops += 1; }; } },
  });
  const controller = navigationController();
  const plan = () => controller.planRoute({ origin: options.origin ?? { kind: 'device-location' }, originCoordinate: origin, destination: fixtureDestination(NAME), mode: options.mode ?? 'walking' });
  await plan();
  const native = { supported: async () => true, camera: async () => true, enterAR: () => controller.enterAR(), mounted: true, focused: true, foreground: true };
  const pending: boolean[] = [];
  const entry = createArNavigationEntry({
    getSession: () => useNavigationStore.getState().session, supported: () => native.supported(), requestCamera: () => native.camera(),
    startGuidance, enterAR: () => native.enterAR(), exitAR: () => controller.exitAR(), setPending: (value) => pending.push(value),
  });
  return {
    controller, entry, native, counts, pending, plan,
    setLocation(next: LocationAvailability) {
      location = next;
      useNavigationUi.getState().setLocation(next);
    },
    open: () => entry.open(() => { counts.opens += 1; }, () =>
      native.mounted && native.focused && native.foreground && (location === 'granted' || location === 'approximate')),
  };
}

describe('Take Me There → phone AR', () => {
  it('starts the selected route and one location watch without another route request', async () => {
    const h = await harness(); const selected = arEntryRoute(useNavigationStore.getState().session);
    assert.equal(await h.open(), 'opened');
    const session = useNavigationStore.getState().session;
    assert.equal(session.phase, 'calibratingAR'); assert.ok('activeRoute' in session); assert.equal(session.activeRoute.route, selected);
    assert.deepEqual(h.counts, { requests: 1, watches: 1, stops: 0, opens: 1 }); assert.deepEqual(h.pending, [true, false]);
  });
  it('commits the existing compact-map intent only after successful entry and before routing', async () => {
    const h = await harness();
    useExploreLayoutStore.getState().showCompactDetail('map');
    let started = 0;
    const onStarted = () => { started++; useExploreLayoutStore.getState().setCompactPane('map'); };
    h.native.camera = async () => false;
    assert.equal(await h.entry.open(() => assert.fail('denied camera must not route'), () => true, onStarted), 'camera-denied');
    assert.equal(started, 0);
    h.native.camera = async () => true;
    assert.equal(await h.entry.open(() => {
      const layout = resolveExploreLayout({ windowWidth: 390, hasSelection: true, detailPlacement: 'inline', isHorizon: false,
        compactPane: useExploreLayoutStore.getState().compactPane });
      assert.equal(layout.showMap, true, 'returning from the root AR route must expose the map');
    }, () => true, onStarted), 'opened');
    assert.equal(started, 1);
  });
  it('keeps map return intent when a wide phone becomes compact during native permission', async () => {
    const h = await harness(); const camera = deferred<boolean>(); h.native.camera = () => camera.promise;
    useExploreLayoutStore.getState().showCompactDetail('map');
    let width = 1200;
    const pending = h.entry.open(() => {
      const layout = resolveExploreLayout({ windowWidth: width, hasSelection: true, detailPlacement: 'inline', isHorizon: false,
        compactPane: useExploreLayoutStore.getState().compactPane });
      assert.equal(layout.showMap, true);
    }, () => true, () => useExploreLayoutStore.getState().setCompactPane('map'));
    width = 390; camera.resolve(true);
    assert.equal(await pending, 'opened');
  });
  it('carries a map walk into AR and back without restarting it; End stops the watch', async () => {
    const h = await harness(); startGuidance(); const before = useNavigationStore.getState().session;
    assert.equal(await h.open(), 'opened'); assert.equal(h.controller.exitAR(), true);
    const after = useNavigationStore.getState().session;
    assert.equal(after.phase, 'navigating'); assert.ok('activeRoute' in before && 'activeRoute' in after); assert.equal(after.activeRoute, before.activeRoute);
    assert.deepEqual(h.counts, { requests: 1, watches: 1, stops: 0, opens: 1 });
    endNavigation(); assert.equal(isLocationRunning(), false); assert.equal(h.counts.stops, 1);
  });
  it('reports unavailable when guidance starts but AR entry is refused, keeping the map walk active', async () => {
    const h = await harness(); const selected = arEntryRoute(useNavigationStore.getState().session);
    h.native.enterAR = () => false;
    assert.equal(await h.open(), 'unavailable');
    const session = useNavigationStore.getState().session;
    assert.equal(session.phase, 'navigating');
    assert.ok('activeRoute' in session); assert.equal(session.activeRoute.route, selected);
    assert.equal(isLocationRunning(), true);
    assert.deepEqual(h.counts, { requests: 1, watches: 1, stops: 0, opens: 0 });
    assert.deepEqual(h.pending, [true, false]);
    h.native.enterAR = () => h.controller.enterAR();
    assert.equal(await h.open(), 'opened', 'a retry enters the existing map walk');
    assert.deepEqual(h.counts, { requests: 1, watches: 1, stops: 0, opens: 1 });
  });
  it('keeps cancelled semantics when an already-active map walk refuses AR entry', async () => {
    const h = await harness(); assert.equal(startGuidance(), true);
    const before = useNavigationStore.getState().session;
    h.native.enterAR = () => false;
    assert.equal(await h.open(), 'cancelled');
    assert.equal(useNavigationStore.getState().session, before);
    assert.equal(isLocationRunning(), true);
    assert.deepEqual(h.counts, { requests: 1, watches: 1, stops: 0, opens: 0 });
    assert.deepEqual(h.pending, [true, false]);
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
  for (const cause of ['cancel', 'unmount', 'new route', 'tab blur', 'background', 'location permission loss'] as const) {
    it(`ignores a late permission result after ${cause}`, async () => {
      const h = await harness(); const permission = deferred<boolean>(); h.native.camera = () => permission.promise;
      const first = h.open(); await Promise.resolve();
      if (cause === 'cancel') endNavigation();
      else if (cause === 'unmount') h.native.mounted = false;
      else if (cause === 'tab blur') h.native.focused = false;
      else if (cause === 'background') h.native.foreground = false;
      else if (cause === 'location permission loss') h.setLocation('denied');
      else await h.plan();
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
