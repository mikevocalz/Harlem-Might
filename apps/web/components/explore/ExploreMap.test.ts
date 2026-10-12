import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { describe, it } from 'node:test';
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript';

type Effect = () => void | (() => void);
type Element = { props: { ref?: { current: unknown }; children?: Element | Element[] } };
type MapOptions = { container: unknown; style: string; attributionControl: boolean; config: unknown };

// Execute the actual component's mount effects and cleanups, replacing only
// external renderer/Mapbox boundaries. No browser, WebGL or Mapbox network calls.
// CommonJS transpilation keeps import() asynchronous and lets the require mock
// control its result, including a failed chunk followed by a successful retry.
const compiled = transpileModule(readFileSync(new URL('./ExploreMap.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX, target: ScriptTarget.ES2022, esModuleInterop: false },
}).outputText;

function fixture(token: string | undefined = 'test-token') {
  const imports: ReturnType<typeof Promise.withResolvers<unknown>>[] = [];
  const statuses: string[] = [];
  const maps: FakeMap[] = [];
  const observers: FakeResizeObserver[] = [];
  let activeEffects: Effect[] = [];

  class FakeMap {
    readonly options: MapOptions;
    readonly events = new Map<string, (event?: unknown) => void>();
    removed = 0;
    resized = 0;
    constructor(options: MapOptions) { this.options = options; maps.push(this); }
    on(event: string, listener: (event?: unknown) => void) { this.events.set(event, listener); }
    once(event: string, listener: (event?: unknown) => void) { this.events.set(event, listener); }
    addControl() {}
    getLayer() { return undefined; }
    resize() { this.resized++; }
    remove() { this.removed++; }
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
    accessToken: '',
    Map: FakeMap,
    LngLatBounds: class { extend() { return this; } },
    NavigationControl: class {},
  };
  const jsx = (_type: unknown, props: Element['props']): Element => ({ props });
  const modules: Record<string, unknown> = {
    'mapbox-gl/dist/mapbox-gl.css': {},
    react: {
      useEffect: (effect: Effect) => activeEffects.push(effect),
      useMemo: (compute: () => unknown) => compute(),
      useRef: (value: unknown) => ({ current: value }),
      useState: (value: unknown) => [value, () => {}],
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@acme/theme': { semantic: { primary: { dark: 'gold' }, 'rule-rail': { dark: 'gray' }, surface: { dark: 'black' } } },
    '@acme/ui/tw': { View: 'View' },
    '@acme/ui/mights': { MightsButton: 'MightsButton' },
    '@acme/app/features/navigation/ui/hooks.ts': { useIsGuiding: () => false },
    '@acme/app/features/navigation/session/navigationStore.ts': {},
    '@acme/app/features/navigation/view/navigationUi.store.ts': {},
    '@acme/app/features/navigation/view/routeLine.ts': {},
    './explore-url': {},
    './map-status': {
      useMapStatus: (select: (state: { setStatus: (status: string) => void }) => unknown) =>
        select({ setStatus: (status) => statuses.push(status) }),
    },
  };
  const exports: { ExploreMap?: (props: unknown) => Element } = {};
  new Function('require', 'exports', 'process', 'window', 'ResizeObserver', 'performance', compiled)(
    (id: string) => {
      if (id === 'mapbox-gl') {
        const pending = Promise.withResolvers<unknown>();
        imports.push(pending);
        return pending.promise;
      }
      assert.ok(id in modules, `Unexpected component import ${id}`);
      return modules[id];
    },
    exports,
    { env: { NEXT_PUBLIC_MAPBOX_TOKEN: token } },
    {}, // The module is evaluated in a browser, even before a map is mounted.
    FakeResizeObserver,
    { mark() {}, measure() {} },
  );

  function mount(attachContainer = true) {
    const effects: Effect[] = [];
    activeEffects = effects;
    const container = { clientWidth: 400 };
    const tree = exports.ExploreMap!({
      places: [], visibleIds: [], selectedId: null, onSelect() {},
      occluderRef: { current: null }, layoutKey: 'test',
    });
    const attach = (element: Element) => {
      if (element.props.ref && attachContainer) element.props.ref.current = container;
      for (const child of [element.props.children].flat()) {
        if (child && typeof child === 'object') attach(child);
      }
    };
    attach(tree); // React attaches refs before running mount effects.
    let cleanups = effects.map((effect) => effect());
    const unmount = () => { cleanups.forEach((cleanup) => cleanup?.()); cleanups = []; };
    return {
      container,
      unmount,
      replayEffects() { unmount(); cleanups = effects.map((effect) => effect()); },
    };
  }
  return { mount, imports, statuses, maps, observers, mapboxgl };
}

// A full event-loop turn also lets node:test detect any unhandled rejection.
const flush = () => setImmediate();

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
    map.events.get('idle')!();
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
    f.maps[0]!.events.get('idle')!();
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
    mounted.unmount();
    map.events.get('error')!({ error: new Error('WebGL context lost') });
    map.events.get('idle')!();
    map.events.get('load')!();
    f.observers[0]!.callback();
    assert.deepEqual(f.statuses, ['loading']);
    assert.equal(map.resized, 0);
    assert.equal(map.removed, 1);
  });
});
