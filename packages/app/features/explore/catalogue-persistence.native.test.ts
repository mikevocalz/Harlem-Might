import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import type { PlaceRecord } from '../../content/records.ts';
import type { PlaceCataloguePersistence } from './catalogue-persistence.ts';
import { explorePlaceFromRecord } from './catalogue.ts';
import { createPlaceCatalogueStore } from './place-catalogue.store.ts';

const nativeUrl = new URL('./catalogue-persistence.native.ts', import.meta.url).href;
const harnessKey = '__harlemCataloguePersistenceTest';
type Harness = { saved?: string };
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
        return {
          getString: (key) => { if (key !== 'explore.place-catalogue.v1') throw new Error('Unexpected key'); return state.saved; },
          set: (key, value) => { if (key !== 'explore.place-catalogue.v1') throw new Error('Unexpected key'); state.saved = value; },
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
