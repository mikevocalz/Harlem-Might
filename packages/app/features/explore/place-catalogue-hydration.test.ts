import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PlaceRecord } from '../../content/records.ts';
import type { ContentResult, DetailResult } from '../../content/result.ts';
import type { PlaceCatalogueSnapshot } from './catalogue-persistence.ts';
import { explorePlaceFromRecord } from './catalogue.ts';
import { createPlaceCatalogueStore } from './place-catalogue.store.ts';

const place = (slug = 'destination'): PlaceRecord => ({
  id: 101, slug, name: `Cached ${slug}`, kind: 'business', lifecycle: 'open',
  location: [-73.94, 40.81], locationAccuracy: 'verified', featured: false, images: [],
});
const snapshot = (): PlaceCatalogueSnapshot => ({
  schemaVersion: 2,
  places: [place(), place('other')].map(explorePlaceFromRecord),
  details: { destination: { status: 'ok', data: place() }, other: { status: 'ok', data: place('other') } },
});
const current: PlaceRecord = { ...place(), name: 'Current destination', location: undefined, locationAccuracy: 'pending' };
const offline = { status: 'unavailable', reason: 'not-configured' } as const;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

for (const first of ['throw', 'undefined'] as const) {
  test(`explicit hydration retries ${first} and does not write, notify twice or promote cache to live authority`, async () => {
    let ready = false;
    let loads = 0;
    let saves = 0;
    let reads = 0;
    const store = createPlaceCatalogueStore({ persistence: {
      load: () => {
        loads++;
        if (ready) return snapshot();
        if (first === 'throw') throw new Error('Storage is not ready');
        return undefined;
      },
      save: () => { saves++; },
    } });
    assert.equal(loads, 0, 'constructing a store never reads persistence');
    store.getState().connect({ listExploreCatalogue: async () => offline, getPlace: async () => { reads++; return offline; } });
    assert.equal(loads, 0, 'connecting readers never reads persistence');
    assert.doesNotThrow(store.getState().hydrate);
    await store.getState().loadPlace('destination');
    await store.getState().refresh();
    const loadState = store.getState().loadState;
    let notifications = 0;
    store.subscribe(() => { notifications++; });
    ready = true;
    store.getState().hydrate();
    assert.equal(loads, 2);
    assert.equal(saves, 0);
    assert.equal(notifications, 1);
    assert.equal(store.getState().loadState, loadState);
    const state = store.getState();
    store.getState().hydrate();
    assert.equal(loads, 2);
    assert.equal(store.getState(), state);
    assert.equal(notifications, 1);
    await store.getState().loadPlace('destination');
    await store.getState().loadPlace('destination');
    assert.equal(reads, 3, 'a failed early detail must not stop revalidation after cache recovery');
    assert.deepEqual(store.getState().details.destination, { status: 'ok', data: place() });
  });
}

test('an empty decoded snapshot is hydrated once and reentrant lifecycle calls are guarded', () => {
  let loads = 0;
  const store = createPlaceCatalogueStore({ persistence: {
    load: () => { loads++; store.getState().hydrate(); return { schemaVersion: 2, places: [], details: {} }; },
    save: () => { assert.fail('hydration must not write'); },
  } });
  store.subscribe(() => store.getState().hydrate());
  store.getState().hydrate();
  store.getState().hydrate();
  assert.equal(loads, 1);
  assert.deepEqual(store.getState().places, []);
});

for (const result of [
  { status: 'ok', data: [] },
  { status: 'ok', data: [current] },
  offline,
] satisfies ContentResult<PlaceRecord[]>[]) {
  test(`hydration during an in-flight ${result.status === 'ok' ? result.data.length ? 'corrected' : 'empty' : 'failed'} catalogue yields to live success and keeps offline facts`, async () => {
    let loads = 0;
    const store = createPlaceCatalogueStore({ persistence: { load: () => { loads++; return snapshot(); }, save: () => {} } });
    const request = deferred<ContentResult<PlaceRecord[]>>();
    store.getState().connect({ listExploreCatalogue: () => request.promise, getPlace: async () => offline });
    const refreshing = store.getState().refresh();
    store.getState().hydrate();
    assert.equal(store.getState().loadState.status, 'loading');
    assert.deepEqual(store.getState().places, snapshot().places);
    request.resolve(result);
    await refreshing;
    if (result.status === 'ok') {
      assert.deepEqual(store.getState().places, result.data.map(explorePlaceFromRecord));
      assert.deepEqual(store.getState().details, {});
    } else assert.deepEqual(store.getState().places, snapshot().places);
    store.getState().hydrate();
    assert.equal(loads, 1);
  });
}

