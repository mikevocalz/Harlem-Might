import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';
import { RouteProviderError } from '../providers/routeProvider.ts';
import type { RouteRequest, RouteResponse } from '../model/route.ts';
import { navigationFixStore, resetNavigationStores, useNavigationStore } from '../session/navigationStore.ts';
import { createDirectionsPanelHost } from '../testing/directionsPanelHost.ts';
import { fixtureRoute } from '../testing/fixtures.ts';
import { deferred } from '../testing/manualClock.ts';
import { useNavigationUi } from '../view/navigationUi.store.ts';
import * as runtime from '../view/runtime.ts';
import type { DirectionsPlace } from './hooks.ts';

const origin: DirectionsPlace = { id: 'origin', name: 'Origin', lngLat: [-73.96, 40.82] };
const destination: DirectionsPlace = { id: 'destination', name: 'Destination', lngLat: [-73.94, 40.81] };
const hosts: ReturnType<typeof createDirectionsPanelHost>[] = [];
afterEach(() => {
  hosts.splice(0).forEach((host) => host.unmount());
  runtime.resetNavigationRuntimeForTests();
  resetNavigationStores();
  useNavigationUi.getState().resetTrip();
  useNavigationUi.getState().setLocation('unknown');
});

function fixture(manual = true) {
  const pending: { request: RouteRequest; signal?: AbortSignal; response: ReturnType<typeof deferred<RouteResponse>> }[] = [];
  runtime.configureNavigationRuntime({ provider: {
    id: 'mapbox', supportedModes: ['walking', 'cycling', 'driving'],
    getRoutes(request, options) {
      const response = deferred<RouteResponse>();
      pending.push({ request, signal: options?.signal, response });
      // Deliberately ignores aborts: the controller must also reject late results.
      return response.promise;
    },
  } });
  if (manual) useNavigationUi.getState().setOriginChoice({ kind: 'place', placeId: origin.id });
  const host = createDirectionsPanelHost();
  hosts.push(host);
  return {
    host, pending,
    async render(place: DirectionsPlace = destination, from: readonly DirectionsPlace[] = [origin]) {
      host.render({ place, originPlaces: from });
      await host.settle();
    },
    async resolve(index: number) {
      pending[index]!.response.resolve({ kind: 'routes', provider: 'mapbox', routes: [fixtureRoute('apollo-theater--sylvias-restaurant')] });
      await host.settle();
    },
  };
}

it('a mounted destination gaining coordinates requests its first route', async () => {
  const f = fixture();
  await f.render({ id: destination.id, name: destination.name });
  assert.equal(f.pending.length, 0);
  await f.render(destination);
  assert.equal(f.pending.length, 1);
  assert.deepEqual(f.pending[0]!.request.destination.coordinate, { latitude: 40.81, longitude: -73.94 });
});

it('same-ID destination corrections supersede a pending request and reject its late response', async () => {
  const f = fixture();
  await f.render();
  await f.render({ ...destination, lngLat: [-73.955, 40.815] });
  assert.equal(f.pending.length, 2);
  assert.equal(f.pending[0]!.signal?.aborted, true);
  await f.resolve(1);
  const current = useNavigationStore.getState().session;
  assert.equal(current.phase, 'routeReady');
  assert.ok('destination' in current);
  assert.deepEqual(current.destination.coordinate, { latitude: 40.815, longitude: -73.955 });
  await f.resolve(0);
  assert.equal(useNavigationStore.getState().session, current);
});

it('same-key manual origin corrections replace the preview using the corrected point', async () => {
  const f = fixture();
  await f.render();
  await f.resolve(0);
  await f.render(destination, [{ ...origin, lngLat: [-73.97, 40.83] }]);
  assert.equal(f.pending.length, 2);
  assert.deepEqual(f.pending[1]!.request.origin, { latitude: 40.83, longitude: -73.97 });
  await f.resolve(1);
  const session = useNavigationStore.getState().session;
  assert.ok('origin' in session);
  assert.deepEqual(session.origin, { kind: 'manual', coordinate: { latitude: 40.83, longitude: -73.97 }, label: origin.name });
  assert.equal(runtime.isLocationRunning(), false);
});

