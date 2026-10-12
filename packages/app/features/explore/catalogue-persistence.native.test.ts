import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import type { EditorialImage } from '@acme/assets';
import type { PlaceRecord } from '../../content/records.ts';
import type { PlaceCataloguePersistence } from './catalogue-persistence.ts';
import { explorePlaceFromRecord } from './catalogue.ts';
import { createPlaceCatalogueStore } from './place-catalogue.store.ts';
import { filterPlaces } from './place-model.ts';

const nativeUrl = new URL('./catalogue-persistence.native.ts', import.meta.url).href;
const harnessKey = '__harlemCataloguePersistenceTest';
type Harness = {
  saved?: string;
  createCalls?: number;
  failCreate?: boolean;
  failRead?: boolean;
  failWrite?: boolean;
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(nativeUrl) && specifier === 'react-native-mmkv') {
      return { url: 'catalogue-persistence-test:mmkv', shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'catalogue-persistence-test:mmkv') return {
      format: 'module', shortCircuit: true,
      source: `export function createMMKV({ id }) {
        if (id !== 'explore-catalogue') throw new Error('Unexpected store');
        const state = globalThis.${harnessKey};
        state.createCalls = (state.createCalls ?? 0) + 1;
        if (state.failCreate) throw new Error('Native storage unavailable');
        return {
          getString: (key) => {
            if (key !== 'explore.place-catalogue.v1') throw new Error('Unexpected key');
            if (state.failRead) throw new Error('Native storage read failed');
            return state.saved;
          },
          set: (key, value) => {
            if (key !== 'explore.place-catalogue.v1') throw new Error('Unexpected key');
            if (state.failWrite) throw new Error('Native storage write failed');
            state.saved = value;
          },
        };
      }`,
    };
    return next(url, context);
  },
});
async function loadNative(name: string, harness: Harness) {
  Object.assign(globalThis, { [harnessKey]: harness });
  const module = await import(`${nativeUrl}?${name}`) as { platformCataloguePersistence: PlaceCataloguePersistence };
  return module.platformCataloguePersistence;
}
const place = (slug: string): PlaceRecord => ({
  id: 101, slug, name: slug, kind: 'business', lifecycle: 'open',
  location: [-73.94, 40.81], locationAccuracy: 'approx', featured: false, images: [],
});

const image: EditorialImage = {
  id: 'photo', role: 'gallery', url: 'https://example.invalid/photo.jpg', altText: 'A place',
  source: 'venue_supplied', sourceUrl: 'https://example.invalid/source', license: 'Licensed',
  licenseUrl: 'https://example.invalid/license', creator: 'Photographer', credit: 'Venue',
  attributionText: 'Supplied by the venue', capturedAt: '2025', ingestedAt: '2026-01-01',
  width: 1200, height: 800, aspect: 1.5, placeholderHash: 'hash', dominantColor: '#abcdef',
  shareAlike: false, noDerivatives: true, caption: 'Entrance',
};
const completePlace = (): PlaceRecord => ({
  ...place('complete'), category: 'Food', area: 'Harlem', summary: 'A neighbourhood place',
  locationSourceUrl: 'https://www.openstreetmap.org/node/101', locationSourceReadAt: '2026-01-01T00:00:00Z',
  address: '123 Main Street, New York', website: 'https://example.invalid', phone: '212-555-0101',
  openingHours: { osm: 'Mo-Fr 09:00-17:00', note: 'Weekdays', sourceUrl: 'https://example.invalid/hours', verifiedAt: '2026-01-01' },
  menus: [{ label: 'Lunch', url: 'https://example.invalid/menu', sourceUrl: 'https://example.invalid', mealPeriod: 'lunch' }],
  images: [image],
});

test('a null persisted row cannot crash native catalogue startup', async () => {
  const persistence = await loadNative('null-row', { saved: JSON.stringify({ places: [null], details: {} }) });
  assert.doesNotThrow(() => createPlaceCatalogueStore({ persistence }));
  assert.equal(persistence.load(), undefined);
  assert.deepEqual(createPlaceCatalogueStore({ persistence }).getState().places, []);
});

test('a null successful detail cannot crash native catalogue startup', async () => {
  const persistence = await loadNative('null-detail', { saved: JSON.stringify({ places: [], details: { broken: { status: 'ok', data: null } } }) });
  assert.doesNotThrow(() => createPlaceCatalogueStore({ persistence }));
  assert.equal(persistence.load(), undefined);
  assert.deepEqual(createPlaceCatalogueStore({ persistence }).getState().details, {});
});

