import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { PlaceRecord } from '../../content/records.ts';
import { createDirectionsPanelHost } from '../navigation/testing/directionsPanelHost.ts';
import { deferred, flush } from '../navigation/testing/manualClock.ts';
import { verifiedDestination } from '../journey/model.ts';
import type { RouteRequest } from '../navigation/model/route.ts';
import { RouteProviderError } from '../navigation/providers/routeProvider.ts';
import { resetNavigationStores } from '../navigation/session/navigationStore.ts';
import { useNavigationUi } from '../navigation/view/navigationUi.store.ts';
import * as runtime from '../navigation/view/runtime.ts';
import { getCataloguePlace, placeCatalogueStore } from './place-catalogue.store.ts';

const initialCatalogue = placeCatalogueStore.getState();
const hosts: ReturnType<typeof createDirectionsPanelHost>[] = [];
afterEach(() => {
  hosts.splice(0).forEach((host) => host.unmount());
  placeCatalogueStore.setState(initialCatalogue);
  runtime.resetNavigationRuntimeForTests();
  resetNavigationStores();
  useNavigationUi.getState().resetTrip();
});

/** The same mounted panel receives each detail-authoritative catalogue update. */
function mountedDirections(placeId: string) {
  const host = createDirectionsPanelHost();
  hosts.push(host);
  return async () => {
    const place = getCataloguePlace(placeId);
    assert.ok(place);
    host.render({ place, originPlaces: placeCatalogueStore.getState().places });
    await host.settle();
  };
}

for (const location of [[-73.94, 40.81] as [number, number], undefined]) {
  test(`directions requests the detail-verified coordinate after ${location ? 'a correction' : 'a location is added'}`, async () => {
    const old: PlaceRecord = {
      id: 1, slug: 'destination', name: 'Old destination', kind: 'business', lifecycle: 'open',
      location, locationAccuracy: 'approx', featured: false, images: [],
    };
    const corrected: PlaceRecord = {
      ...old, name: 'Verified destination', location: [-73.955, 40.815], locationAccuracy: 'verified',
      locationSourceUrl: 'https://example.com/destination', locationSourceReadAt: new Date(Date.now() - 1000).toISOString(),
    };
    const origin: PlaceRecord = { ...old, id: 2, slug: 'origin', name: 'Origin', location: [-73.96, 40.82] };
    const store = placeCatalogueStore.getState();
    store.connect({
      listExploreCatalogue: async () => ({ status: 'ok', data: [old, origin] }),
      getPlace: async () => ({ status: 'ok', data: corrected }),
    });
    await store.refresh();
    const verified = verifiedDestination(corrected);
    assert.ok(verified, 'The detail CTA must be enabled by this record');
    const requests: RouteRequest[] = [];
    runtime.configureNavigationRuntime({ provider: {
      id: 'mapbox', supportedModes: ['walking'],
      async getRoutes(request) {
        requests.push(request);
        throw new RouteProviderError('no-route', 'mapbox', 'Fixture stops after observing the destination');
      },
    } });
    useNavigationUi.getState().setOriginChoice({ kind: 'place', placeId: 'origin' });
    const render = mountedDirections('destination');
    await render();
    assert.equal(requests.length, location ? 1 : 0);
    await store.loadPlace('destination');
    await render();
    assert.equal(requests.length, location ? 2 : 1);
    assert.deepEqual(requests.at(-1)?.destination, verified);
    assert.deepEqual(requests.at(-1)?.origin, { longitude: -73.96, latitude: 40.82 });
  });
}


test('an older catalogue settling after detail correction does not revert or repeat the mounted route', async () => {
  const old: PlaceRecord = {
    id: 1, slug: 'destination', name: 'Destination', kind: 'business', lifecycle: 'open',
    location: [-73.94, 40.81], locationAccuracy: 'approx', featured: false, images: [],
  };
  const corrected: PlaceRecord = { ...old, location: [-73.955, 40.815], locationAccuracy: 'verified' };
  const origin: PlaceRecord = { ...old, id: 2, slug: 'origin', name: 'Origin', location: [-73.96, 40.82] };
  const lateCatalogue = deferred<{ status: 'ok'; data: PlaceRecord[] }>();
  let listReads = 0;
  const store = placeCatalogueStore.getState();
  store.connect({
    listExploreCatalogue: async () => ++listReads === 1 ? { status: 'ok', data: [old, origin] } : lateCatalogue.promise,
    getPlace: async () => ({ status: 'ok', data: corrected }),
  });
  await store.refresh();
  const requests: RouteRequest[] = [];
  runtime.configureNavigationRuntime({ provider: {
    id: 'mapbox', supportedModes: ['walking'],
    async getRoutes(request) {
      requests.push(request);
      throw new RouteProviderError('no-route', 'mapbox', 'Local fixture');
    },
  } });
  useNavigationUi.getState().setOriginChoice({ kind: 'place', placeId: 'origin' });
  const render = mountedDirections('destination');
  await render();
  const refreshing = store.refresh();
  await flush();
  await store.loadPlace('destination');
  await render();
  assert.equal(requests.length, 2);
  lateCatalogue.resolve({ status: 'ok', data: [old, origin] });
  await refreshing;
  await render();
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.at(-1)?.destination.coordinate, { longitude: -73.955, latitude: 40.815 });
  assert.deepEqual(getCataloguePlace('destination')?.lngLat, corrected.location);
});
