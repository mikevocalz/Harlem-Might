import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';

const failure = process.argv[2];
const root = new URL('../../../../../', import.meta.url);
const nativeUrl = new URL('../catalogue-persistence.native.ts', import.meta.url).href;
const storeUrl = new URL('../place-catalogue.store.ts', import.meta.url).href;
const harness = { createCalls: 0, reads: 0, writes: 0, fail: failure, raw: undefined };
globalThis.catalogueStartupHarness = harness;
registerHooks({
  resolve(specifier, context, next) {
    // Metro's native file selection, with the real production singleton,
    // adapter, decoder, projection and Zustand implementation kept intact.
    if (context.parentURL === storeUrl && specifier === './catalogue-persistence.ts') {
      return { url: nativeUrl, shortCircuit: true };
    }
    if (context.parentURL === nativeUrl && specifier === 'react-native-mmkv') {
      return { url: 'catalogue-startup:mmkv', shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'catalogue-startup:mmkv') return {
      format: 'module', shortCircuit: true,
      source: `export function createMMKV({ id }) {
        const state = globalThis.catalogueStartupHarness;
        if (id !== 'explore-catalogue') throw new Error('Unexpected store');
        state.createCalls++;
        if (state.fail === 'create') throw new Error('Native module is not ready');
        return {
          getString(key) {
            if (key !== 'explore.place-catalogue.v1') throw new Error('Unexpected key');
            state.reads++;
            if (state.fail === 'read') throw new Error('Native read failed');
            return state.fail === 'corrupt' ? '{' : state.raw;
          },
          set(key, value) {
            if (key !== 'explore.place-catalogue.v1') throw new Error('Unexpected key');
            state.writes++;
            state.raw = value;
          },
        };
      }`,
    };
    return next(url, context);
  },
});
const { placeCatalogueStore: store, getCataloguePlace } = await import(storeUrl);
assert.equal(harness.createCalls, 0, 'importing the production singleton must not acquire native storage');
assert.equal(harness.reads, 0);
assert.equal(harness.writes, 0);
const { explorePlaceFromRecord } = await import('../catalogue.ts');
const record = {
  id: 101, slug: 'destination', name: 'Cached destination', kind: 'business', lifecycle: 'open',
  location: [-73.94, 40.81], locationAccuracy: 'pending', featured: false, images: [],
};
harness.raw = JSON.stringify({
  places: [{ ...explorePlaceFromRecord(record), lngLat: record.location }],
  details: { destination: { status: 'ok', data: record } },
});
let listReads = 0;
store.getState().connect({
  listExploreCatalogue: async () => { listReads++; return { status: 'unavailable', reason: 'not-configured' }; },
  getPlace: async () => ({ status: 'unavailable', reason: 'not-configured' }),
});
assert.equal(harness.createCalls, 0, 'binding readers during import must also be side-effect free');

// Execute the real root layout effect. Its presentation, widget transport and
// React/AppState scheduling are inert, while catalogue lifecycle calls are real.
const effects = [];
const listeners = new Set();
const modules = {
  '../src/journey/host': { useWalkJourneyHost() {} },
  '../src/site/content-readers': {},
  '@acme/app/features/explore/place-catalogue.store.ts': { placeCatalogueStore: store },
  react: { useEffect: effect => effects.push(effect) },
  'react/jsx-runtime': { jsx: () => null, jsxs: () => null },
  'react-native': { AppState: { currentState: 'active', addEventListener: (_event, listener) => {
    listeners.add(listener); return { remove: () => listeners.delete(listener) };
  } } },
  '@acme/ui/haptics': { haptics: { setForeground() {} } },
  '../widgets/public-feed': { refreshPublicSnapshot: async () => undefined },
  '../widgets/sync': { publishHomeWidgets: async () => {} },
  'expo-router': { DarkTheme: { colors: {} }, Slot: null, ThemeProvider: null },
  'expo-status-bar': { StatusBar: null },
  'react-native-keyboard-controller': { KeyboardProvider: null },
  'react-native-gesture-handler': { GestureHandlerRootView: null },
  uniwind: { Uniwind: { setTheme() {} }, withUniwind: () => null },
  '@acme/app': { AppQueryProvider: null, SafeAreaProvider: null },
  '@acme/ui': { Toaster: null },
  '@acme/theme': { palette: { mights: {} }, semantic: { surface: {}, paper: {}, text: {}, 'rule-hairline': {}, danger: {} } },
  '../src/spatial/metaWindows': { metaWindows: { SceneProvider: null } },
  '../src/spatial/SpatialWindowHost': { SpatialWindowHost: null },
  '../src/spatial/MainRouteRelay': { MainRouteRelay: null },
  '../src/map/registerNativeMap': { registerExploreNativeMap() {} },
  '../global.css': {},
};
const compiled = ts.transpileModule(readFileSync(new URL('apps/mobile/app/_layout.tsx', root), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const exports = {};
new Function('require', 'exports', compiled)(id => {
  assert.ok(id in modules, `Unexpected layout import ${id}`);
  return modules[id];
}, exports);
assert.equal(harness.createCalls, 0, 'loading the host must wait for its lifecycle effect');
exports.default();
const cleanups = effects.map(effect => effect());
await store.getState().refresh();
assert.equal(listReads, 1, 'startup refresh coalesces with concurrent callers');
assert.equal(harness.createCalls, 1);
if (failure === 'none') assert.equal(getCataloguePlace('destination')?.name, record.name);
else {
  assert.deepEqual(store.getState().places, []);
  await store.getState().loadPlace('destination');
  assert.equal(store.getState().details.destination?.status, 'unavailable');
}
const before = harness.reads;
for (const listener of listeners) listener('background');
assert.equal(harness.reads, before, 'background transitions do not acquire or hydrate storage');
harness.fail = 'none';
for (const listener of listeners) listener('active');
await store.getState().refresh();
assert.equal(listReads, 2);
assert.equal(getCataloguePlace('destination')?.name, record.name, 'foreground must recover offline cache in the same singleton');
assert.equal(getCataloguePlace('destination')?.lngLat, undefined, 'legacy pending coordinates stay withheld');
assert.equal(store.getState().details.destination.data.location, undefined);
assert.equal(store.getState().loadState.status, 'unavailable', 'hydration does not disguise failed live refresh');
assert.equal(harness.writes, 0, 'hydration and failed reads never rewrite durable data');
assert.equal(harness.createCalls, failure === 'create' ? 2 : 1, 'only failed acquisition is retried');
const restored = store.getState().places;
const hydratedReads = harness.reads;
store.getState().hydrate();
for (const listener of listeners) listener('active');
await store.getState().refresh();
assert.equal(harness.reads, hydratedReads, 'successful hydration is idempotent');
assert.equal(store.getState().places, restored);
cleanups.forEach(cleanup => cleanup?.());
assert.equal(listeners.size, 0);
const remountCleanups = effects.map(effect => effect());
await store.getState().refresh();
assert.equal(harness.reads, hydratedReads, 'root effect replay must not rehydrate or acquire another MMKV');
assert.equal(store.getState().places, restored);
remountCleanups.forEach(cleanup => cleanup?.());
assert.equal(listeners.size, 0);
console.log(`Native catalogue startup and ${failure} recovery passed`);