test('malformed persisted envelopes, rows, details and nested fields are rejected as one snapshot', async (t) => {
  const record = completePlace();
  const row = explorePlaceFromRecord(record);
  const snapshot = { schemaVersion: 2, places: [row], details: { complete: { status: 'ok', data: record } } };
  const cases: [string, unknown][] = [
    ...[null, true, 12, 'text', [], {}, { places: {} }, { places: [], details: null }, { places: [], details: [] }]
      .map((value, i): [string, unknown] => [`envelope ${i}`, value]),
    ...[0, 3, '2', null].map((version): [string, unknown] => [`version ${JSON.stringify(version)}`, { ...snapshot, schemaVersion: version }]),
    ...[null, true, 12, 'text', [], {}].flatMap((value, i): [string, unknown][] => [
      [`row ${i}`, { ...snapshot, places: [row, value] }],
      [`detail ${i}`, { ...snapshot, details: { complete: { status: 'ok', data: record }, broken: value } }],
      [`detail data ${i}`, { ...snapshot, details: { complete: { status: 'ok', data: value } } }],
    ]),
    ['unknown detail status', { ...snapshot, details: { complete: { status: 'maybe', data: record } } }],
    ['wrong detail identity', { ...snapshot, details: { other: { status: 'ok', data: record } } }],
  ];
  const badRowFields: Record<string, unknown> = {
    id: 1, name: {}, category: null, area: [], street: {}, shortDescription: [], tags: ['valid', null],
    lngLat: [-73, '40'], osm: 3, sourceReadAt: {}, website: false, phone: [], hoursText: {},
    menus: [{ label: 'Menu', url: null }], featured: 'yes',
  };
  for (const [key, value] of Object.entries(badRowFields)) {
    cases.push([`row field ${key}`, { ...snapshot, places: [{ ...row, [key]: value }] }]);
  }
  for (const key of ['id', 'name', 'category', 'area', 'tags']) {
    cases.push([`missing row ${key}`, { ...snapshot, places: [{ ...row, [key]: undefined }] }]);
  }
  const badRecordFields: Record<string, unknown> = {
    id: '101', slug: 12, name: {}, kind: 'invented', lifecycle: 'invented', category: [], area: {}, summary: false,
    location: [-73], locationAccuracy: 'invented', locationSourceUrl: {}, locationSourceReadAt: [],
    address: 1, website: false, phone: {}, openingHours: [], menus: [null], featured: 1, images: [null],
  };
  const detailCase = (label: string, data: unknown) => {
    cases.push([label, { ...snapshot, details: { complete: { status: 'ok', data } } }]);
  };
  for (const [key, value] of Object.entries(badRecordFields)) detailCase(`record field ${key}`, { ...record, [key]: value });
  for (const key of ['id', 'slug', 'name', 'kind', 'lifecycle', 'locationAccuracy', 'featured', 'images']) {
    detailCase(`missing record ${key}`, { ...record, [key]: undefined });
  }
  for (const value of [null, {}, 'point', [], [-73], [-73, 40, 0], ['-73', 40], [181, 40], [-73, 91]]) {
    cases.push([`row coordinate ${JSON.stringify(value)}`, { ...snapshot, places: [{ ...row, lngLat: value }] }]);
    detailCase(`record coordinate ${JSON.stringify(value)}`, { ...record, location: value });
  }
  for (const key of ['osm', 'note', 'sourceUrl', 'verifiedAt']) {
    detailCase(`hours ${key}`, { ...record, openingHours: { ...record.openingHours, [key]: {} } });
  }
  for (const value of [null, true, 12, 'text', {}]) {
    cases.push([`row tags ${JSON.stringify(value)}`, { ...snapshot, places: [{ ...row, tags: value }] }]);
    detailCase(`images ${JSON.stringify(value)}`, { ...record, images: value });
  }
  for (const value of [null, true, 12, 'text', []]) detailCase(`hours ${JSON.stringify(value)}`, { ...record, openingHours: value });
  for (const value of [null, true, 'menu', {}, [null], [{ url: 'https://example.invalid' }], [{ label: 'Menu', url: {} }]]) {
    cases.push([`row menus ${JSON.stringify(value)}`, { ...snapshot, places: [{ ...row, menus: value }] }]);
    detailCase(`record menus ${JSON.stringify(value)}`, { ...record, menus: value });
  }
  for (const key of ['label', 'url', 'sourceUrl', 'mealPeriod']) {
    detailCase(`menu field ${key}`, { ...record, menus: [{ ...record.menus?.[0], [key]: false }] });
  }
  for (const [key, value] of Object.entries(image)) {
    detailCase(`image field ${key}`, { ...record, images: [{ ...image, [key]: typeof value === 'boolean' ? 'false' : {} }] });
  }
  for (const key of ['id', 'role', 'url', 'altText', 'source', 'sourceUrl', 'license', 'licenseUrl', 'credit', 'attributionText', 'shareAlike', 'noDerivatives']) {
    detailCase(`missing image ${key}`, { ...record, images: [{ ...image, [key]: undefined }] });
  }
  detailCase('unknown image role', { ...record, images: [{ ...image, role: 'unknown' }] });
  detailCase('unknown image source', { ...record, images: [{ ...image, source: 'unknown' }] });
  for (const key of ['url', 'altText', 'sourceUrl', 'license', 'licenseUrl', 'credit', 'attributionText']) {
    detailCase(`image rights gate ${key}`, { ...record, images: [{ ...image, [key]: '' }] });
  }
  for (const [i, [label, value]] of cases.entries()) {
    await t.test(label, async () => {
      const persistence = await loadNative(`malformed-${i}`, { saved: JSON.stringify(value) });
      assert.equal(persistence.load(), undefined);
      const store = createPlaceCatalogueStore({ persistence });
      assert.deepEqual(store.getState().places, []);
      assert.deepEqual(store.getState().details, {});
    });
  }
});

