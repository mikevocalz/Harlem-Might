import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PlaceRecord } from '../../content/records.ts';
import type { ContentResult, DetailResult } from '../../content/result.ts';
import { catalogueNearbyPlaces, getCataloguePlace, placeCatalogueStore } from './place-catalogue.store.ts';
import { explorePlaceFromRecord } from './catalogue.ts';
import { verifiedDestination } from '../journey/model.ts';
import { filterPlaces } from './place-model.ts';
import type { PlaceCatalogueSnapshot } from './catalogue-persistence.ts';
import { placesGeoJson } from './explore-map-layers.ts';
import { createHydratedCatalogueStore } from './test-helpers/hydrated-catalogue.ts';

const place = (slug: string, longitude = -73.94): PlaceRecord => ({
  id: 101, slug, name: slug, kind: 'business', lifecycle: 'open',
  category: 'Imported category', location: [longitude, 40.81],
  locationAccuracy: 'approx', featured: false, images: [],
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test('API places outside the preview fixture reach search, map points and nearby selection', async () => {
  const store = createHydratedCatalogueStore();
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
  const store = createHydratedCatalogueStore();
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
  const store = createHydratedCatalogueStore();
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
  const store = createHydratedCatalogueStore();
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
  const store = createHydratedCatalogueStore();
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
  const store = createHydratedCatalogueStore();
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
  const store = createHydratedCatalogueStore({
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
  const store = createHydratedCatalogueStore({
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

test('a failed refresh retries on the configured backoff and recovers without a caller', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let fail = true;
  let reads = 0;
  const store = createHydratedCatalogueStore({ retryDelaysMs: [50] });
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
  t.mock.timers.tick(49);
  await Promise.resolve();
  assert.equal(reads, 1, 'the retry must wait for its configured delay');
  t.mock.timers.tick(1);
  await Promise.resolve();
  assert.equal(reads, 2);
  // Join the request the timer already started; refresh deduplicates it.
  await store.getState().refresh();
  assert.equal(store.getState().loadState.status, 'ready');
  assert.equal(store.getState().places[0]?.id, 'recovered');
});

test('retries stop after the configured delays are exhausted', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let reads = 0;
  const store = createHydratedCatalogueStore({ retryDelaysMs: [50, 100] });
  store.getState().connect({
    listExploreCatalogue: async () => { reads++; throw new Error('offline'); },
    getPlace: async () => ({ status: 'not-found' }),
  });
  await store.getState().refresh();
  for (const [delay, expectedReads] of [[50, 2], [100, 3]] as const) {
    t.mock.timers.tick(delay - 1);
    await Promise.resolve();
    assert.equal(reads, expectedReads - 1, 'each retry must honor its own backoff');
    t.mock.timers.tick(1);
    await Promise.resolve();
    assert.equal(reads, expectedReads);
    await store.getState().refresh();
  }
  t.mock.timers.tick(1_000);
  await Promise.resolve();
  assert.equal(reads, 3);
  assert.equal(store.getState().loadState.status, 'unavailable');
});

for (const hadCoordinates of [true, false]) {
  test(`a verified detail ${hadCoordinates ? 'corrects' : 'adds'} the catalogue destination before directions opens`, async () => {
    const store = createHydratedCatalogueStore();
    const old = { ...place('destination'), ...(hadCoordinates ? {} : { location: undefined }) };
    const corrected: PlaceRecord = {
      ...place('destination', -73.955), name: 'Corrected destination', locationAccuracy: 'verified',
      locationSourceUrl: 'https://example.com/place', locationSourceReadAt: '2026-10-12T00:00:00Z',
    };
    store.getState().connect({
      listExploreCatalogue: async () => ({ status: 'ok', data: [old, place('unchanged')] }),
      getPlace: async () => ({ status: 'ok', data: corrected }),
    });
    await store.getState().refresh();
    const previous = store.getState().places;
    let catalogueNotifications = 0;
    const unsubscribe = store.subscribe((state, last) => {
      if (state.places !== last.places) catalogueNotifications++;
    });
    await store.getState().loadPlace('destination');
    unsubscribe();
    const projection = store.getState().places[0]!;
    const verified = verifiedDestination(corrected, Date.parse('2026-10-12T12:00:00Z'))!;
    assert.ok(verified);
    assert.deepEqual(projection.lngLat, [verified.coordinate.longitude, verified.coordinate.latitude]);
    assert.equal(projection.name, verified.name);
    assert.equal(catalogueNotifications, 1);
    assert.equal(store.getState().places.length, 2);
    assert.equal(store.getState().places[1], previous[1]);
  });
}

test('the common lookup prefers successful detail even if the catalogue still contains an older projection', (t) => {
  const initial = placeCatalogueStore.getState();
  t.after(() => placeCatalogueStore.setState(initial));
  const corrected = { ...place('destination', -73.955), name: 'Corrected destination' };
  placeCatalogueStore.setState({
    places: [explorePlaceFromRecord(place('destination'))],
    details: { destination: { status: 'ok', data: corrected } },
  });
  assert.deepEqual(getCataloguePlace('destination'), explorePlaceFromRecord(corrected));
  assert.equal(getCataloguePlace('destination'), getCataloguePlace('destination'), 'Stable projections avoid rebuilding native scene geometry');
});

for (const detailFirst of [true, false]) {
  test(`detail and catalogue requests reconcile when ${detailFirst ? 'detail' : 'catalogue'} settles first`, async () => {
    const store = createHydratedCatalogueStore();
    const catalogue = deferred<ContentResult<PlaceRecord[]>>();
    const detail = deferred<{ status: 'ok'; data: PlaceRecord }>();
    const corrected = { ...place('destination', -73.955), name: 'Corrected destination' };
    store.getState().connect({ listExploreCatalogue: () => catalogue.promise, getPlace: () => detail.promise });
    const refreshing = store.getState().refresh();
    const loading = store.getState().loadPlace('destination');
    if (detailFirst) {
      detail.resolve({ status: 'ok', data: corrected });
      await loading;
      catalogue.resolve({ status: 'ok', data: [place('destination'), place('other')] });
    } else {
      catalogue.resolve({ status: 'ok', data: [place('destination'), place('other')] });
      await refreshing;
      detail.resolve({ status: 'ok', data: corrected });
    }
    await Promise.all([refreshing, loading]);
    assert.deepEqual(store.getState().places.find((p) => p.id === 'destination'), explorePlaceFromRecord(corrected));
    assert.deepEqual(store.getState().places.map((p) => p.id), ['destination', 'other']);
    // A genuinely newer foreground read invalidates the old full detail.
    await store.getState().refresh();
    assert.deepEqual(store.getState().places[0]?.lngLat, place('destination').location);
    assert.equal(store.getState().details.destination, undefined);
  });
}

test('an unavailable detail preserves the previous catalogue projection and remains retryable', async () => {
  const store = createHydratedCatalogueStore();
  let unavailable = true;
  const corrected = place('destination', -73.955);
  store.getState().connect({
    listExploreCatalogue: async () => ({ status: 'ok', data: [place('destination')] }),
    getPlace: async () => unavailable ? { status: 'unavailable', reason: 'not-configured' } : { status: 'ok', data: corrected },
  });
  await store.getState().refresh();
  const previous = store.getState().places;
  await store.getState().loadPlace('destination');
  assert.equal(store.getState().places, previous);
  unavailable = false;
  await store.getState().loadPlace('destination');
  assert.deepEqual(store.getState().places[0]?.lngLat, corrected.location);
});

test('an older list response persists newer detail-authoritative coordinates for the next launch', async () => {
  const saved: PlaceCatalogueSnapshot[] = [];
  const store = createHydratedCatalogueStore({
    persistence: { load: () => undefined, save: (snapshot) => saved.push(structuredClone(snapshot)) },
  });
  const catalogue = deferred<ContentResult<PlaceRecord[]>>();
  const started = deferred<void>();
  const corrected: PlaceRecord = {
    ...place('destination', -73.955), name: 'Verified destination', locationAccuracy: 'verified',
    locationSourceUrl: 'https://example.com/place', locationSourceReadAt: '2026-10-12T00:00:00Z',
  };
  store.getState().connect({
    listExploreCatalogue: () => { started.resolve(); return catalogue.promise; },
    getPlace: async () => ({ status: 'ok', data: corrected }),
  });
  const refreshing = store.getState().refresh();
  await started.promise;
  await store.getState().loadPlace('destination');
  const authoritativeProjection = store.getState().places[0];
  assert.equal(saved.length, 1, 'the successful detail is durable before the list settles');
  assert.deepEqual(saved[0]?.places[0]?.lngLat, corrected.location);

  catalogue.resolve({ status: 'ok', data: [place('destination'), place('other')] });
  await refreshing;
  assert.equal(saved.length, 2, 'the reconciled catalogue is also persisted');
  assert.equal(store.getState().places[0], authoritativeProjection, 'the detail projection stays stable');
  const last = saved.at(-1)!;
  assert.deepEqual(last.places.map((entry) => entry.id), ['destination', 'other']);
  assert.deepEqual(last.places[0], explorePlaceFromRecord(corrected));
  assert.deepEqual(last.details.destination, { status: 'ok', data: corrected });

  const relaunched = createHydratedCatalogueStore({ persistence: { load: () => last, save: () => {} } });
  assert.deepEqual(relaunched.getState().places[0]?.lngLat, corrected.location);
  let revalidations = 0;
  const current: PlaceRecord = { ...corrected, location: undefined, locationAccuracy: 'pending' };
  relaunched.getState().connect({
    listExploreCatalogue: async () => ({ status: 'ok', data: [current, place('other')] }),
    getPlace: async () => { revalidations++; return { status: 'ok', data: current }; },
  });
  await relaunched.getState().loadPlace('destination');
  await relaunched.getState().refresh();
  assert.equal(revalidations, 1, 'hydrated detail must be verified again in the new runtime');
  assert.deepEqual(relaunched.getState().places[0], explorePlaceFromRecord(current));
});

test('a successful refresh cancels its pending retry and resets the next backoff', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let fail = true;
  let reads = 0;
  const store = createHydratedCatalogueStore({ retryDelaysMs: [50, 100] });
  store.getState().connect({
    listExploreCatalogue: async () => {
      reads++;
      if (fail) throw new Error('offline');
      return { status: 'ok', data: [place('recovered')] };
    },
    getPlace: async () => ({ status: 'not-found' }),
  });
  await store.getState().refresh();
  fail = false;
  await store.getState().refresh();
  t.mock.timers.tick(50);
  await Promise.resolve();
  assert.equal(reads, 2, 'the canceled retry must not issue a redundant read');

  fail = true;
  await store.getState().refresh();
  t.mock.timers.tick(49);
  await Promise.resolve();
  assert.equal(reads, 3);
  fail = false;
  t.mock.timers.tick(1);
  await Promise.resolve();
  assert.equal(reads, 4, 'a new failure starts at the first backoff delay');
  await store.getState().refresh();
  assert.equal(store.getState().loadState.status, 'ready');
});

const cachedVerified = (): PlaceRecord => ({
  ...place('destination'), name: 'Cached destination', locationAccuracy: 'verified',
  locationSourceUrl: 'https://example.com/place', locationSourceReadAt: '2026-10-11T00:00:00Z',
});
const cachedSnapshot = (record = cachedVerified()): PlaceCatalogueSnapshot => ({
  schemaVersion: 2,
  places: [explorePlaceFromRecord(record)],
  details: { [record.slug]: { status: 'ok', data: record } },
});

for (const accuracy of ['pending', 'verified'] as const) {
  test(`a fresh ${accuracy} list without coordinates supersedes hydrated verified detail`, async (t) => {
    const saved: PlaceCatalogueSnapshot[] = [];
    const store = createHydratedCatalogueStore({
      persistence: { load: () => cachedSnapshot(), save: (snapshot) => saved.push(structuredClone(snapshot)) },
    });
    const current: PlaceRecord = { ...cachedVerified(), name: 'Current destination', location: undefined, locationAccuracy: accuracy };
    let reads = 0;
    store.getState().connect({
      listExploreCatalogue: async () => ({ status: 'ok', data: [current] }),
      getPlace: async () => { reads++; return { status: 'ok', data: current }; },
    });
    await store.getState().refresh();
    assert.deepEqual(store.getState().places[0], explorePlaceFromRecord(current));
    assert.equal(store.getState().details.destination, undefined, 'detail panels must not reuse the old verified record');
    const initial = placeCatalogueStore.getState();
    t.after(() => placeCatalogueStore.setState(initial));
    placeCatalogueStore.setState({ places: store.getState().places, details: store.getState().details });
    assert.equal(getCataloguePlace('destination')?.lngLat, undefined);
    assert.equal(saved.at(-1)?.details.destination, undefined);
    assert.equal(saved.at(-1)?.places[0]?.lngLat, undefined);
    await store.getState().loadPlace('destination');
    assert.equal(reads, 1);
    const detail = store.getState().details.destination;
    assert.equal(detail?.status, 'ok');
    if (detail?.status === 'ok') assert.equal(verifiedDestination(detail.data), undefined);
  });
}

test('an empty fresh catalogue removes hydrated details and their old mapped destinations', async () => {
  const store = createHydratedCatalogueStore({ persistence: { load: () => cachedSnapshot(), save: () => {} } });
  store.getState().connect({
    listExploreCatalogue: async () => ({ status: 'ok', data: [] }),
    getPlace: async () => ({ status: 'not-found' }),
  });
  await store.getState().refresh();
  assert.deepEqual(store.getState().places, []);
  assert.equal(store.getState().details.destination, undefined);
});

test('hydrated detail revalidates once and its live correction wins an older in-flight catalogue', async () => {
  const saved: PlaceCatalogueSnapshot[] = [];
  const store = createHydratedCatalogueStore({
    persistence: { load: () => cachedSnapshot(), save: (snapshot) => saved.push(structuredClone(snapshot)) },
  });
  const catalogue = deferred<ContentResult<PlaceRecord[]>>();
  const detail = deferred<{ status: 'ok'; data: PlaceRecord }>();
  const current = { ...cachedVerified(), name: 'Revalidated destination', location: [-73.955, 40.82] as [number, number] };
  let reads = 0;
  store.getState().connect({
    listExploreCatalogue: () => catalogue.promise,
    getPlace: () => { reads++; return detail.promise; },
  });
  const refreshing = store.getState().refresh();
  const loading = store.getState().loadPlace('destination');
  assert.equal(store.getState().loadPlace('destination'), loading);
  assert.equal(reads, 1);
  detail.resolve({ status: 'ok', data: current });
  await loading;
  const live = store.getState().places[0];
  catalogue.resolve({ status: 'ok', data: [cachedVerified()] });
  await refreshing;
  assert.equal(store.getState().places[0], live);
  assert.deepEqual(saved.at(-1)?.places[0]?.lngLat, current.location);
  assert.deepEqual(saved.at(-1)?.details.destination, { status: 'ok', data: current });
  await store.getState().loadPlace('destination');
  assert.equal(reads, 1, 'successful live detail still satisfies subsequent loads');
});

for (const failure of ['throw', 'unavailable'] as const) {
  test(`offline ${failure} retains cached display but cannot restore it after a fresh unmapped list`, async () => {
    const store = createHydratedCatalogueStore({ persistence: { load: () => cachedSnapshot(), save: () => {} } });
    let offline = true;
    let reads = 0;
    const current: PlaceRecord = { ...cachedVerified(), name: 'Current destination', location: undefined, locationAccuracy: 'pending' };
    store.getState().connect({
      listExploreCatalogue: async () => offline ? { status: 'unavailable', reason: 'not-configured' } : { status: 'ok', data: [current] },
      getPlace: async () => {
        reads++;
        if (failure === 'throw') throw new Error('offline');
        return { status: 'unavailable', reason: 'not-configured' };
      },
    });
    await store.getState().refresh();
    await store.getState().loadPlace('destination');
    await store.getState().loadPlace('destination');
    assert.equal(reads, 2, 'offline cache must not short-circuit another revalidation');
    assert.deepEqual(store.getState().places[0]?.lngLat, cachedVerified().location);
    assert.deepEqual(store.getState().details.destination, { status: 'ok', data: cachedVerified() });
    assert.equal(store.getState().loadState.status, 'unavailable');
    offline = false;
    await store.getState().refresh();
    await store.getState().loadPlace('destination');
    assert.equal(reads, 3);
    assert.equal(store.getState().places[0]?.lngLat, undefined);
    assert.equal(store.getState().details.destination?.status, 'unavailable');
  });
}

test('a revalidated missing detail removes cached coordinates and an older list cannot resurrect them', async () => {
  const saved: PlaceCatalogueSnapshot[] = [];
  const store = createHydratedCatalogueStore({
    persistence: { load: () => cachedSnapshot(), save: (snapshot) => saved.push(structuredClone(snapshot)) },
  });
  const catalogue = deferred<ContentResult<PlaceRecord[]>>();
  store.getState().connect({ listExploreCatalogue: () => catalogue.promise, getPlace: async () => ({ status: 'not-found' }) });
  const refreshing = store.getState().refresh();
  await store.getState().loadPlace('destination');
  assert.deepEqual(store.getState().places, []);
  catalogue.resolve({ status: 'ok', data: [cachedVerified()] });
  await refreshing;
  assert.deepEqual(store.getState().places, []);
  assert.equal(store.getState().details.destination?.status, 'not-found');
  assert.deepEqual(saved.at(-1)?.places, []);
});

for (const schemaVersion of [undefined, 2] as const) {
  test(`${schemaVersion === 2 ? 'current' : 'legacy'} snapshots hydrate only provable cached coordinates`, () => {
    const pending: PlaceRecord = { ...cachedVerified(), slug: 'pending', locationAccuracy: 'pending' };
    const known = cachedVerified();
    const unproven = place('list-only');
    const store = createHydratedCatalogueStore({ persistence: {
      load: () => ({
        schemaVersion,
        places: [explorePlaceFromRecord(pending), explorePlaceFromRecord(known), explorePlaceFromRecord(unproven)],
        details: { pending: { status: 'ok', data: pending }, destination: { status: 'ok', data: known } },
      }),
      save: () => {},
    } });
    assert.equal(store.getState().places[0]?.lngLat, undefined);
    assert.deepEqual(store.getState().places[1]?.lngLat, known.location);
    assert.deepEqual(store.getState().places[2]?.lngLat, schemaVersion === 2 ? unproven.location : undefined);
    const detail = store.getState().details.pending;
    assert.equal(detail?.status, 'ok');
    if (detail?.status === 'ok') assert.equal(detail.data.location, undefined);
    assert.equal(store.getState().places[2]?.name, unproven.name, 'legacy display facts remain available offline');
  });
}

test('a newer foreground catalogue invalidates completed live detail and removes its old CTA coordinates', async () => {
  const saved: PlaceCatalogueSnapshot[] = [];
  const store = createHydratedCatalogueStore({ persistence: { load: () => undefined, save: (snapshot) => saved.push(snapshot) } });
  let current = cachedVerified();
  store.getState().connect({
    listExploreCatalogue: async () => ({ status: 'ok', data: [current] }),
    getPlace: async () => ({ status: 'ok', data: current }),
  });
  await store.getState().refresh();
  await store.getState().loadPlace('destination');
  assert.equal(store.getState().details.destination?.status, 'ok');
  current = { ...current, name: 'Location under review', location: undefined, locationAccuracy: 'pending' };
  await store.getState().refresh();
  assert.deepEqual(store.getState().places[0], explorePlaceFromRecord(current));
  assert.equal(store.getState().details.destination, undefined);
  assert.equal(saved.at(-1)?.details.destination, undefined);
  await store.getState().loadPlace('destination');
  const detail = store.getState().details.destination;
  if (detail?.status === 'ok') assert.equal(verifiedDestination(detail.data), undefined);
  else assert.fail('the fresh detail must load');
});

for (const result of [
  { status: 'ok', data: cachedVerified() },
  { status: 'not-found' },
  { status: 'unavailable', reason: 'not-configured' },
] satisfies DetailResult<PlaceRecord>[]) {
  test(`a superseded ${result.status} detail cannot overwrite a newer list or clear its replacement request`, async () => {
    const store = createHydratedCatalogueStore();
    const old = deferred<DetailResult<PlaceRecord>>();
    const replacement = deferred<DetailResult<PlaceRecord>>();
    let reads = 0;
    const current: PlaceRecord = { ...cachedVerified(), name: 'Current location', location: undefined, locationAccuracy: 'pending' };
    store.getState().connect({
      listExploreCatalogue: async () => ({ status: 'ok', data: [current] }),
      getPlace: () => ++reads === 1 ? old.promise : replacement.promise,
    });
    const loading = store.getState().loadPlace('destination');
    await store.getState().refresh();
    const replacing = store.getState().loadPlace('destination');
    assert.equal(reads, 2);
    old.resolve(result);
    await loading;
    assert.equal(store.getState().details.destination, undefined);
    assert.deepEqual(store.getState().places[0], explorePlaceFromRecord(current));
    assert.equal(store.getState().loadPlace('destination'), replacing);
    assert.equal(reads, 2, 'old cleanup must not release the new in-flight slot');
    replacement.resolve({ status: 'ok', data: current });
    await replacing;
    assert.deepEqual(store.getState().details.destination, { status: 'ok', data: current });
  });
}

test('a failed newer refresh leaves last-good live detail authoritative and displayable', async () => {
  const store = createHydratedCatalogueStore();
  store.getState().connect({
    listExploreCatalogue: async () => ({ status: 'unavailable', reason: 'not-configured' }),
    getPlace: async () => ({ status: 'ok', data: cachedVerified() }),
  });
  await store.getState().loadPlace('destination');
  const previous = store.getState();
  await store.getState().refresh();
  assert.equal(store.getState().places, previous.places);
  assert.equal(store.getState().details, previous.details);
  assert.equal(store.getState().loadState.status, 'unavailable');
});

test('an older empty catalogue retains a newer deep-link detail, while a newer empty refresh clears it', async () => {
  const saved: PlaceCatalogueSnapshot[] = [];
  const store = createHydratedCatalogueStore({ persistence: { load: () => undefined, save: (snapshot) => saved.push(snapshot) } });
  const older = deferred<ContentResult<PlaceRecord[]>>();
  const record = cachedVerified();
  store.getState().connect({ listExploreCatalogue: () => older.promise, getPlace: async () => ({ status: 'ok', data: record }) });
  const refreshing = store.getState().refresh();
  await store.getState().loadPlace('destination');
  const live = store.getState().places[0];
  older.resolve({ status: 'ok', data: [] });
  await refreshing;
  assert.equal(store.getState().places[0], live);
  assert.equal(store.getState().places.length, 1);
  assert.deepEqual(saved.at(-1)?.places[0]?.lngLat, record.location);
  assert.equal(saved.at(-1)?.details.destination?.status, 'ok');
  await store.getState().refresh();
  assert.deepEqual(store.getState().places, []);
  assert.equal(store.getState().details.destination, undefined);
  assert.deepEqual(saved.at(-1)?.places, []);
});
