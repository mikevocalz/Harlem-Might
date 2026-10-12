import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { afterEach, describe, it } from 'node:test';
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { HARLEM_PLACE_PREVIEWS } from '@acme/app/features/explore/place-previews.ts';
import { DEFAULT_NAVIGATION_CONFIG } from '@acme/app/features/navigation/config.ts';
import { createRouteMatcher } from '@acme/app/features/navigation/matching/routeMatcher.ts';
import { createLocationPipeline } from '@acme/app/features/navigation/location/locationPipeline.ts';
import type { Route } from '@acme/app/features/navigation/model/route.ts';
import type { NavigationSession } from '@acme/app/features/navigation/model/session.ts';
import { navigationFixStore, resetNavigationStores, useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { fixtureDestination, fixtureRoute, loadFixture } from '@acme/app/features/navigation/testing/fixtures.ts';
import { useNavigationUi } from '@acme/app/features/navigation/view/navigationUi.store.ts';
import * as routeLine from '@acme/app/features/navigation/view/routeLine.ts';
import { focusId } from './explore-url.ts';
import type { ExploreMap, MapPlace } from './ExploreMap';

type Props = Parameters<typeof ExploreMap>[0];
type Effect = () => void | (() => void);
type Element = { type: unknown; props: { ref?: { current: unknown }; children?: unknown; onPress?: () => void; [key: string]: unknown } };
type Rect = { top: number; left: number; right: number; bottom: number; width: number; height: number };
type Container = { clientWidth: number; getBoundingClientRect: () => Rect };
type Camera = { center?: [number, number]; zoom?: number; pitch?: number; bearing?: number; padding?: unknown; duration?: number };
type MapOptions = { container: Container; style: string; attributionControl: boolean; config: unknown; fitBoundsOptions?: Camera; pitch: number; bearing: number; bounds?: { points: [number, number][] } };
type Listener = (event?: unknown) => void;
type Layer = { id: string; source: string; type: string; slot: string };
type Feature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: number[] | number[][] } };
type GeoJSON = { type: string; features?: Feature[]; geometry?: Feature['geometry'] };
type Slot = { value?: unknown; deps?: readonly unknown[]; effect?: Effect; cleanup?: void | (() => void) };

// Execute the actual TSX, route helpers and Zustand stores. The tiny renderer
// below supplies stable hook slots, dependency effects, refs and button presses;
// only React rendering, browser APIs and Mapbox/WebGL are faked. This is a Node
// behavioral contract, not browser, device, visual or live Mapbox validation.
const compile = (file: string) => transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX, target: ScriptTarget.ES2022, esModuleInterop: false },
}).outputText;
const compiled = compile('./ExploreMap.tsx');
const compiledRegion = compile('./MapRegion.tsx');
const cleanups = new Set<() => void>();
afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
  cleanups.clear();
  resetNavigationStores();
  useNavigationUi.getState().resetTrip();
});

const verifiedPlace = (id: string, featured = false): MapPlace => {
  const place = HARLEM_PLACE_PREVIEWS.find((p) => p.id === id);
  assert.ok(place?.lngLat && place.osm, `${id} must have a verified catalogue coordinate`);
  return { id: place.id, name: place.name, lngLat: place.lngLat, featured };
};
const apollo = verifiedPlace('apollo-theater', true);
const sylvias = verifiedPlace('sylvias-restaurant');
const schomburg = verifiedPlace('schomburg-center', true);
const places = [apollo, sylvias, schomburg];
const routeName = 'apollo-theater--sylvias-restaurant';
const trip = () => ({
  origin: { kind: 'manual' as const, coordinate: { longitude: apollo.lngLat[0], latitude: apollo.lngLat[1] }, label: apollo.name },
  destination: fixtureDestination(routeName), mode: 'walking' as const,
});
const activeSession = (route: Route, generation = 1): NavigationSession => ({
  ...trip(), phase: 'navigating', activeRoute: { route, alternatives: [], generation, receivedAtMs: 1_760_000_000_000 },
  deviation: { kind: 'on-route' }, arrival: { kind: 'en-route', distanceM: route.distanceM }, reroute: { kind: 'idle' },
});
function publishFix(route: Route, vertex = 1) {
  const fix = {
    coordinate: route.geometry.coordinates[vertex]!, accuracy: { horizontalM: 4 },
    timestampMs: 1_760_000_000_000 + vertex * 1_000, source: 'device-gps' as const,
  };
  const lastFix = createLocationPipeline(DEFAULT_NAVIGATION_CONFIG.location, 'walking').ingest(fix, fix.timestampMs);
  assert.equal(lastFix.kind, 'accepted');
  if (lastFix.kind !== 'accepted') throw new Error('Expected accepted fixture fix');
  const match = createRouteMatcher(route, DEFAULT_NAVIGATION_CONFIG.matching).match(lastFix.filtered, undefined, 4);
  assert.equal(match.kind, 'matched');
  navigationFixStore.setState({ lastFix, match });
  return { lastFix, match };
}