test('malformed JSON and non-finite JSON numbers are rejected without preventing recovery', async () => {
  const harness: Harness = { saved: '{' };
  const persistence = await loadNative('malformed-json', harness);
  for (const saved of ['{', '', 'undefined', '{"places":[],"details":{"broken":{"status":"ok","data":null}}}',
    JSON.stringify({ places: [{ ...explorePlaceFromRecord(place('finite')), lngLat: ['overflow', 40] }] }).replace('"overflow"', '1e999')]) {
    harness.saved = saved;
    assert.equal(persistence.load(), undefined);
    assert.doesNotThrow(() => createPlaceCatalogueStore({ persistence }));
  }
  persistence.save({ schemaVersion: 2, places: [explorePlaceFromRecord(place('recovered'))], details: {} });
  assert.equal(createPlaceCatalogueStore({ persistence }).getState().places[0]?.id, 'recovered');
});

test('complete durable facts round-trip, preserve offline last-good detail, and recover after storage failures', async () => {
  const harness: Harness = {};
  const persistence = await loadNative('complete-round-trip', harness);
  const record = completePlace();
  const snapshot = {
    schemaVersion: 2 as const, places: [explorePlaceFromRecord(record)],
    details: { complete: { status: 'ok' as const, data: record } },
  };
  persistence.save(snapshot);
  assert.deepEqual(persistence.load(), JSON.parse(JSON.stringify(snapshot)));
  const store = createPlaceCatalogueStore({ persistence });
  assert.equal(filterPlaces(store.getState().places, 'neighbourhood', 'All').length, 1);
  store.getState().connect({
    listExploreCatalogue: async () => ({ status: 'unavailable', reason: 'query-failed', error: new Error('Offline') }),
    getPlace: async () => ({ status: 'unavailable', reason: 'query-failed', error: new Error('Offline') }),
  });
  await store.getState().refresh();
  await store.getState().loadPlace('complete');
  assert.deepEqual(store.getState().details, snapshot.details);
  assert.deepEqual(createPlaceCatalogueStore({ persistence }).getState().details, snapshot.details);
  harness.failWrite = true;
  persistence.save({ schemaVersion: 2, places: [], details: {} });
  assert.deepEqual(persistence.load()?.details, snapshot.details, 'a failed save leaves last-good durable facts intact');
  harness.failWrite = false;
  persistence.save({ schemaVersion: 2, places: [], details: {} });
  assert.deepEqual(persistence.load(), { schemaVersion: 2, places: [], details: {} });
});