for (const removed of ['destination', 'origin', 'origin-record'] as const) {
  it(`removing ${removed} coordinates invalidates pending work and recovers when restored`, async () => {
    const f = fixture();
    await f.render();
    await f.render(
      removed === 'destination' ? { id: destination.id, name: destination.name } : destination,
      removed === 'origin-record' ? [] : removed === 'origin' ? [{ id: origin.id, name: origin.name }] : [origin],
    );
    assert.equal(f.pending.length, 1);
    assert.equal(f.pending[0]!.signal?.aborted, true);
    assert.equal(useNavigationStore.getState().session.phase, 'selectingDestination');
    await f.resolve(0);
    assert.equal(useNavigationStore.getState().session.phase, 'selectingDestination');
    await f.render();
    assert.equal(f.pending.length, 2);
    await f.resolve(1);
    assert.equal(useNavigationStore.getState().session.phase, 'routeReady');
  });
}

it('removing coordinates clears an already-ready preview without dismissing the panel', async () => {
  const f = fixture();
  useNavigationUi.getState().openDirections(destination.id);
  await f.render();
  await f.resolve(0);
  await f.render({ id: destination.id, name: destination.name });
  assert.equal(useNavigationStore.getState().session.phase, 'selectingDestination');
  assert.equal(useNavigationUi.getState().directionsPlaceId, destination.id);
  await f.render();
  assert.equal(f.pending.length, 2);
});

it('value-equivalent arrays, object replacements and unrelated store writes never reroute', async () => {
  const f = fixture();
  await f.render();
  await f.resolve(0);
  const session = useNavigationStore.getState().session;
  for (let i = 0; i < 3; i++) {
    useNavigationUi.getState().setOriginChoice({ kind: 'place', placeId: origin.id });
    useNavigationUi.getState().setOriginPickerOpen(i % 2 === 0);
    await f.render({ ...destination, lngLat: [...destination.lngLat!] }, [{ ...origin, lngLat: [...origin.lngLat!] }]);
  }
  assert.equal(f.pending.length, 1);
  assert.equal(useNavigationStore.getState().session, session);
});

it('mode changes, transit handoff and origin choices invalidate old work exactly once', async () => {
  const f = fixture();
  await f.render();
  useNavigationUi.getState().setMode('cycling');
  await f.host.settle();
  assert.equal(f.pending.length, 2);
  assert.equal(f.pending[1]!.request.mode, 'cycling');
  useNavigationUi.getState().setMode('transit');
  await f.host.settle();
  assert.equal(f.pending.length, 2, 'transit must not reach a routing provider');
  assert.equal(f.pending[1]!.signal?.aborted, true);
  await f.resolve(1);
  assert.equal(useNavigationStore.getState().session.phase, 'selectingDestination');
  useNavigationUi.getState().setMode('walking');
  await f.host.settle();
  assert.equal(f.pending.length, 3);
  useNavigationUi.getState().setOriginChoice({ kind: 'place', placeId: 'another-origin' });
  await f.render(destination, [{ ...origin, id: 'another-origin' }]);
  assert.equal(f.pending.length, 4);
});

