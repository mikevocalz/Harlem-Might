import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PlaceRecord } from '../../content/records.ts';
import type { ContentResult } from '../../content/result.ts';
import { createPlaceCatalogueStore, catalogueNearbyPlaces } from './place-catalogue.store.ts';
import { explorePlaceFromRecord } from './catalogue.ts';
import { filterPlaces } from './explore.store.ts';
import { placesGeoJson } from './explore-map-layers.ts';

const place = (slug: string, longitude = -73.94): PlaceRecord => ({
  id: 101, slug, name: slug, kind: 'business', lifecycle: 'open',
  category: 'Imported category', location: [longitude, 40.81],
  locationAccuracy: 'approx', featured: false, images: [],
});

test('API places outside the preview fixture reach search, map points and nearby selection', async () => {
  const store = createPlaceCatalogueStore();
  store.getState().connect({
    listExploreCatalogue: async () => ({ status: 'ok', data: [place('new-cafe'), place('new-bookshop', -73.941)] }),
    getPlace: async (slug) => ({ status: 'ok', data: place(slug) }),
  });
  await store.getState().refresh();
  const places = store.getState().places;
  assert.equal(store.getState().loadState.status, 'ready');
  assert.equal(filterPlaces(places, 'bookshop', 'Imported category')[0]?.id, 'new-bookshop');
  const points = places.flatMap((p) => p.lngLat ? [{ id: p.id, name: p.name, lngLat: p.lngLat }] : []);
  assert.equal(JSON.parse(placesGeoJson(points)).features.length, 2);
  assert.equal(catalogueNearbyPlaces(places[0]!, places)[0]?.place.id, 'new-bookshop');
});

test('failed reads keep the last catalogue and expose an error; a successful empty read clears it', async () => {
  const store = createPlaceCatalogueStore();
  let result: ContentResult<PlaceRecord[]> = { status: 'ok', data: [place('new-cafe')] };
  store.getState().connect({ listExploreCatalogue: async () => result, getPlace: async () => ({ status: 'not-found' }) });
  await store.getState().refresh();
  result = { status: 'unavailable', reason: 'query-failed', error: new Error('offline') };
  await store.getState().refresh();
  assert.equal(store.getState().loadState.status, 'unavailable');
  assert.equal(store.getState().places.length, 1);
  result = { status: 'ok', data: [] };
  await store.getState().refresh();
  assert.equal(store.getState().loadState.status, 'ready');
  assert.deepEqual(store.getState().places, []);
});

test('concurrent windows share one catalogue read', async () => {
  const store = createPlaceCatalogueStore();
  let resolve!: (value: ContentResult<PlaceRecord[]>) => void;
  let reads = 0;
  store.getState().connect({
    listExploreCatalogue: () => { reads++; return new Promise((r) => { resolve = r; }); },
    getPlace: async () => ({ status: 'not-found' }),
  });
  const first = store.getState().refresh();
  const second = store.getState().refresh();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(reads, 1);
  resolve({ status: 'ok', data: [place('new-cafe')] });
  await first;
  assert.equal(store.getState().places.length, 1);
});

test('a deep-linked detail loads its real record, preserving photos and making it selectable', async () => {
  const store = createPlaceCatalogueStore();
  const record = { ...place('direct-link'), summary: 'Published description', website: 'https://example.com' };
  let reads = 0;
  store.getState().connect({
    listExploreCatalogue: async () => ({ status: 'ok', data: [] }),
    getPlace: async () => { reads++; return { status: 'ok', data: record }; },
  });
  await Promise.all([store.getState().loadPlace(record.slug), store.getState().loadPlace(record.slug)]);
  assert.equal(reads, 1);
  assert.deepEqual(store.getState().details[record.slug], { status: 'ok', data: record });
  assert.equal(store.getState().places[0]?.shortDescription, record.summary);
});

test('unavailable detail can retry and is distinct from not found', async () => {
  const store = createPlaceCatalogueStore();
  let offline = true;
  store.getState().connect({
    listExploreCatalogue: async () => ({ status: 'ok', data: [] }),
    getPlace: async () => {
      if (offline) throw new Error('offline');
      return { status: 'not-found' };
    },
  });
  await store.getState().loadPlace('missing');
  assert.equal(store.getState().details.missing?.status, 'unavailable');
  offline = false;
  await store.getState().loadPlace('missing');
  assert.equal(store.getState().details.missing?.status, 'not-found');
});


test('a synchronous reader failure releases the request so retry can recover', async () => {
  const store = createPlaceCatalogueStore();
  let fail = true;
  store.getState().connect({
    listExploreCatalogue: () => {
      if (fail) throw new Error('reader setup failed');
      return Promise.resolve({ status: 'ok', data: [place('recovered')] });
    },
    getPlace: async () => ({ status: 'not-found' }),
  });
  await store.getState().refresh();
  assert.equal(store.getState().loadState.status, 'unavailable');
  fail = false;
  await store.getState().refresh();
  assert.equal(store.getState().places[0]?.id, 'recovered');
  assert.equal(store.getState().loadState.status, 'ready');
});

test('a persisted snapshot hydrates the catalogue before the first refresh', () => {
  const cached = place('cached-cafe');
  const store = createPlaceCatalogueStore({
    persistence: {
      load: () => ({
        places: [explorePlaceFromRecord(cached)],
        details: { 'cached-cafe': { status: 'ok', data: cached } },
      }),
      save: () => {},
    },
  });
  assert.equal(store.getState().places[0]?.id, 'cached-cafe');
  assert.equal(store.getState().details['cached-cafe']?.status, 'ok');
  assert.equal(store.getState().loadState.status, 'idle');
});

test('successful catalogue and detail reads persist for the next launch', async () => {
  const saved: { places: readonly unknown[]; details: Record<string, unknown> }[] = [];
  const store = createPlaceCatalogueStore({
    persistence: { load: () => undefined, save: (snapshot) => saved.push(snapshot) },
  });
  store.getState().connect({
    listExploreCatalogue: async () => ({ status: 'ok', data: [place('new-cafe')] }),
    getPlace: async (slug) => ({ status: 'ok', data: place(slug) }),
  });
  await store.getState().refresh();
  await store.getState().loadPlace('new-cafe');
  const last = saved.at(-1);
  assert.ok(last);
  assert.equal(last.places.length, 1);
  assert.equal((last.details['new-cafe'] as { status: string }).status, 'ok');
});

test('a failed refresh retries on the configured backoff and recovers without a caller', async () => {
  let fail = true;
  let reads = 0;
  const store = createPlaceCatalogueStore({ retryDelaysMs: [1] });
  store.getState().connect({
    listExploreCatalogue: async () => {
      reads++;
      if (fail) throw new Error('offline');
      return { status: 'ok', data: [place('recovered')] };
    },
    getPlace: async () => ({ status: 'not-found' }),
  });
  await store.getState().refresh();
  assert.equal(store.getState().loadState.status, 'unavailable');
  fail = false;
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(reads, 2);
  assert.equal(store.getState().loadState.status, 'ready');
  assert.equal(store.getState().places[0]?.id, 'recovered');
});

test('retries stop after the configured delays are exhausted', async () => {
  let reads = 0;
  const store = createPlaceCatalogueStore({ retryDelaysMs: [1, 1] });
  store.getState().connect({
    listExploreCatalogue: async () => { reads++; throw new Error('offline'); },
    getPlace: async () => ({ status: 'not-found' }),
  });
  await store.getState().refresh();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(reads, 3);
  assert.equal(store.getState().loadState.status, 'unavailable');
});