for (const records of [[], [current]]) {
  test(`cache recovery cannot restore ${records.length ? 'corrected coordinates' : 'removed places'} after a successful fresh catalogue`, async () => {
    let ready = false;
    let loads = 0;
    const store = createPlaceCatalogueStore({ persistence: { load: () => { loads++; return ready ? snapshot() : undefined; }, save: () => {} } });
    store.getState().hydrate();
    store.getState().connect({ listExploreCatalogue: async () => ({ status: 'ok', data: records }), getPlace: async () => offline });
    await store.getState().refresh();
    const authoritative = store.getState();
    ready = true;
    store.getState().hydrate();
    assert.equal(loads, 1, 'a successful live catalogue permanently supersedes startup cache');
    assert.equal(store.getState(), authoritative);
    assert.deepEqual(store.getState().places, records.map(explorePlaceFromRecord));
  });
}

for (const result of [
  { status: 'ok', data: current },
  { status: 'not-found' },
  offline,
] satisfies DetailResult<PlaceRecord>[]) {
  for (const settled of [true, false]) {
    test(`cache recovery ${settled ? 'after' : 'before'} a live ${result.status} detail preserves authority and other offline rows`, async () => {
      const store = createPlaceCatalogueStore({ persistence: { load: snapshot, save: () => {} } });
      const request = deferred<DetailResult<PlaceRecord>>();
      store.getState().connect({ listExploreCatalogue: async () => offline, getPlace: () => request.promise });
      const loading = store.getState().loadPlace('destination');
      if (settled) { request.resolve(result); await loading; }
      store.getState().hydrate();
      if (!settled) { request.resolve(result); await loading; }
      assert.deepEqual(store.getState().places.find((row) => row.id === 'other'), explorePlaceFromRecord(place('other')));
      assert.deepEqual(store.getState().details.other, { status: 'ok', data: place('other') });
      assert.deepEqual(store.getState().details.destination, result.status === 'unavailable' ? { status: 'ok', data: place() } : result);
      assert.deepEqual(store.getState().places.find((row) => row.id === 'destination'),
        result.status === 'not-found' ? undefined : explorePlaceFromRecord(result.status === 'ok' ? current : place()));
    });
  }
}

for (const detailFirst of [true, false]) {
  test(`cache hydration preserves generation ordering when ${detailFirst ? 'detail' : 'list'} settles first`, async () => {
    const list = deferred<ContentResult<PlaceRecord[]>>();
    const detail = deferred<DetailResult<PlaceRecord>>();
    const store = createPlaceCatalogueStore({ persistence: { load: snapshot, save: () => {} } });
    store.getState().connect({ listExploreCatalogue: () => list.promise, getPlace: () => detail.promise });
    const refreshing = store.getState().refresh();
    const loading = store.getState().loadPlace('destination');
    store.getState().hydrate();
    if (detailFirst) { detail.resolve({ status: 'ok', data: current }); await loading; }
    list.resolve({ status: 'ok', data: [place()] });
    await refreshing;
    if (!detailFirst) { detail.resolve({ status: 'ok', data: current }); await loading; }
    assert.deepEqual(store.getState().details.destination, { status: 'ok', data: current });
    assert.deepEqual(store.getState().places, [explorePlaceFromRecord(current)]);
  });
}

test('cache hydration cannot republish a detail superseded by a newer in-flight catalogue', async () => {
  const list = deferred<ContentResult<PlaceRecord[]>>();
  const detail = deferred<DetailResult<PlaceRecord>>();
  const store = createPlaceCatalogueStore({ persistence: { load: snapshot, save: () => {} } });
  store.getState().connect({ listExploreCatalogue: () => list.promise, getPlace: () => detail.promise });
  const loading = store.getState().loadPlace('destination');
  const refreshing = store.getState().refresh();
  store.getState().hydrate();
  list.resolve({ status: 'ok', data: [current] });
  await refreshing;
  detail.resolve({ status: 'ok', data: place() });
  await loading;
  store.getState().hydrate();
  assert.deepEqual(store.getState().details, {});
  assert.deepEqual(store.getState().places, [explorePlaceFromRecord(current)]);
});