function fixture(token: string | undefined = 'test-token') {
  const imports: ReturnType<typeof Promise.withResolvers<unknown>>[] = [];
  const statuses: string[] = [];
  const maps: FakeMap[] = [];
  const markers: FakeMarker[] = [];
  const observers: FakeResizeObserver[] = [];
  const subscriptions = { session: 0, fix: 0, follow: 0 };
  let reducedMotion = false;
  let currentSlots: Slot[] = [];
  let cursor = 0;
  let pendingEffects: Slot[] = [];
  let requestRender = () => {};
  const nextSlot = () => currentSlots[cursor++] ?? (currentSlots[cursor - 1] = {});
  const sameDeps = (a: readonly unknown[] | undefined, b: readonly unknown[]) => a?.length === b.length && a.every((v, i) => Object.is(v, b[i]));

  class FakeElement {
    readonly tagName: string;
    readonly attributes = new Map<string, string>();
    readonly events = new Map<string, (event: { stopPropagation: () => void }) => void>();
    readonly dataset: Record<string, string> = {};
    readonly children: FakeElement[] = [];
    type = '';
    className = '';
    textContent = '';
    hidden = false;
    constructor(tagName: string) { this.tagName = tagName; }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    append(...children: FakeElement[]) { this.children.push(...children); }
    addEventListener(event: string, listener: (event: { stopPropagation: () => void }) => void) { this.events.set(event, listener); }
    click() { let stopped = false; this.events.get('click')!({ stopPropagation() { stopped = true; } }); return stopped; }
  }
  class FakeSource {
    data: GeoJSON;
    readonly writes: GeoJSON[] = [];
    constructor(data: GeoJSON) { this.data = data; }
    setData(data: GeoJSON) { this.data = data; this.writes.push(data); }
  }
  class FakeMap {
    readonly options: MapOptions;
    readonly events = new Map<string, Set<Listener>>();
    readonly sources = new Map<string, FakeSource>();
    readonly layers = new Map<string, Layer>();
    readonly filters = new Map<string, unknown>();
    readonly camera: { method: string; target: Camera }[] = [];
    readonly fits: { bounds: { points: [number, number][] }; options: Camera }[] = [];
    readonly configs: unknown[][] = [];
    readonly controls: unknown[][] = [];
    readonly canvas = { style: { cursor: '' } };
    zoom = 15.5;
    pitch: number;
    bearing: number;
    styleLoaded = false;
    show3dObjects: boolean;
    removed = 0;
    resized = 0;
    constructor(options: MapOptions) {
      if (options.bounds) assert.ok(options.bounds.points.length > 0, 'Cannot construct with empty bounds');
      this.options = options;
      this.show3dObjects = (options.config as { basemap: { show3dObjects: boolean } }).basemap.show3dObjects;
      // Mapbox v3.32.0 map.ts 750–760 fits bounds after jumpTo; camera.ts
      // 626–632 defaults the fit's omitted pitch/bearing to zero.
      this.pitch = options.bounds ? (options.fitBoundsOptions?.pitch ?? 0) : options.pitch;
      this.bearing = options.bounds ? (options.fitBoundsOptions?.bearing ?? 0) : options.bearing;
      maps.push(this);
    }
    on(event: string, layerOrListener: string | Listener, maybeListener?: Listener) {
      const key = typeof layerOrListener === 'string' ? `${event}:${layerOrListener}` : event;
      const listener = typeof layerOrListener === 'string' ? maybeListener! : layerOrListener;
      const listeners = this.events.get(key) ?? new Set<Listener>();
      listeners.add(listener); this.events.set(key, listeners);
    }
    once(event: string, listener: Listener) {
      const once: Listener = (value) => { this.off(event, once); listener(value); };
      this.on(event, once);
    }
    off(event: string, listener: Listener) { this.events.get(event)?.delete(listener); }
    capture(event: string) { const listeners = [...(this.events.get(event) ?? [])]; return (value?: unknown) => listeners.forEach((listener) => listener(value)); }
    emit(event: string, value?: unknown) { if (event === 'load') this.styleLoaded = true; this.capture(event)(value); }
    addControl(...args: unknown[]) { this.controls.push(args); }
    addSource(id: string, source: { data: GeoJSON }) { assert.equal(this.removed, 0); assert.ok(!this.sources.has(id), `Duplicate source ${id}`); this.sources.set(id, new FakeSource(source.data)); }
    getSource(id: string) { return this.sources.get(id); }
    addLayer(layer: Layer) { assert.equal(this.removed, 0); assert.ok(!this.layers.has(layer.id), `Duplicate layer ${layer.id}`); this.layers.set(layer.id, layer); }
    getLayer(id: string) { return this.layers.get(id); }
    setFilter(id: string, filter: unknown) { assert.ok(this.layers.has(id)); this.filters.set(id, filter); }
    getCanvas() { return this.canvas; }
    getContainer() { return this.options.container; }
    getZoom() { return this.zoom; }
    setConfigProperty(...args: unknown[]) {
      this.configs.push(args);
      // Standard's fragment is absent until style load; v3.32.0 style.ts
      // 2686–2691 returns without applying config while it is absent.
      if (this.styleLoaded && args[0] === 'basemap' && args[1] === 'show3dObjects') this.show3dObjects = args[2] as boolean;
    }
    move(method: string, target: Camera) { assert.equal(this.removed, 0); this.camera.push({ method, target }); this.zoom = target.zoom ?? this.zoom; this.pitch = target.pitch ?? this.pitch; this.bearing = target.bearing ?? this.bearing; }
    jumpTo(target: Camera) { this.move('jumpTo', target); }
    easeTo(target: Camera) { this.move('easeTo', target); }
    flyTo(target: Camera) { this.move('flyTo', target); }
    fitBounds(bounds: { points: [number, number][] }, options: Camera) { assert.ok(bounds.points.length > 0, 'Cannot fit empty bounds'); this.pitch = options.pitch ?? 0; this.bearing = options.bearing ?? 0; this.fits.push({ bounds, options }); }
    resize() { assert.equal(this.removed, 0); this.resized++; }
    remove() { this.removed++; this.events.clear(); }
  }
  class FakeMarker {
    readonly element: FakeElement;
    lngLat: [number, number] | undefined;
    map: FakeMap | undefined;
    added = 0;
    removed = 0;
    constructor({ element }: { element: FakeElement }) { this.element = element; markers.push(this); }
    setLngLat(lngLat: [number, number]) { this.lngLat = lngLat; return this; }
    addTo(map: FakeMap) { this.map = map; this.added++; return this; }
    remove() { this.removed++; this.map = undefined; return this; }
  }
  class FakeResizeObserver {
    readonly callback: () => void;
    observed: unknown;
    disconnected = 0;
    constructor(callback: () => void) { this.callback = callback; observers.push(this); }
    observe(container: unknown) { this.observed = container; }
    disconnect() { this.disconnected++; }
  }
  const mapboxgl = {
    accessToken: '', Map: FakeMap, Marker: FakeMarker,
    LngLatBounds: class { readonly points: [number, number][] = []; extend(point: [number, number]) { this.points.push(point); return this; } },
    NavigationControl: class {},
  };
  function trackedSubscribe<T>(key: keyof typeof subscriptions, subscribe: (listener: (state: T, prev: T) => void) => () => void) {
    return (listener: (state: T, prev: T) => void) => {
      subscriptions[key]++;
      const unsubscribe = subscribe(listener);
      return () => { subscriptions[key]--; unsubscribe(); };
    };
  }
  const jsx = (type: unknown, props: Element['props']): Element => ({ type, props });
  const modules: Record<string, unknown> = {
    'mapbox-gl/dist/mapbox-gl.css': {},
    react: {
      useEffect: (effect: Effect, deps: readonly unknown[]) => {
        const slot = nextSlot(); slot.effect = effect;
        if (!sameDeps(slot.deps, deps)) { slot.deps = deps; pendingEffects.push(slot); }
      },
      useMemo: (compute: () => unknown, deps: readonly unknown[]) => {
        const slot = nextSlot();
        if (!sameDeps(slot.deps, deps)) { slot.value = compute(); slot.deps = deps; }
        return slot.value;
      },
      useRef: (value: unknown) => { const slot = nextSlot(); return slot.value ?? (slot.value = { current: value }); },
      useState: (value: unknown) => {
        const slot = nextSlot(); if (!('value' in slot)) slot.value = value;
        const render = requestRender;
        return [slot.value, (next: unknown) => { slot.value = next; render(); }];
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@acme/theme': { semantic: { primary: { dark: 'gold' }, 'rule-rail': { dark: 'gray' }, surface: { dark: 'black' }, text: { dark: 'white' } } },
    '@acme/ui/tw': { View: 'View' },
    '@acme/ui/mights': { MightsButton: 'MightsButton' },
    '@acme/app/features/navigation/ui/hooks.ts': { useIsGuiding: () => false },
    '@acme/app/features/navigation/session/navigationStore.ts': {
      useNavigationStore: Object.assign((select: (state: ReturnType<typeof useNavigationStore.getState>) => unknown) => select(useNavigationStore.getState()), {
        getState: useNavigationStore.getState, subscribe: trackedSubscribe('session', useNavigationStore.subscribe),
      }),
      navigationFixStore: { getState: navigationFixStore.getState, subscribe: trackedSubscribe('fix', navigationFixStore.subscribe) },
    },
    '@acme/app/features/navigation/view/navigationUi.store.ts': {
      useNavigationUi: { getState: useNavigationUi.getState, subscribe: trackedSubscribe('follow', useNavigationUi.subscribe) },
    },
    '@acme/app/features/navigation/view/routeLine.ts': routeLine,
    './explore-url': { focusId },
    './map-status': { useMapStatus: (select: (state: { setStatus: (status: string) => void }) => unknown) => select({ setStatus: (status) => statuses.push(status) }) },
  };
  const exports: { ExploreMap?: (props: Props) => Element } = {};
  new Function('require', 'exports', 'process', 'window', 'document', 'ResizeObserver', 'performance', compiled)(
    (id: string) => {
      if (id === 'mapbox-gl') { const pending = Promise.withResolvers<unknown>(); imports.push(pending); return pending.promise; }
      assert.ok(id in modules, `Unexpected component import ${id}`); return modules[id];
    }, exports, { env: { NEXT_PUBLIC_MAPBOX_TOKEN: token } },
    { matchMedia: () => ({ matches: reducedMotion }) }, { createElement: (tagName: string) => new FakeElement(tagName) },
    FakeResizeObserver, { mark() {}, measure() {} },
  );
  const walk = (node: unknown, visit: (element: Element) => void) => {
    if (Array.isArray(node)) node.forEach((child) => walk(child, visit));
    else if (node && typeof node === 'object' && 'props' in node) { const element = node as Element; visit(element); walk(element.props.children, visit); }
  };

  function mount(attachContainer = true, initialProps: Partial<Props> = {}) {
    const slots: Slot[] = [];
    const container = { clientWidth: 400, getBoundingClientRect: () => ({ top: 0, left: 0, right: 400, bottom: 600, width: 400, height: 600 }) };
    let props: Props = { places: [], visibleIds: [], selectedId: null, onSelect() {}, occluderRef: { current: null }, layoutKey: 'test', ...initialProps };
    let tree: Element;
    const render = () => {
      currentSlots = slots; cursor = 0; pendingEffects = []; requestRender = render;
      tree = exports.ExploreMap!(props);
      walk(tree, (element) => { if (element.props.ref && attachContainer) element.props.ref.current = container; });
      for (const slot of pendingEffects) { slot.cleanup?.(); slot.cleanup = slot.effect!(); }
    };
    render();
    const unmount = () => { slots.forEach((slot) => { slot.cleanup?.(); slot.cleanup = undefined; }); };
    cleanups.add(unmount);
    return {
      container, unmount,
      rerender(next: Partial<Props>) { props = { ...props, ...next }; render(); },
      press(label: string) {
        let button: Element | undefined;
        walk(tree, (element) => { if (element.type === 'MightsButton' && element.props.children === label) button = element; });
        assert.ok(button, `Missing ${label} control`); button.props.onPress!();
      },
      replayEffects() { unmount(); slots.forEach((slot) => { if (slot.effect) slot.cleanup = slot.effect(); }); },
    };
  }
  // Use MapRegion's real HUD callback for Recenter; its unrelated rendering and
  // routing hooks are leaves here. ExploreMap itself has no Locate control.
  function recenter() {
    const regionModules = {
      ...modules,
      react: { useMemo: (compute: () => unknown) => compute() },
      '@acme/app/features/explore/explore.store.ts': { useExplore: (select: (state: unknown) => unknown) => select({ sheet: { detent: 'half' }, visibleIds: null }) },
      '@acme/app/features/navigation/ui/NavigationHud.tsx': { NavigationHud: 'NavigationHud' },
      '@acme/app/features/navigation/view/runtime.ts': {},
      './ExploreMap': exports,
      './explore-actions': { DOCKED: '', sheetElementRef: { current: null }, useExploreActions: () => ({ params: new URLSearchParams(), replace() {}, select() {} }) },
      './use-media-query': { useMediaQuery: () => false },
    };
    const region: { MapRegion?: (props: { points: readonly MapPlace[] }) => Element } = {};
    new Function('require', 'exports', compiledRegion)((id: string) => {
      assert.ok(id in regionModules, `Unexpected region import ${id}`); return regionModules[id as keyof typeof regionModules];
    }, region);
    let onRecenter: (() => void) | undefined;
    walk(region.MapRegion!({ points: places }), (element) => { if (element.type === 'NavigationHud') onRecenter = element.props.onRecenter as () => void; });
    assert.ok(onRecenter); onRecenter();
  }
  return { mount, imports, statuses, maps, markers, observers, mapboxgl, subscriptions, recenter, setReducedMotion(value: boolean) { reducedMotion = value; } };
}

// A full event-loop turn also lets node:test detect any unhandled rejection.
const flush = () => setImmediate();
async function loadMap(f: ReturnType<typeof fixture>, importIndex = 0) {
  await flush(); f.imports[importIndex]!.resolve({ default: f.mapboxgl }); await flush();
  const map = f.maps.at(-1)!; map.emit('load'); map.emit('idle'); return map;
}

describe('ExploreMap import lifetime', () => {
  it('does not request Mapbox on browser module evaluation or before effects mount', async () => {
    const f = fixture();
    await flush();
    assert.equal(f.imports.length, 0);
    assert.deepEqual(f.statuses, []);
  });

  it('does not request Mapbox without a token or an attached container', async () => {
    const missingToken = fixture('');
    const tokenless = missingToken.mount();
    const missingContainer = fixture();
    const detached = missingContainer.mount(false);
    await flush();
    assert.equal(missingToken.imports.length, 0);
    assert.deepEqual(missingToken.statuses, ['unavailable']);
    assert.equal(missingContainer.imports.length, 0);
    assert.deepEqual(missingContainer.statuses, []);
    tokenless.unmount();
    detached.unmount();
  });

  it('contains a rejected import and lets a later mount retry successfully', async () => {
    const f = fixture();
    const first = f.mount();
    await flush();
    assert.equal(f.imports.length, 1);
    assert.deepEqual(f.statuses, ['loading']);
    f.imports[0]!.reject(new Error('Mapbox chunk could not be fetched'));
    await flush();
    assert.deepEqual(f.statuses, ['loading', 'unavailable']);
    assert.equal(f.maps.length, 0);
    first.unmount();

    const second = f.mount();
    await flush();
    assert.equal(f.imports.length, 2);
    f.imports[1]!.resolve({ default: f.mapboxgl });
    await flush();
    assert.equal(f.maps.length, 1);
    const map = f.maps[0]!;
    assert.equal(map.options.container, second.container);
    assert.equal(f.mapboxgl.accessToken, 'test-token');
    assert.equal(map.options.style, 'mapbox://styles/mapbox/standard');
    assert.equal(map.options.attributionControl, true);
    assert.deepEqual(map.options.config, {
      basemap: { theme: 'faded', lightPreset: 'day', show3dObjects: true, showPointOfInterestLabels: false, showTransitLabels: false },
    });
    assert.equal(f.observers[0]!.observed, second.container);
    map.emit('idle');
    assert.deepEqual(f.statuses, ['loading', 'unavailable', 'loading', 'ready']);
    second.unmount();
    assert.equal(map.removed, 1);
    assert.equal(f.observers[0]!.disconnected, 1);
  });

  it('ignores an import result delivered after unmount', async () => {
    const f = fixture();
    const mounted = f.mount();
    await flush();
    mounted.unmount();
    f.imports[0]!.resolve({ default: f.mapboxgl });
    await flush();
    assert.equal(f.maps.length, 0);
    assert.equal(f.observers.length, 0);
    assert.equal(f.mapboxgl.accessToken, '');
    assert.deepEqual(f.statuses, ['loading']);
  });

  it('contains a late rejection without overwriting a newer mounted map status', async () => {
    const f = fixture();
    const first = f.mount();
    await flush();
    first.unmount();
    const second = f.mount();
    await flush();
    f.imports[1]!.resolve({ default: f.mapboxgl });
    await flush();
    f.maps[0]!.emit('idle');
    f.imports[0]!.reject(new Error('The abandoned request failed'));
    await flush();
    assert.deepEqual(f.statuses, ['loading', 'loading', 'ready']);
    assert.equal(f.maps.length, 1);
    second.unmount();
  });

  it('creates one live map after the Strict Mode setup/cleanup/setup sequence', async () => {
    const f = fixture();
    const mounted = f.mount();
    await flush();
    mounted.replayEffects();
    await flush();
    assert.equal(f.imports.length, 2);
    f.imports[0]!.resolve({ default: f.mapboxgl });
    f.imports[1]!.resolve({ default: f.mapboxgl });
    await flush();
    assert.equal(f.maps.length, 1);
    assert.equal(f.observers.length, 1);
    mounted.unmount();
    assert.equal(f.maps[0]!.removed, 1);
  });

  it('ignores queued map and resize callbacks after cleanup', async () => {
    const f = fixture();
    const mounted = f.mount();
    await flush();
    f.imports[0]!.resolve({ default: f.mapboxgl });
    await flush();
    const map = f.maps[0]!;
    const error = map.capture('error');
    const idle = map.capture('idle');
    const load = map.capture('load');
    mounted.unmount();
    error({ error: new Error('WebGL context lost') });
    idle();
    load();
    f.observers[0]!.callback();
    assert.deepEqual(f.statuses, ['loading']);
    assert.equal(map.resized, 0);
    assert.equal(map.removed, 1);
  });
});

describe('ExploreMap loaded catalogue and controls', () => {
  it('loads verified places into canvas layers and accessible markers, and selects from real handlers', async () => {
    const f = fixture();
    const selections: string[] = [];
    f.mount(true, { places, visibleIds: [apollo.id], selectedId: sylvias.id, onSelect: (id) => selections.push(id) });
    const map = await loadMap(f);
    assert.deepEqual(map.options.bounds!.points, places.map((p) => p.lngLat));
    assert.deepEqual(map.getSource('hm-places')!.data.features, places.map((p) => ({
      type: 'Feature', properties: { id: p.id, name: p.name }, geometry: { type: 'Point', coordinates: p.lngLat },
    })));
    assert.deepEqual([...map.layers.keys()], ['hm-place-dots', 'hm-place-labels', 'hm-route-alternatives', 'hm-route-casing', 'hm-route-walked', 'hm-route-ahead']);
    assert.ok([...map.layers.values()].every((layer) => layer.slot === 'top'));
    assert.deepEqual(map.filters.get('hm-place-dots'), ['in', ['get', 'id'], ['literal', [apollo.id, sylvias.id]]]);
    assert.deepEqual(map.filters.get('hm-place-labels'), map.filters.get('hm-place-dots'));
    assert.deepEqual(f.statuses, ['loading', 'ready']);
    assert.deepEqual(f.subscriptions, { session: 1, fix: 1, follow: 1 });
    const buttons = f.markers.filter((marker) => marker.element.tagName === 'button');
    assert.equal(buttons.length, 3, 'Only featured places and the selected dot get DOM markers');
    const selected = buttons.find((marker) => marker.element.dataset.exploreFocus === focusId.marker(sylvias.id))!;
    assert.deepEqual(selected.lngLat, sylvias.lngLat);
    assert.equal(selected.element.attributes.get('role'), 'button');
    assert.equal(selected.element.attributes.get('aria-label'), sylvias.name);
    assert.equal(selected.element.attributes.get('aria-pressed'), 'true');
    assert.equal(selected.element.hidden, false, 'The selection remains visible outside the filter');
    assert.equal(buttons.find((marker) => marker.element.attributes.get('aria-label') === schomburg.name)!.element.hidden, true);
    assert.equal(selected.element.click(), true, 'Marker click stops propagation to the map');
    map.emit('click:hm-place-dots', { features: [{ properties: { id: apollo.id } }] });
    map.emit('click:hm-place-labels', { features: [{ properties: { id: schomburg.id } }] });
    for (const value of [{}, { features: [] }, { features: [{ properties: { id: 42 } }] }]) map.emit('click:hm-place-dots', value);
    assert.deepEqual(selections, [sylvias.id, apollo.id, schomburg.id]);
    map.emit('mouseenter:hm-place-dots'); assert.equal(map.canvas.style.cursor, 'pointer');
    map.emit('mouseleave:hm-place-dots'); assert.equal(map.canvas.style.cursor, '');
    map.emit('load'); // once listeners cannot attach a second set of layers/subscriptions.
    assert.deepEqual(f.subscriptions, { session: 1, fix: 1, follow: 1 });
  });

  it('reads the latest selection, visibility and callbacks across pending load and rerenders without rebuilding the map', async () => {
    const f = fixture();
    const oldSelections: string[] = [];
    const newSelections: string[] = [];
    const mounted = f.mount(true, { places, visibleIds: places.map((p) => p.id), selectedId: apollo.id, onSelect: (id) => oldSelections.push(id) });
    mounted.rerender({ selectedId: sylvias.id, visibleIds: [], onSelect: (id) => newSelections.push(id) });
    const map = await loadMap(f);
    assert.deepEqual(map.camera.at(-1)?.target.center, sylvias.lngLat);
    const apolloMarker = f.markers.find((marker) => marker.element.attributes.get('aria-label') === apollo.name)!;
    const sylviasMarker = f.markers.find((marker) => marker.element.attributes.get('aria-label') === sylvias.name)!;
    assert.equal(apolloMarker.element.hidden, true);
    assert.equal(sylviasMarker.element.hidden, false);
    sylviasMarker.element.click();
    map.emit('click:hm-place-dots', { features: [{ properties: { id: apollo.id } }] });
    assert.deepEqual(oldSelections, []);
    assert.deepEqual(newSelections, [sylvias.id, apollo.id]);
    mounted.rerender({ selectedId: apollo.id, visibleIds: [schomburg.id] });
    assert.equal(apolloMarker.element.attributes.get('aria-pressed'), 'true');
    assert.equal(sylviasMarker.element.attributes.get('aria-pressed'), 'false');
    assert.equal(apolloMarker.element.hidden, false);
    assert.equal(sylviasMarker.element.hidden, true);
    assert.deepEqual(map.camera.at(-1)?.target.center, apollo.lngLat);
    assert.equal(map.camera.at(-1)?.method, 'flyTo');
    mounted.rerender({ selectedId: null });
    assert.equal(apolloMarker.element.attributes.get('aria-pressed'), 'false');
    assert.equal(apolloMarker.element.hidden, true);
    assert.deepEqual(map.filters.get('hm-place-dots'), ['in', ['get', 'id'], ['literal', [schomburg.id]]]);
    assert.equal(f.maps.length, 1);
    assert.equal(f.imports.length, 1);
  });

  it('frames selection around changing inspector/sheet overlap and honors reduced motion', async () => {
    const f = fixture();
    let rect = { left: 300, right: 400, top: 0, bottom: 600, width: 100, height: 600 };
    const occluderRef = { current: { getBoundingClientRect: () => rect } as HTMLElement };
    const mounted = f.mount(true, { places, selectedId: sylvias.id, occluderRef });
    const map = await loadMap(f);
    assert.deepEqual(map.camera.at(-1)?.target.padding, { top: 0, right: 100, bottom: 0, left: 0 });
    rect = { left: 0, right: 400, top: 400, bottom: 600, width: 400, height: 200 };
    mounted.rerender({ layoutKey: 'sheet-half' });
    assert.equal(map.camera.at(-1)?.method, 'flyTo');
    assert.deepEqual(map.camera.at(-1)?.target.padding, { top: 0, right: 0, bottom: 200, left: 0 });
    f.setReducedMotion(true);
    rect = { left: 400, right: 600, top: 0, bottom: 600, width: 200, height: 600 };
    mounted.rerender({ layoutKey: 'docked' });
    assert.equal(map.camera.at(-1)?.method, 'jumpTo');
    assert.deepEqual(map.camera.at(-1)?.target.padding, { top: 0, right: 0, bottom: 0, left: 0 });
    assert.ok(map.resized >= 3, 'Selection resizes before each camera framing');
  });

  it('changes the existing map between 2D, Tilt and Buildings through the rendered controls', async () => {
    const f = fixture();
    const mounted = f.mount(true, { places });
    const map = await loadMap(f);
    const markerCount = f.markers.length;
    mounted.press('2D');
    assert.deepEqual(map.configs.at(-1), ['basemap', 'show3dObjects', false]);
    assert.deepEqual(map.camera.at(-1), { method: 'easeTo', target: { pitch: 0, bearing: 0, zoom: 16, duration: 450 } });
    mounted.rerender({ selectedId: sylvias.id });
    assert.equal(map.camera.at(-1)?.target.pitch, undefined, 'Selecting a place does not force 3D back on');
    mounted.press('Tilt');
    assert.deepEqual(map.configs.at(-1), ['basemap', 'show3dObjects', true]);
    assert.equal(map.camera.at(-1)?.target.pitch, 48);
    f.setReducedMotion(true);
    mounted.press('3D buildings');
    assert.equal(map.camera.at(-1)?.method, 'jumpTo');
    assert.equal(map.camera.at(-1)?.target.pitch, 64);
    assert.equal(map.camera.at(-1)?.target.bearing, -18);
    assert.equal(f.maps.length, 1);
    assert.equal(f.markers.length, markerCount + 1, 'Only the newly selected marker was added');
  });

  for (const label of ['2D', 'Tilt']) {
    it(`preserves a ${label} choice made while Mapbox is loading`, async () => {
      const f = fixture();
      const mounted = f.mount(true, { places, selectedId: sylvias.id });
      mounted.press(label);
      const map = await loadMap(f);
      assert.equal(map.pitch, label === '2D' ? 0 : 48);
      const basemap = (map.options.config as { basemap: { show3dObjects: boolean } }).basemap;
      assert.equal(basemap.show3dObjects, label !== '2D');
    });
  }


  it('replays a 2D choice made after construction but before the basemap fragment loads', async () => {
    const f = fixture();
    const mounted = f.mount(true, { places, selectedId: sylvias.id });
    await flush(); f.imports[0]!.resolve({ default: f.mapboxgl }); await flush();
    const map = f.maps[0]!;
    mounted.press('2D');
    assert.equal(map.pitch, 0);
    assert.equal(map.show3dObjects, true, 'The pending Standard fragment ignores setConfigProperty');
    map.emit('load');
    assert.equal(map.show3dObjects, false, 'Load must replay the latest view configuration');
    assert.equal(map.pitch, 0);
    mounted.press('Tilt');
    assert.equal(map.show3dObjects, true);
    assert.equal(map.pitch, 48);
  });

  it('reconciles replacement catalogue data and selection on the existing loaded map', async () => {
    const f = fixture();
    const mounted = f.mount(true, { places: [apollo, sylvias], visibleIds: [apollo.id], selectedId: sylvias.id });
    const map = await loadMap(f);
    const oldMarkers = f.markers.filter((marker) => marker.element.tagName === 'button');
    mounted.rerender({ places: [schomburg], visibleIds: [schomburg.id], selectedId: schomburg.id });
    assert.deepEqual(map.getSource('hm-places')!.data.features?.map((feature) => feature.properties.id), [schomburg.id]);
    assert.ok(oldMarkers.every((marker) => marker.removed === 1), 'Removed catalogue records lose their markers');
    assert.deepEqual(map.camera.at(-1)?.target.center, schomburg.lngLat);
    const replacement = f.markers.find((marker) => marker.element.attributes.get('aria-label') === schomburg.name)!;
    assert.equal(replacement.element.attributes.get('aria-pressed'), 'true');
    mounted.rerender({ places: [], visibleIds: [], selectedId: null });
    assert.deepEqual(map.getSource('hm-places')!.data.features, []);
    assert.equal(replacement.removed, 1);
    assert.equal(f.maps.length, 1);
    assert.deepEqual(f.subscriptions, { session: 1, fix: 1, follow: 1 });
  });


  it('updates an existing marker point without rebuilding it or reframing an unchanged catalogue', async () => {
    const f = fixture();
    const mounted = f.mount(true, { places: [apollo], visibleIds: [apollo.id], selectedId: apollo.id });
    const map = await loadMap(f);
    const marker = f.markers.find((item) => item.element.tagName === 'button')!;
    const markerCount = f.markers.length;
    const cameraCount = map.camera.length;
    mounted.rerender({ places: [{ ...apollo }] });
    assert.equal(map.camera.length, cameraCount, 'An equivalent refreshed record must not move the camera');
    // A recorded provider-routable entrance supplies a real replacement point.
    const coordinate = fixtureRoute(routeName).geometry.coordinates[0]!;
    const updated = { ...apollo, lngLat: [coordinate.longitude, coordinate.latitude] as const };
    mounted.rerender({ places: [updated] });
    assert.deepEqual(marker.lngLat, updated.lngLat);
    assert.deepEqual(map.getSource('hm-places')!.data.features![0]!.geometry.coordinates, updated.lngLat);
    assert.deepEqual(map.camera.at(-1)?.target.center, updated.lngLat);
    assert.equal(f.markers.length, markerCount);
    assert.equal(marker.removed, 0);
  });

  it('constructs from the newest catalogue when records change before the import settles', async () => {
    const f = fixture();
    const mounted = f.mount(true, { places: [apollo], visibleIds: [apollo.id] });
    mounted.rerender({ places: [schomburg], visibleIds: [schomburg.id], selectedId: schomburg.id });
    const map = await loadMap(f);
    assert.deepEqual(map.options.bounds!.points, [schomburg.lngLat]);
    assert.deepEqual(map.getSource('hm-places')!.data.features?.map((feature) => feature.properties.id), [schomburg.id]);
    assert.deepEqual(f.markers.filter((marker) => marker.element.tagName === 'button').map((marker) => marker.lngLat), [schomburg.lngLat]);
  });




  it('retains a Tilt control change when the hidden pane first fits its bounds', async () => {
    const f = fixture();
    const mounted = f.mount(true, { places, visibleIds: [sylvias.id], selectedId: sylvias.id });
    mounted.container.clientWidth = 0;
    const map = await loadMap(f);
    mounted.press('Tilt');
    assert.equal(map.pitch, 48);
    mounted.container.clientWidth = 400;
    f.observers[0]!.callback();
    assert.equal(map.pitch, 48);
    assert.equal(map.bearing, -12);
    assert.deepEqual(map.camera.at(-1)?.target.center, sylvias.lngLat);
  });

  it('omits empty constructor bounds if the catalogue clears before import, and accepts later records', async () => {
    const f = fixture();
    const mounted = f.mount(true, { places: [apollo], visibleIds: [apollo.id] });
    mounted.rerender({ places: [], visibleIds: [] });
    await flush(); f.imports[0]!.resolve({ default: f.mapboxgl }); await flush();
    assert.equal(f.maps.length, 1, 'An empty catalogue must not fail map construction');
    const map = f.maps[0]!;
    assert.equal(map.options.bounds, undefined);
    map.emit('load'); map.emit('idle');
    assert.deepEqual(map.getSource('hm-places')!.data.features, []);
    assert.deepEqual(f.statuses, ['loading', 'ready']);
    mounted.rerender({ places: [schomburg], visibleIds: [schomburg.id], selectedId: schomburg.id });
    assert.deepEqual(map.getSource('hm-places')!.data.features?.map((feature) => feature.properties.id), [schomburg.id]);
    assert.deepEqual(map.camera.at(-1)?.target.center, schomburg.lngLat);
    assert.equal(f.maps.length, 1);
  });

  it('does not fit empty bounds when a hidden catalogue is cleared before reveal', async () => {
    const f = fixture();
    const mounted = f.mount(true, { places: [apollo], visibleIds: [apollo.id] });
    mounted.container.clientWidth = 0;
    const map = await loadMap(f);
    mounted.rerender({ places: [], visibleIds: [] });
    mounted.container.clientWidth = 400;
    f.observers[0]!.callback();
    assert.equal(map.fits.length, 0);
    assert.deepEqual(map.getSource('hm-places')!.data.features, []);
    assert.ok(map.resized > 0);
  });

  it('uses replacement data for a delayed load and fits a hidden pane only on its first reveal', async () => {
    const f = fixture();
    const mounted = f.mount(true, { places: [apollo], visibleIds: [apollo.id] });
    mounted.container.clientWidth = 0;
    await flush(); f.imports[0]!.resolve({ default: f.mapboxgl }); await flush();
    const map = f.maps[0]!;
    mounted.rerender({ places: [schomburg], visibleIds: [schomburg.id], selectedId: schomburg.id });
    map.emit('load');
    assert.deepEqual(map.getSource('hm-places')!.data.features?.map((feature) => feature.properties.id), [schomburg.id]);
    assert.deepEqual(map.camera.at(-1)?.target.center, schomburg.lngLat);
    f.observers[0]!.callback();
    assert.equal(map.fits.length, 0);
    mounted.container.clientWidth = 400;
    f.observers[0]!.callback();
    assert.deepEqual(map.fits[0]!.bounds.points, [schomburg.lngLat]);
    assert.deepEqual(map.camera.at(-1)?.target.center, schomburg.lngLat);
    f.observers[0]!.callback();
    assert.equal(map.fits.length, 1);
  });
});

describe('ExploreMap navigation subscriptions', () => {
  it('draws a recorded preview, splits real matched progress, pauses follow on drag and recenters through MapRegion', async () => {
    const route = fixtureRoute(routeName);
    useNavigationStore.setState({ session: { ...trip(), phase: 'routeReady', routes: [route], selectedRouteIndex: 0 } });
    const f = fixture();
    f.mount(true, { places });
    const map = await loadMap(f);
    const recorded = loadFixture(routeName).response as { routes: { geometry: { coordinates: number[][] } }[] };
    const fullLine = recorded.routes[0]!.geometry.coordinates;
    assert.deepEqual(map.getSource('hm-route-ahead')!.data.geometry?.coordinates, fullLine);
    assert.deepEqual(map.getSource('hm-route-walked')!.data.geometry?.coordinates, []);
    assert.deepEqual(map.getSource('hm-route-alternatives')!.data.features, []);
    assert.deepEqual(map.fits[0]!.bounds.points, fullLine);
    assert.deepEqual(map.fits[0]!.options.padding, { top: 64, right: 64, bottom: 64, left: 64 });
    assert.equal(map.fits[0]!.options.duration, 600);
    const previewCameraCount = map.camera.length;
    publishFix(route, 1);
    assert.equal(map.camera.length, previewCameraCount, 'Preview puck must not start camera following');
    assert.deepEqual(map.getSource('hm-route-walked')!.data.geometry?.coordinates, [], 'Preview does not dim the route');
    useNavigationStore.setState({ session: activeSession(route) });
    const { match } = publishFix(route, 3);
    assert.equal(match.kind, 'matched');
    if (match.kind !== 'matched') throw new Error('Expected matched fixture fix');
    const matchedLngLat = [match.coordinate.longitude, match.coordinate.latitude];
    assert.deepEqual(map.getSource('hm-route-walked')!.data.geometry?.coordinates, [...fullLine.slice(0, match.segmentIndex + 1), matchedLngLat]);
    assert.deepEqual(map.getSource('hm-route-ahead')!.data.geometry?.coordinates, [matchedLngLat, ...fullLine.slice(match.segmentIndex + 1)]);
    assert.deepEqual(map.camera.at(-1), { method: 'easeTo', target: { center: matchedLngLat, zoom: 17, padding: { top: 0, right: 0, bottom: 0, left: 0 }, duration: 400 } });
    const puck = f.markers.find((marker) => marker.element.tagName === 'span')!;
    assert.equal(puck.added, 1);
    assert.deepEqual(puck.lngLat, matchedLngLat);
    map.emit('dragstart', {});
    assert.equal(useNavigationUi.getState().followUser, true, 'Programmatic camera events must not disable follow');
    map.emit('dragstart', { originalEvent: { type: 'pointerdown' } });
    assert.equal(useNavigationUi.getState().followUser, false);
    const pausedCameraCount = map.camera.length;
    publishFix(route, 4);
    assert.equal(map.camera.length, pausedCameraCount);
    f.recenter();
    assert.equal(useNavigationUi.getState().followUser, true);
    assert.equal(map.camera.length, pausedCameraCount + 1);
    assert.deepEqual(map.camera.at(-1)?.target.center, puck.lngLat);
    f.setReducedMotion(true);
    publishFix(route, 5);
    assert.equal(map.camera.at(-1)?.method, 'jumpTo');
    const cameraCount = map.camera.length;
    const routeWrites = map.getSource('hm-route-ahead')!.writes.length;
    useNavigationUi.getState().setStepsOpen(true);
    useNavigationStore.setState({ routeLoading: { kind: 'loading', purpose: 'reroute', attempt: 1 } });
    assert.equal(map.camera.length, cameraCount);
    assert.equal(map.getSource('hm-route-ahead')!.writes.length, routeWrites, 'Unrelated session slices must not redraw the route');
  });

  it('uses an accepted unmatched position, redraws replacement route generations and clears a cancelled trip', async () => {
    const route = fixtureRoute(routeName);
    const f = fixture();
    useNavigationStore.setState({ session: activeSession(route) });
    f.mount(true, { places });
    const map = await loadMap(f);
    const { lastFix } = publishFix(route, 2);
    navigationFixStore.setState({ match: { kind: 'unmatched', reason: 'too-coarse', nearestDistanceM: 0, timestampMs: lastFix.fix.timestampMs } });
    const puck = f.markers.find((marker) => marker.element.tagName === 'span')!;
    assert.deepEqual(puck.lngLat, [lastFix.filtered.coordinate.longitude, lastFix.filtered.coordinate.latitude]);
    navigationFixStore.setState({ lastFix: undefined, match: undefined });
    const replacement = fixtureRoute('apollo-theater--marcus-garvey-park');
    // Keep the route id: reroute generation, not just id, owns the redraw.
    const rerouted = { ...replacement, id: route.id };
    const next = activeSession(rerouted, 2);
    useNavigationStore.setState({ session: { ...next, destination: fixtureDestination('apollo-theater--marcus-garvey-park') } as NavigationSession });
    assert.deepEqual(map.getSource('hm-route-ahead')!.data.geometry?.coordinates, replacement.geometry.coordinates.map((c) => [c.longitude, c.latitude]));
    assert.deepEqual(map.getSource('hm-route-walked')!.data.geometry?.coordinates, []);
    assert.equal(map.fits.length, 1, 'A reroute frames the replacement route');
    publishFix(rerouted, 1);
    useNavigationStore.setState({ session: { phase: 'idle' } });
    assert.deepEqual(map.getSource('hm-route-ahead')!.data.geometry?.coordinates, []);
    assert.deepEqual(map.getSource('hm-route-walked')!.data.geometry?.coordinates, []);
    assert.deepEqual(map.getSource('hm-route-alternatives')!.data.features, []);
    assert.equal(puck.map, undefined);
    const cameraCount = map.camera.length;
    publishFix(rerouted, 2);
    assert.equal(map.camera.length, cameraCount, 'Late fixes after cancellation cannot resurrect guidance');
  });

  it('owns exactly one set of subscriptions per live mount and ignores stale load callbacks after replacement', async () => {
    const f = fixture();
    const first = f.mount(true, { places });
    await flush(); f.imports[0]!.resolve({ default: f.mapboxgl }); await flush();
    const oldMap = f.maps[0]!;
    const lateLoad = oldMap.capture('load');
    oldMap.emit('load');
    const oldPuck = f.markers.find((marker) => marker.element.tagName === 'span')!;
    first.unmount();
    assert.deepEqual(f.subscriptions, { session: 0, fix: 0, follow: 0 });
    assert.equal(oldMap.events.get('dragstart')?.size ?? 0, 0);
    assert.equal(oldPuck.removed, 1);
    const writes = oldMap.getSource('hm-route-ahead')!.writes.length;
    const route = fixtureRoute(routeName);
    useNavigationStore.setState({ session: activeSession(route) });
    publishFix(route, 2);
    useNavigationUi.getState().setFollowUser(false);
    assert.equal(oldMap.getSource('hm-route-ahead')!.writes.length, writes);
    const second = f.mount(true, { places: [schomburg], visibleIds: [schomburg.id] });
    const liveMap = await loadMap(f, 1);
    lateLoad(); f.observers[0]!.callback();
    assert.deepEqual(f.subscriptions, { session: 1, fix: 1, follow: 1 });
    assert.equal(oldMap.removed, 1);
    assert.equal(oldMap.getSource('hm-route-ahead')!.writes.length, writes);
    assert.ok(liveMap.getSource('hm-route-ahead')!.data.geometry!.coordinates.length > 0);
    f.recenter();
    assert.equal(liveMap.camera.at(-1)?.target.zoom, 17);
    second.unmount(); second.unmount();
    assert.deepEqual(f.subscriptions, { session: 0, fix: 0, follow: 0 });
    assert.equal(liveMap.removed, 1);
    assert.ok(f.markers.every((marker) => marker.map === undefined));
    assert.ok(f.observers.every((observer) => observer.disconnected === 1));
  });


  it('replays a loaded active mount without retaining its map, puck or subscriptions', async () => {
    const route = fixtureRoute(routeName);
    useNavigationStore.setState({ session: activeSession(route) });
    publishFix(route, 1);
    const f = fixture();
    const mounted = f.mount(true, { places, visibleIds: [apollo.id] });
    const firstMap = await loadMap(f);
    const firstMarkers = [...f.markers];
    mounted.replayEffects();
    assert.equal(firstMap.removed, 1);
    assert.deepEqual(f.subscriptions, { session: 0, fix: 0, follow: 0 });
    assert.ok(firstMarkers.every((marker) => marker.map === undefined));
    const secondMap = await loadMap(f, 1);
    assert.deepEqual(f.subscriptions, { session: 1, fix: 1, follow: 1 });
    publishFix(route, 2);
    assert.equal(secondMap.camera.at(-1)?.target.zoom, 17);
    mounted.unmount();
    assert.deepEqual(f.subscriptions, { session: 0, fix: 0, follow: 0 });
    assert.ok(f.observers.every((observer) => observer.disconnected === 1));
  });

  it('unmounting one active map leaves another mounted map subscribed', async () => {
    const f = fixture();
    const first = f.mount(true, { places });
    const firstMap = await loadMap(f);
    const second = f.mount(true, { places: [schomburg] });
    const secondMap = await loadMap(f, 1);
    assert.deepEqual(f.subscriptions, { session: 2, fix: 2, follow: 2 });
    first.unmount();
    assert.deepEqual(f.subscriptions, { session: 1, fix: 1, follow: 1 });
    const route = fixtureRoute(routeName);
    useNavigationStore.setState({ session: activeSession(route) });
    publishFix(route, 1);
    assert.equal(firstMap.removed, 1);
    assert.deepEqual(secondMap.camera.at(-1)?.target.center, f.markers.find((marker) => marker.element.tagName === 'span' && marker.map === secondMap)!.lngLat);
    second.unmount();
    assert.deepEqual(f.subscriptions, { session: 0, fix: 0, follow: 0 });
  });
});