it('device routes start on the first fix, ignore later fix values and use the latest fix on destination correction', async () => {
  const f = fixture(false);
  await f.render();
  assert.equal(f.pending.length, 0);
  let timestampMs = Date.now();
  const emit = (longitude: number) => runtime.navigationController().ingestFix({
    coordinate: { latitude: 40.82, longitude }, accuracy: { horizontalM: 6 }, timestampMs: timestampMs++, source: 'device-gps',
  });
  emit(-73.96);
  await f.host.settle();
  assert.equal(f.pending.length, 1);
  emit(-73.96001);
  await f.host.settle();
  assert.equal(f.pending.length, 1);
  const latest = runtime.devicePositionForPlanning(navigationFixStore.getState());
  await f.render({ ...destination, lngLat: [-73.95, 40.815] });
  assert.equal(f.pending.length, 2);
  assert.deepEqual(f.pending[1]!.request.origin, latest);
  await f.resolve(1);
  const session = useNavigationStore.getState().session;
  assert.ok('origin' in session);
  assert.deepEqual(session.origin, { kind: 'device-location' });
  await f.render({ id: destination.id, name: destination.name });
  assert.deepEqual(runtime.devicePositionForPlanning(navigationFixStore.getState()), latest, 'invalidating a preview must keep the device fix');
  await f.render();
  assert.equal(f.pending.length, 3);
  assert.equal(runtime.isLocationRunning(), false, 'rendering must not prompt or start a location watch');
});

it('switching from a manual origin to a device without a fix clears the obsolete manual preview', async () => {
  const f = fixture();
  await f.render();
  await f.resolve(0);
  useNavigationUi.getState().setOriginChoice({ kind: 'device' });
  await f.host.settle();
  assert.equal(f.pending.length, 1);
  assert.equal(useNavigationStore.getState().session.phase, 'selectingDestination');
});

for (const phase of ['navigating', 'paused', 'arrived'] as const) {
  it(`catalogue coordinate changes and removals preserve an active ${phase} trip`, async () => {
    const f = fixture();
    await f.render();
    await f.resolve(0);
    assert.equal(runtime.startGuidance(), true);
    if (phase === 'paused') runtime.navigationController().pause();
    if (phase === 'arrived') {
      const session = useNavigationStore.getState().session;
      assert.ok('activeRoute' in session);
      useNavigationStore.setState({ session: { ...session, phase: 'arrived' } });
    }
    await f.host.settle();
    const trip = useNavigationStore.getState().session;
    await f.render({ ...destination, lngLat: [-73.95, 40.815] }, [{ ...origin, lngLat: [-73.97, 40.83] }]);
    await f.render({ id: destination.id, name: destination.name }, []);
    await f.render();
    assert.equal(f.pending.length, 1);
    assert.equal(useNavigationStore.getState().session, trip);
  });
}


it('manual-origin corrections supersede pending work and ignore its late failure', async () => {
  const f = fixture();
  await f.render();
  await f.render(destination, [{ ...origin, lngLat: [-73.97, 40.83] }]);
  assert.equal(f.pending.length, 2);
  assert.equal(f.pending[0]!.signal?.aborted, true);
  await f.resolve(1);
  const current = useNavigationStore.getState().session;
  f.pending[0]!.response.reject(new RouteProviderError('network', 'mapbox', 'Obsolete request failed'));
  await f.host.settle();
  assert.equal(useNavigationStore.getState().session, current);
});

it("an unavailable panel cannot discard another destination's pending or ready preview", async () => {
  const f = fixture();
  await f.render();
  await f.render({ id: 'unavailable-place', name: 'Another place' });
  assert.equal(f.pending.length, 1);
  assert.equal(f.pending[0]!.signal?.aborted, false);
  await f.resolve(0);
  const current = useNavigationStore.getState().session;
  assert.equal(current.phase, 'routeReady');
  await f.render({ id: 'unavailable-place', name: 'Another place', lngLat: undefined });
  assert.equal(useNavigationStore.getState().session, current);
});

it('a corrected panel for another place cannot replace an arrived active trip', async () => {
  const f = fixture();
  await f.render();
  await f.resolve(0);
  assert.equal(runtime.startGuidance(), true);
  const session = useNavigationStore.getState().session;
  assert.ok('activeRoute' in session);
  const arrived = { ...session, phase: 'arrived' as const };
  useNavigationStore.setState({ session: arrived });
  await f.host.settle();
  await f.render({ id: 'another-destination', name: 'Another destination' });
  await f.render({ ...destination, id: 'another-destination', lngLat: [-73.955, 40.815] });
  assert.equal(f.pending.length, 1);
  assert.equal(useNavigationStore.getState().session, arrived);
});
