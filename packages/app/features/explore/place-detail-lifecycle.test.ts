import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import type { PlaceRecord } from '../../content/records.ts';
import type { DetailResult } from '../../content/result.ts';
import * as journey from '../journey/model.ts';
import * as safeUrls from '../site/content/safe-url.ts';
import * as catalogueProjection from './catalogue.ts';
import * as exploreCopy from './explore-copy.ts';
import * as placeModel from './place-model.ts';
import { createPlaceCatalogueStore, catalogueNearbyPlaces, type PlaceCatalogueState } from './place-catalogue.store.ts';
import { createHydratedCatalogueStore } from './test-helpers/hydrated-catalogue.ts';

const compiled = ts.transpileModule(readFileSync(new URL('./ExplorePlaceDetail.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
type Tree = { type: unknown; props: { children?: unknown; [name: string]: unknown } };
function nodes(value: unknown): Tree[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (typeof value !== 'object' || value === null || !('props' in value)) return [];
  const node = value as Tree;
  return [node, ...nodes(node.props.children)];
}
function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (typeof value !== 'object' || value === null || !('props' in value)) return '';
  return text((value as Tree).props.children);
}

/** Actual panel and real store, with deterministic React effect scheduling and inert view leaves. */
function mountPanel(store: ReturnType<typeof createHydratedCatalogueStore>) {
  let effectIndex = 0;
  const previous: (readonly unknown[])[] = [];
  let effects: (() => void)[] = [];
  let dirty = true;
  let tree: unknown;
  const jsx = (type: unknown, props: Tree['props']) => ({ type, props });
  const modules: Record<string, unknown> = {
    react: {
      useMemo: (compute: () => unknown) => compute(),
      useEffect: (effect: () => void, dependencies: readonly unknown[]) => {
        const index = effectIndex++;
        const last = previous[index];
        if (!last || dependencies.some((value, i) => !Object.is(value, last[i]))) effects.push(effect);
        previous[index] = dependencies;
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@acme/ui/mights': { MightsButton: 'button', MightsHeading: 'heading', MightsLocationStamp: 'stamp', MightsText: 'text' },
    '@acme/ui/tw': { Pressable: 'pressable', ScrollView: 'scroll', Text: 'text', View: 'view' },
    '@acme/app/features/site/place/PlaceHero.tsx': { PlaceMasthead: 'masthead' },
    '../journey/model.ts': journey,
    './explore-copy': exploreCopy,
    './place-model': placeModel,
    './place-catalogue.store.ts': {
      catalogueNearbyPlaces,
      usePlaceCatalogue: (select: (state: PlaceCatalogueState) => unknown) => select(store.getState()),
    },
    './catalogue.ts': catalogueProjection,
    '../site/place/PlaceHours': { PlaceHours: 'hours' },
    '../site/content/safe-url.ts': safeUrls,
    './explore-type': { useExploreType: () => ({ buttons: {} }) },
    './focus-registry': { DETAIL_HEADING_FOCUS_ID: 'heading', focusTargetRef: () => undefined, moveFocusTo: () => {} },
  };
  const exports: { ExplorePlaceDetail?: (props: Record<string, unknown>) => unknown } = {};
  new Function('require', 'exports', compiled)((id: string) => {
    assert.ok(id in modules, `Unexpected panel import ${id}`);
    return modules[id];
  }, exports);
  const render = () => {
    dirty = false;
    effectIndex = 0;
    effects = [];
    tree = exports.ExplorePlaceDetail!({ placeId: 'destination', onClose: () => {}, onSelectNearby: () => {}, onDirections: () => {} });
    const pending = effects;
    effects = [];
    pending.forEach((effect) => effect());
  };
  const unsubscribe = store.subscribe(() => { dirty = true; });
  return {
    // Bounded microtask flushing also detects unending automatic retry loops.
    flush: async () => {
      for (let i = 0; i < 24; i++) {
        if (dirty) render();
        await Promise.resolve();
      }
      assert.equal(dirty, false, 'the panel must settle without a render/retry loop');
    },
    rerender: () => { dirty = true; },
    text: () => text(tree),
    button: (label: string) => nodes(tree).find((node) => node.type === 'button' && text(node) === label),
    dispose: unsubscribe,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const place = (slug = 'destination'): PlaceRecord => ({
  id: 101, slug, name: slug, kind: 'business', lifecycle: 'open', location: [-73.94, 40.81],
  locationAccuracy: 'verified', locationSourceUrl: 'https://example.com/place',
  locationSourceReadAt: new Date(Date.now() - 1000).toISOString(), featured: false, images: [],
  menus: [{ label: 'Cached menu', url: 'https://example.com/old-menu' }],
});

test('an already-mounted cached panel revalidates after foreground invalidation and waits for explicit failure retry', async (t) => {
  const cached = place();
  const other = place('unopened');
  const store = createHydratedCatalogueStore({ persistence: {
    load: () => ({ schemaVersion: 2, places: [cached, other].map(catalogueProjection.explorePlaceFromRecord), details: {
      destination: { status: 'ok', data: cached }, unopened: { status: 'ok', data: other },
    } }),
    save: () => {},
  } });
  const current: PlaceRecord = { ...cached, name: 'Current destination', location: undefined, locationAccuracy: 'pending', menus: undefined };
  const full: PlaceRecord = { ...current, summary: 'Current full detail', menus: [{ label: 'Current menu', url: 'https://example.com/menu' }] };
  let fail = true;
  const reads: string[] = [];
  store.getState().connect({
    listExploreCatalogue: async () => ({ status: 'ok', data: [current, other] }),
    getPlace: async (slug) => {
      reads.push(slug);
      if (fail) throw new Error('offline');
      return { status: 'ok', data: full };
    },
  });
  const panel = mountPanel(store);
  t.after(panel.dispose);
  await panel.flush();
  assert.deepEqual(reads, ['destination']);
  assert.match(panel.text(), /Cached menu/);
  await store.getState().refresh();
  await panel.flush();
  assert.deepEqual(reads, ['destination', 'destination'], 'only the mounted detail revalidates');
  assert.equal(panel.button('Take Me There'), undefined);
  assert.equal(panel.button('Get directions'), undefined);
  assert.doesNotMatch(panel.text(), /Cached menu/);
  assert.ok(panel.button('Try again'));
  panel.rerender();
  await panel.flush();
  assert.equal(reads.length, 2, 'unavailable must not trigger repeated automatic reads');
  fail = false;
  (panel.button('Try again')!.props.onPress as () => void)();
  await panel.flush();
  assert.equal(reads.length, 3);
  assert.match(panel.text(), /Current full detail/);
  assert.ok(panel.button('Current menu'));
  assert.equal(panel.button('Try again'), undefined);
});

test('a mounted panel replaces a superseded pending detail and never re-enables its stale directions CTA', async (t) => {
  const store = createHydratedCatalogueStore();
  const old = deferred<DetailResult<PlaceRecord>>();
  const replacement = deferred<DetailResult<PlaceRecord>>();
  let reads = 0;
  const current: PlaceRecord = { ...place(), name: 'Current destination', location: undefined, locationAccuracy: 'pending' };
  store.getState().connect({
    listExploreCatalogue: async () => ({ status: 'ok', data: [current] }),
    getPlace: () => ++reads === 1 ? old.promise : replacement.promise,
  });
  const panel = mountPanel(store);
  t.after(panel.dispose);
  await panel.flush();
  assert.equal(reads, 1, 'mount effects coalesce into one request');
  await store.getState().refresh();
  await panel.flush();
  assert.equal(reads, 2, 'fresh list restarts only the superseded active detail');
  const latest = store.getState().loadPlace('destination');
  old.resolve({ status: 'ok', data: place() });
  await panel.flush();
  assert.equal(store.getState().loadPlace('destination'), latest);
  assert.equal(reads, 2);
  assert.equal(panel.button('Take Me There'), undefined);
  assert.equal(panel.button('Get directions'), undefined);
  replacement.resolve({ status: 'ok', data: { ...current, summary: 'Revalidated detail' } });
  await latest;
  await panel.flush();
  assert.match(panel.text(), /Revalidated detail/);
  assert.equal(panel.button('Take Me There'), undefined);
  assert.equal(reads, 2);
});

test('a mounted offline panel recovers delayed storage without remounting or restoring pending directions', async (t) => {
  const cached: PlaceRecord = { ...place(), locationAccuracy: 'pending' };
  const current: PlaceRecord = { ...cached, location: undefined };
  let storageReady = false;
  let online = false;
  let reads = 0;
  const store = createPlaceCatalogueStore({ persistence: {
    load: () => storageReady ? {
      places: [{ ...catalogueProjection.explorePlaceFromRecord(cached), lngLat: cached.location }],
      details: { destination: { status: 'ok', data: cached } },
    } : undefined,
    save: () => {},
  } });
  store.getState().connect({
    listExploreCatalogue: async () => online ? { status: 'ok', data: [current] } : { status: 'unavailable', reason: 'not-configured' },
    getPlace: async () => {
      reads++;
      return online ? { status: 'ok', data: { ...current, summary: 'Current full detail' } } : { status: 'unavailable', reason: 'not-configured' };
    },
  });
  store.getState().hydrate();
  const panel = mountPanel(store);
  t.after(panel.dispose);
  await panel.flush();
  assert.equal(reads, 1);
  assert.ok(panel.button('Try again'));
  storageReady = true;
  store.getState().hydrate();
  await store.getState().refresh();
  await panel.flush();
  assert.match(panel.text(), /Cached menu/);
  assert.equal(reads, 1, 'recovered cache does not trigger an automatic detail retry loop');
  assert.equal(panel.button('Take Me There'), undefined);
  assert.equal(panel.button('Get directions'), undefined);
  assert.equal(store.getState().places[0]?.lngLat, undefined);
  online = true;
  await store.getState().refresh();
  await panel.flush();
  assert.equal(reads, 2, 'fresh catalogue invalidation still revalidates the mounted panel');
  assert.match(panel.text(), /Current full detail/);
  assert.equal(panel.button('Take Me There'), undefined);
  assert.equal(panel.button('Get directions'), undefined);
});