test('successful native writes persist only confirmed details', async () => {
  const harness: Harness = {};
  const persistence = await loadNative('save-confirmed-only', harness);
  const record = place('confirmed');
  persistence.save({ schemaVersion: 2, places: [explorePlaceFromRecord(record)], details: {
    confirmed: { status: 'ok', data: record }, missing: { status: 'not-found' },
    offline: { status: 'unavailable', reason: 'not-configured' },
  } });
  assert.ok(harness.saved);
  assert.deepEqual(JSON.parse(harness.saved).details, { confirmed: { status: 'ok', data: record } });
  assert.deepEqual(createPlaceCatalogueStore({ persistence }).getState().details, { confirmed: { status: 'ok', data: record } });
});

test('unversioned, explicit v1 and v2 snapshots retain their coordinate authority across a second restart', async (t) => {
  for (const schemaVersion of [undefined, 1, 2]) {
    await t.test(`version ${schemaVersion ?? 'absent'}`, async () => {
      const pending = { ...place('pending'), locationAccuracy: 'pending' as const };
      const known = place('known');
      const listOnly = place('list-only');
      const harness = { saved: JSON.stringify({
        schemaVersion, places: [pending, known, listOnly].map(explorePlaceFromRecord),
        details: { pending: { status: 'ok', data: pending }, known: { status: 'ok', data: known },
          missing: { status: 'not-found' }, transient: { status: 'unavailable', reason: 'query-failed' } },
      }) };
      const persistence = await loadNative(`coordinate-version-${schemaVersion}`, harness);
      assert.equal(persistence.load()?.schemaVersion, schemaVersion === 2 ? 2 : undefined);
      const store = createPlaceCatalogueStore({ persistence });
      const expectedPoints = [undefined, known.location, schemaVersion === 2 ? listOnly.location : undefined];
      assert.deepEqual(store.getState().places.map((row) => row.lngLat), expectedPoints);
      const detail = store.getState().details.pending;
      assert.equal(detail?.status === 'ok' ? detail.data.location : 'missing detail', undefined);
      assert.equal(store.getState().details.missing, undefined);
      assert.equal(store.getState().details.transient, undefined);
      persistence.save({ schemaVersion: 2, places: store.getState().places, details: store.getState().details });
      assert.deepEqual(createPlaceCatalogueStore({ persistence }).getState().places.map((row) => row.lngLat), expectedPoints);
    });
  }
});

test('valid optional omissions and all supported record and image variants remain usable offline', async () => {
  const harness: Harness = {};
  const persistence = await loadNative('supported-variants', harness);
  const kinds: PlaceRecord['kind'][] = ['business', 'culture', 'historic', 'outdoors', 'public-art', 'community'];
  const lifecycles: PlaceRecord['lifecycle'][] = ['open', 'temporarily_closed', 'seasonal', 'permanently_closed', 'historical_only', 'unknown'];
  const accuracies: PlaceRecord['locationAccuracy'][] = ['verified', 'approx', 'pending'];
  const roles: EditorialImage['role'][] = ['hero', 'gallery', 'historical', 'thumbnail', 'map_pin'];
  const sources: EditorialImage['source'][] = ['commissioned', 'nypl', 'loc', 'wikimedia_commons', 'google_places', 'unsplash', 'pexels', 'venue_supplied', 'other'];
  for (const [i, source] of sources.entries()) {
    const record: PlaceRecord = {
      ...place(`variant-${i}`), kind: kinds[i % kinds.length]!, lifecycle: lifecycles[i % lifecycles.length]!,
      locationAccuracy: accuracies[i % accuracies.length]!, location: undefined, openingHours: {}, menus: [{ label: 'Unlinked menu' }],
      images: [{ ...image, id: i, source, role: roles[i % roles.length]!, creator: undefined, caption: undefined,
        capturedAt: undefined, ingestedAt: undefined, width: undefined, height: undefined, aspect: undefined,
        placeholderHash: undefined, dominantColor: undefined }],
    };
    const snapshot = { schemaVersion: 2 as const, places: [explorePlaceFromRecord(record)], details: { [record.slug]: { status: 'ok' as const, data: record } } };
    persistence.save(snapshot);
    assert.deepEqual(persistence.load(), JSON.parse(JSON.stringify(snapshot)));
    assert.equal(createPlaceCatalogueStore({ persistence }).getState().places[0]?.id, record.slug);
  }
  harness.saved = JSON.stringify({ places: [{ id: '', name: '', category: '', area: '', tags: [] }] });
  assert.deepEqual(persistence.load(), { places: [{ id: '', name: '', category: '', area: '', tags: [] }], details: {} });
});

