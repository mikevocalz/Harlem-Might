import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { useNativeMap } from '../native-map.store.ts';
import { registerNativeMap } from '../native-map-module.ts';
import { useExplore } from '../explore.store.ts';
import { placeCatalogueStore } from '../place-catalogue.store.ts';
import { navigationFixStore, useNavigationStore } from '../../navigation/session/navigationStore.ts';
import { ROUTE_LAYERS, SELECTED_SOURCE } from '../explore-map-layers.ts';

const [scenario, boundary, outcome, stage] = process.argv.slice(2);
const permissionRequests = [];
const FINE = 'android.permission.ACCESS_FINE_LOCATION';
const COARSE = 'android.permission.ACCESS_COARSE_LOCATION';

// Run the production component/effects and stores. Only React's scheduling,
// presentation primitives and the unavailable native SDK are replaced.
const slots = [];
let cursor = 0;
const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
function memo(factory, deps) {
  const index = cursor++;
  if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { value: factory(), deps };
  return slots[index].value;
}
function effect(kind, setup, deps) {
  const index = cursor++;
  const previous = slots[index];
  if (!previous || !same(previous.deps, deps)) slots[index] = { kind, setup, deps, cleanup: previous?.cleanup, pending: true };
}
function commit() {
  for (const kind of ['layout', 'passive']) {
    for (const slot of slots) {
      if (slot.kind !== kind || !slot.pending) continue;
      slot.pending = false;
      slot.cleanup?.();
      slot.cleanup = slot.setup();
    }
  }
}
function unmount() {
  for (const kind of ['layout', 'passive']) {
    for (const slot of slots) {
      if (slot.kind !== kind) continue;
      slot.cleanup?.();
      slot.cleanup = undefined;
    }
  }
}
function replayLayout() {
  const slot = slots.find(slot => slot.kind === 'layout');
  slot.cleanup();
  slot.cleanup = slot.setup();
}
const selectStore = store => Object.assign(selector => selector(store.getState()), store);
globalThis.nativeMapHarness = {
  Platform: { OS: scenario.startsWith('permission') && boundary !== 'ios' ? 'android' : 'ios' },
  PermissionsAndroid: {
    PERMISSIONS: { ACCESS_FINE_LOCATION: FINE, ACCESS_COARSE_LOCATION: COARSE },
    RESULTS: { GRANTED: 'granted' },
    requestMultiple(permissions) {
      assert.deepEqual(permissions, [FINE, COARSE], 'request precise and approximate together');
      const request = deferred();
      permissionRequests.push(request);
      if (outcome === 'throw' && permissionRequests.length === 1) throw new Error('permission bridge failed');
      return request.promise;
    },
  },
  useMemo: memo,
  useCallback: (fn, deps) => memo(() => fn, deps),
  useRef: initial => memo(() => ({ current: initial }), []),
  useEffect: (setup, deps) => effect('passive', setup, deps),
  useLayoutEffect: (setup, deps) => effect('layout', setup, deps),
  useNativeMap: selectStore(useNativeMap),
  useExplore: selectStore(useExplore),
  usePlaceCatalogue: selectStore(placeCatalogueStore),
};
const stubs = {
  react: 'export const { useMemo, useCallback, useRef, useEffect, useLayoutEffect } = globalThis.nativeMapHarness;',
  'react-native': 'export const { Platform, PermissionsAndroid } = globalThis.nativeMapHarness;',
  '@acme/ui': 'export const useReducedMotion = () => false;',
  '@acme/ui/tw': "export const View = 'View'; export const Text = 'Text';",
  '@acme/ui/mights': "export const MightsButton = 'MightsButton';",
  './explore-type': 'export const useExploreType = () => ({ caption: "caption", buttons: { control: "sm" } });',
  './explore.store': 'export const { useExplore } = globalThis.nativeMapHarness;',
  './place-catalogue.store.ts': 'export const { usePlaceCatalogue } = globalThis.nativeMapHarness;',
  './native-map.store.ts': 'export const { useNativeMap } = globalThis.nativeMapHarness;',
  './ExploreSchematicMap': 'export const ExploreSchematicMap = () => null;',
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/ExploreMap.native.tsx')) {
      if (specifier in stubs) return { url: `native-map-test:${specifier}`, shortCircuit: true };
      if (specifier === '../navigation/session/navigationStore' || specifier === '../navigation/view/routeLine') return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('native-map-test:')) return { format: 'module', source: stubs[url.slice('native-map-test:'.length)], shortCircuit: true };
    if (url.endsWith('/ExploreMap.native.tsx')) return {
      format: 'module',
      source: transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX } }).outputText,
      shortCircuit: true,
    };
    return next(url, context);
  },
});
const { ExploreMap } = await import('../ExploreMap.native.tsx');
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function makeStyle(pendingStage) {
  const pending = deferred();
  const calls = [];
  const writes = [];
  function operation(stage, id) {
    calls.push({ stage, id });
    return stage === pendingStage && (stage !== 'layer' || id === ROUTE_LAYERS.at(-1).id) ? pending.promise : Promise.resolve();
  }
  return {
    pending, calls, writes,
    setStandardConfig: () => operation('config'),
    addGeoJsonSource: ({ id }) => operation('source', id),
    addLayer: ({ id }) => operation('layer', id),
    setGeoJsonSourceData: (id, data) => { writes.push({ id, data }); return Promise.resolve(); },
  };
}
function makeMap() {
  const listeners = { style: [], error: [], tap: [] };
  const queries = [];
  const cameras = [];
  const fits = [];
  const flights = [];
  function subscribe(kind, callback) {
    const listener = { callback, removed: 0 };
    listeners[kind].push(listener);
    return { remove() { listener.removed++; } };
  }
  return {
    listeners, queries, cameras, fits, flights,
    emit(kind, value, queued = false) {
      for (const listener of listeners[kind]) if (queued || !listener.removed) listener.callback(value);
    },
    addOnStyleLoadedListener: callback => subscribe('style', callback),
    addOnMapLoadingErrorListener: callback => subscribe('error', callback),
    addOnMapTapListener: callback => subscribe('tap', callback),
    fitBounds: (...args) => { fits.push(args); return Promise.resolve(); },
    flyTo: (...args) => { flights.push(args); return Promise.resolve(); },
    getCameraState() { const pending = deferred(); cameras.push(pending); return pending.promise; },
    queryRenderedFeatures() { const pending = deferred(); queries.push(pending); return pending.promise; },
  };
}
const place = { id: 'apollo', name: 'Apollo', category: 'Music', area: 'Harlem', tags: [], lngLat: [-73.95, 40.81] };
const otherPlace = { ...place, id: 'sylvia', name: 'Sylvia', lngLat: [-73.945, 40.82] };
placeCatalogueStore.setState({ places: [place, otherPlace] });
const selections = [];
const props = { insets: { top: 0, right: 0, bottom: 0, left: 0 }, onSelectPlace: value => selections.push(value) };
let native = { MapView: () => null, callback: f => ({ f }), supportsLocationPuck: scenario.startsWith('permission') && boundary !== 'unsupported' };
registerNativeMap(native);
let receiveMap;
function render(initialMap) {
  cursor = 0;
  const outer = ExploreMap(props);
  assert.equal(outer.type.name, 'NativeExploreMap', 'the active view remains native');
  const tree = outer.type(outer.props);
  const view = tree.props.children[0];
  assert.equal(view.type, native.MapView);
  receiveMap = view.props.hybridRef.f;
  tree.props.onLayout({ nativeEvent: { layout: { width: 400, height: 800 } } });
  if (initialMap) receiveMap(initialMap);
  commit();
  const location = tree.props.children[1];
  const locationTree = location ? location.type(location.props) : null;
  return { view: view.props, button: locationTree?.props.children[0], message: locationTree?.props.children[1] };
}
let sessionSubscribers = 0;
let fixSubscribers = 0;
for (const [store, count] of [[useNavigationStore, delta => { sessionSubscribers += delta; }], [navigationFixStore, delta => { fixSubscribers += delta; }]]) {
  const subscribe = store.subscribe;
  store.subscribe = callback => { count(1); const stop = subscribe(callback); return () => { count(-1); stop(); }; };
}
const tap = { point: { x: 100, y: 100 }, coordinate: { latitude: 40.81, longitude: -73.95 } };
const features = [{ toGeoJson: () => JSON.stringify({ type: 'Feature', properties: { id: place.id } }) }];
const oldMap = makeMap();
let rendered = render(oldMap);
assert.equal(sessionSubscribers, 1);
assert.equal(fixSubscribers, 1);
const oldStyle = makeStyle(scenario === 'style' || scenario === 'current-error' ? stage : undefined);
if (scenario !== 'query') {
  oldMap.emit('style', oldStyle);
  await flush();
}
let currentMap = oldMap;
let currentStyle = oldStyle;
function crossBoundary() {
  if (boundary === 'replace') { currentMap = makeMap(); receiveMap(currentMap); }
  else if (boundary === 'null-ref') {
    receiveMap(null);
    assert.equal(useNativeMap.getState().status, 'off');
    assert.equal(sessionSubscribers, 0);
    receiveMap(oldMap);
  } else if (boundary === 'native-replace') {
    native = { ...native, MapView: () => null };
    registerNativeMap(native);
    currentMap = makeMap();
    render(currentMap);
  } else if (boundary === 'effect-replay') replayLayout();
  else if (boundary === 'unmount') unmount();
  else if (boundary === 'remount') {
    unmount();
    slots.length = 0;
    currentMap = makeMap();
    render(currentMap);
  }
  else if (boundary === 'detached') receiveMap(null);
  else if (boundary === 'failed') useNativeMap.getState().setStatus('failed', 'map failed');
  else if (boundary === 'selection') useExplore.setState({ selectedPlaceId: otherPlace.id });
  else assert.equal(boundary, 'style-reload');
}
function finishPermission(request, result) {
  if (result === 'reject') request.reject(new Error('permission bridge failed'));
  else request.resolve({ [FINE]: result === 'fine' ? 'granted' : 'denied', [COARSE]: result === 'coarse' ? 'granted' : 'denied' });
}
function assertLocation(shown, denied = false) {
  assert.equal(useNativeMap.getState().showUserLocation, shown, 'location visibility');
  assert.equal(useNativeMap.getState().locationDenied, denied, 'permission denial state');
  rendered = render();
  assert.equal(rendered.view.showUserLocation, shown, 'native puck prop');
  assert.equal(rendered.view.puckBearing, shown ? 'heading' : 'none');
  assert.equal(rendered.button.props.pressed, shown, 'button pressed state');
  assert.equal(rendered.button.props['aria-label'], shown ? 'Hide my location' : 'Show my location on the map');
  assert.equal(Boolean(rendered.message), denied, 'only explicit denial displays Settings guidance');
}
try {
  if (scenario === 'permission-stale') {
    const oldPress = rendered.button.props.onPress;
    oldPress();
    assert.equal(permissionRequests.length, 1);
    assertLocation(false);
    crossBoundary();
    const state = useNativeMap.getState();
    finishPermission(permissionRequests[0], outcome);
    await flush();
    assert.equal(useNativeMap.getState(), state, 'stale permission completion cannot publish any shared state');
    if (boundary === 'unmount' || boundary === 'detached' || boundary === 'failed') {
      oldPress();
      assert.equal(permissionRequests.length, 1, 'a queued button cannot request permission for an inactive map');
    } else {
      if (boundary === 'remount') {
        oldPress();
        assert.equal(permissionRequests.length, 1, 'a callback from the unmounted component stays inert');
      }
      rendered = render();
      rendered.button.props.onPress();
      assert.equal(permissionRequests.length, 2, 'the replacement can request permission');
      finishPermission(permissionRequests[1], 'coarse');
      await flush();
      assertLocation(true);
    }
  } else if (scenario === 'permission-overlap') {
    rendered.button.props.onPress();
    crossBoundary();
    rendered = render();
    rendered.button.props.onPress();
    assert.equal(permissionRequests.length, 2, 'each attachment owns its own request');
    if (stage === 'old-first') {
      const state = useNativeMap.getState();
      finishPermission(permissionRequests[0], outcome);
      await flush();
      assert.equal(useNativeMap.getState(), state);
      rendered.button.props.onPress();
      assert.equal(permissionRequests.length, 2, 'stale finally cannot unlock a newer request');
      finishPermission(permissionRequests[1], 'coarse');
      await flush();
    } else {
      finishPermission(permissionRequests[1], 'coarse');
      await flush();
      const state = useNativeMap.getState();
      finishPermission(permissionRequests[0], outcome);
      await flush();
      assert.equal(useNativeMap.getState(), state, 'old denial or rejection cannot hide the new puck');
    }
    assertLocation(true);
  } else if (scenario === 'permission-current') {
    rendered.button.props.onPress();
    assert.equal(permissionRequests.length, 1);
    if (outcome !== 'throw') finishPermission(permissionRequests[0], outcome);
    await flush();
    assertLocation(outcome === 'fine' || outcome === 'coarse', outcome === 'denied');
    if (!useNativeMap.getState().showUserLocation) {
      rendered.button.props.onPress();
      assert.equal(permissionRequests.length, 2, 'failure or denial allows an explicit retry');
      finishPermission(permissionRequests[1], 'fine');
      await flush();
      assertLocation(true);
    }
    rendered.button.props.onPress();
    assertLocation(false);
    assert.equal(permissionRequests.length, outcome === 'fine' || outcome === 'coarse' ? 1 : 2, 'hiding never asks permission');
  } else if (scenario === 'permission-repeat') {
    const press = rendered.button.props.onPress;
    press();
    press();
    rendered = render();
    rendered.button.props.onPress();
    assert.equal(permissionRequests.length, 1, 'rapid/re-rendered taps share the pending permission request');
    finishPermission(permissionRequests[0], 'coarse');
    await flush();
    // No React render between grant and press: the handler must read live state.
    rendered.button.props.onPress();
    assert.equal(useNativeMap.getState().showUserLocation, false, 'a pre-grant handler can still hide the current puck');
    assert.equal(permissionRequests.length, 1);
    press();
    assert.equal(permissionRequests.length, 2, 'the next explicit turn-on asks again');
    finishPermission(permissionRequests[1], 'fine');
    await flush();
    assertLocation(true);
    // A callback rendered while shown must also respect a newer off state.
    const shownPress = rendered.button.props.onPress;
    shownPress();
    shownPress();
    assert.equal(permissionRequests.length, 3);
    finishPermission(permissionRequests[2], 'coarse');
    await flush();
    assertLocation(true);
  } else if (scenario === 'permission-hide') {
    const press = rendered.button.props.onPress;
    press();
    // A newer store update can make the puck visible before React re-renders.
    useNativeMap.getState().setShowUserLocation(true);
    press();
    assert.equal(useNativeMap.getState().showUserLocation, false);
    finishPermission(permissionRequests[0], outcome);
    await flush();
    assertLocation(false);
    rendered.button.props.onPress();
    assert.equal(permissionRequests.length, 2, 'hide cancels only the old turn-on intent');
    finishPermission(permissionRequests[1], 'coarse');
    await flush();
    assertLocation(true);
  } else if (scenario === 'permission-platform') {
    if (boundary === 'unsupported') {
      assert.equal(rendered.button, undefined, 'unsupported/Quest builds retain no location action');
      assert.equal(rendered.view.showUserLocation, false);
    } else {
      assert.equal(boundary, 'ios');
      const press = rendered.button.props.onPress;
      press();
      assertLocation(true);
      press();
      assertLocation(false);
    }
    assert.equal(permissionRequests.length, 0, 'only Android owns an app permission prompt');
  } else if (scenario === 'style') {
    assert.ok(oldStyle.calls.some(call => call.stage === stage), 'the native promise is in flight');
    const before = oldStyle.calls.length;
    crossBoundary();
    if (boundary !== 'unmount') {
      currentStyle = makeStyle();
      currentMap.emit('style', currentStyle);
      await flush();
      assert.equal(useNativeMap.getState().status, 'ready');
    }
    const status = useNativeMap.getState();
    const fits = oldMap.fits.length;
    oldStyle.pending[outcome](outcome === 'reject' ? new Error('old style failed') : undefined);
    await flush();
    assert.equal(useNativeMap.getState(), status, 'stale completion must not publish status');
    assert.equal(oldStyle.calls.length, before, 'stale setup must not start further native operations');
    assert.equal(oldMap.fits.length, fits, 'stale setup must not frame the old view');
    assert.equal(oldStyle.writes.length, 0, 'stale setup must not draw routes');
    if (boundary !== 'unmount') {
      useExplore.setState({ selectedPlaceId: place.id });
      render();
      assert.ok(currentStyle.writes.some(write => write.id === SELECTED_SOURCE), 'selection uses the replacement style');
      assert.equal(oldStyle.writes.length, 0, 'stale completion must not replace the shared style ref');
    }
  } else if (scenario === 'query') {
    oldMap.emit('tap', tap);
    const query = oldMap.queries[0];
    assert.ok(query);
    crossBoundary();
    const state = useNativeMap.getState();
    query.resolve(features);
    await flush();
    assert.deepEqual(selections, [], 'queries from a detached view must not select a place');
    // Native callbacks already queued before remove() must also be inert.
    for (const listener of oldMap.listeners.style.filter(listener => listener.removed)) listener.callback(oldStyle);
    for (const listener of oldMap.listeners.error.filter(listener => listener.removed)) listener.callback(new Error('old map failed'));
    for (const listener of oldMap.listeners.tap.filter(listener => listener.removed)) listener.callback(tap);
    await flush();
    assert.equal(useNativeMap.getState(), state);
    assert.equal(oldStyle.calls.length, 0);
    assert.equal(oldMap.queries.length, 1);
    assert.deepEqual(selections, []);
    if (boundary !== 'unmount') {
      currentMap.emit('tap', tap);
      currentMap.queries.at(-1).resolve(features);
      await flush();
      assert.deepEqual(selections, [place], 'the current view still selects catalogue places');
    }
  } else if (scenario === 'camera') {
    assert.equal(useNativeMap.getState().status, 'ready');
    useExplore.setState({ selectedPlaceId: place.id });
    render();
    const camera = oldMap.cameras[0];
    assert.ok(camera);
    crossBoundary();
    if (boundary === 'selection') render();
    camera.resolve({ zoom: 14 });
    await flush();
    assert.equal(oldMap.flights.length, 0, 'a stale camera read must not move the map');
    if (boundary !== 'unmount') {
      if (boundary !== 'selection') {
        currentMap.emit('style', makeStyle());
        await flush();
        useExplore.setState({ selectedPlaceId: otherPlace.id });
        render();
      }
      currentMap.cameras.at(-1).resolve({ zoom: 17 });
      await flush();
      assert.equal(currentMap.flights.length, 1);
      assert.deepEqual(currentMap.flights[0][0].center, { latitude: otherPlace.lngLat[1], longitude: otherPlace.lngLat[0] });
    }
  } else if (scenario === 'current-error') {
    oldStyle.pending.reject(new Error('current style failed'));
    await flush();
    assert.equal(useNativeMap.getState().status, 'failed');
    assert.equal(useNativeMap.getState().error, 'current style failed');
    assert.equal(ExploreMap(props).type.name, 'ExploreSchematicMap');
  } else throw new Error(`Unknown scenario: ${scenario}`);
} finally {
  unmount();
  assert.equal(sessionSubscribers, 0, 'final unmount releases route subscriptions');
  assert.equal(fixSubscribers, 0, 'final unmount releases fix subscriptions');
  for (const map of new Set([oldMap, currentMap])) {
    for (const listeners of Object.values(map.listeners)) {
      for (const listener of listeners) assert.equal(listener.removed, 1, 'every native listener is removed exactly once');
    }
  }
  assert.equal(useNativeMap.getState().status, scenario === 'current-error' || boundary === 'failed' ? 'failed' : 'off');
  delete globalThis.nativeMapHarness;
}