test('the production store survives failed native construction and persists after recovery', async () => {
  const harness: Harness = { failCreate: true };
  const persistence = await loadNative('store-construction-recovery', harness);
  const store = createPlaceCatalogueStore({ persistence });
  const current = completePlace();
  store.getState().connect({
    listExploreCatalogue: async () => ({ status: 'ok', data: [current] }),
    getPlace: async () => ({ status: 'ok', data: current }),
  });
  await store.getState().refresh();
  assert.equal(store.getState().places[0]?.id, current.slug);
  assert.equal(harness.saved, undefined);
  harness.failCreate = false;
  await store.getState().loadPlace(current.slug);
  const relaunched = createPlaceCatalogueStore({ persistence });
  assert.deepEqual(relaunched.getState().details[current.slug], { status: 'ok', data: current });
  assert.deepEqual(relaunched.getState().places[0]?.lngLat, current.location);
  assert.equal(harness.createCalls, 3);
});

test('native storage construction is lazy, guarded and retried after an unavailable launch', async () => {
  const harness: Harness = { failCreate: true };
  const persistence = await loadNative('creation-failure', harness);
  assert.equal(harness.createCalls, undefined, 'import must not create a native store');
  assert.equal(persistence.load(), undefined);
  assert.equal(harness.createCalls, 1);
  assert.doesNotThrow(() => persistence.save({ schemaVersion: 2, places: [], details: {} }));
  assert.equal(harness.createCalls, 2);
  assert.equal(harness.saved, undefined);

  harness.failCreate = false;
  persistence.save({ schemaVersion: 2, places: [], details: {} });
  assert.deepEqual(persistence.load(), { schemaVersion: 2, places: [], details: {} });
  assert.equal(harness.createCalls, 3, 'reuse the first successful native store');
});

test('native storage read and write errors leave the working in-memory catalogue usable', async () => {
  const harness: Harness = { failRead: true, failWrite: true };
  const persistence = await loadNative('io-failure', harness);
  const store = createPlaceCatalogueStore({ persistence });
  const current = place('fresh');
  store.getState().connect({
    listExploreCatalogue: async () => ({ status: 'ok', data: [current] }),
    getPlace: async () => ({ status: 'not-found' }),
  });
  await store.getState().refresh();
  assert.equal(store.getState().places[0]?.id, 'fresh');
  assert.equal(harness.saved, undefined);
  harness.failRead = false;
  harness.failWrite = false;
  await store.getState().refresh();
  assert.ok(harness.saved);
  assert.equal(persistence.load()?.places[0]?.id, 'fresh');
  assert.equal(harness.createCalls, 1);
});

test('the native v1 adapter preserves legacy facts while hydration withholds pending and unprovable points', async () => {
  const pending: PlaceRecord = { ...place('pending'), locationAccuracy: 'pending' };
  const known = place('known');
  const unproven = place('list-only');
  const harness = { saved: JSON.stringify({
    places: [pending, known, unproven].map(explorePlaceFromRecord),
    details: { pending: { status: 'ok', data: pending }, known: { status: 'ok', data: known }, missing: { status: 'not-found' } },
  }) };
  const persistence = await loadNative('legacy', harness);
  const loaded = persistence.load();
  assert.equal(loaded?.schemaVersion, undefined, 'legacy data must not be promoted to the new coordinate contract');
  assert.equal(loaded?.details.missing, undefined);
  const store = createPlaceCatalogueStore({ persistence });
  assert.equal(store.getState().places[0]?.lngLat, undefined);
  assert.deepEqual(store.getState().places[1]?.lngLat, known.location);
  assert.equal(store.getState().places[2]?.lngLat, undefined);
  assert.equal(store.getState().places[2]?.name, 'list-only');
});

test('native successful writes round-trip the current coordinate contract for offline list-only places', async () => {
  const harness: Harness = {};
  const persistence = await loadNative('current', harness);
  const store = createPlaceCatalogueStore({ persistence });
  const current = place('current');
  store.getState().connect({
    listExploreCatalogue: async () => ({ status: 'ok', data: [current] }),
    getPlace: async () => ({ status: 'not-found' }),
  });
  await store.getState().refresh();
  assert.ok(harness.saved);
  assert.equal(JSON.parse(harness.saved).schemaVersion, 2);
  assert.equal(persistence.load()?.schemaVersion, 2);
  const relaunched = createPlaceCatalogueStore({ persistence });
  assert.deepEqual(relaunched.getState().places[0]?.lngLat, current.location);
  assert.deepEqual(relaunched.getState().details, {});
});
