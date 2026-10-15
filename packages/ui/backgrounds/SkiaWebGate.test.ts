import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';
import { createStore } from 'zustand/vanilla';

const require = createRequire(import.meta.url);
const skiaEntries = [
  'lib/module/web/LoadSkiaWeb.js',
  'lib/commonjs/web/LoadSkiaWeb.js',
  'src/web/LoadSkiaWeb.tsx',
];

type Element = { type: unknown; props: Record<string, unknown> };
type Effect = { deps: unknown[]; cleanup?: () => void };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
const Background = () => null;
const OtherBackground = () => null;
const loaded = { default: Background };

// Match the repository's tabletopRuntime harness: execute the real component,
// effect lifetimes and instance-store helper with inert rendering hooks. Skia's
// actual pinned loader runs too; only the CanvasKit/WASM boundary is controlled.
// This verifies bootstrap ownership, not a browser/GPU renderer.
function fixture(entry = skiaEntries[0]!) {
  let active: ReturnType<typeof mount>;
  const bootstrap: ReturnType<typeof deferred<object>>[] = [];
  const locations: string[] = [];
  const global = {};
  const jsx = (type: unknown, props: Record<string, unknown>): Element => ({ type, props });
  const modules: Record<string, unknown> = {
    react: {
      useEffect: (callback: () => (() => void) | undefined, deps: unknown[]) => active.effect(callback, deps),
      useMemo: (factory: () => unknown, deps: unknown[]) => active.memo(factory, deps),
      // Retained so the regression can also execute the pre-fix component.
      useState: (initial: unknown) => active.state(initial),
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    zustand: { useStore: (store: { getState: () => unknown }, selector: (value: unknown) => unknown) => selector(store.getState()) },
    'zustand/vanilla': {
      createStore: (init: () => object) => {
        const owner = active;
        const store = createStore(init);
        const setState = store.setState;
        store.setState = ((...args: Parameters<typeof setState>) => {
          owner.writes++;
          setState(...args);
        }) as typeof setState;
        return store;
      },
    },
    'canvaskit-wasm/bin/full/canvaskit': (options: { locateFile: (file: string) => string }) => {
      locations.push(options.locateFile('canvaskit.wasm'));
      const attempt = deferred<object>();
      bootstrap.push(attempt);
      return attempt.promise;
    },
  };
  function execute(path: URL | string) {
    const compiled = transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
    }).outputText;
    const exports: Record<string, any> = {};
    new Function('require', 'exports', 'global', compiled)((id: string) => {
      assert.ok(id in modules, `Unexpected bootstrap dependency: ${id}`);
      return modules[id];
    }, exports, global);
    return exports;
  }
  modules['../use-instance-store'] = execute(new URL('../use-instance-store.ts', import.meta.url));
  modules['@shopify/react-native-skia/lib/module/web'] = execute(require.resolve(`@shopify/react-native-skia/${entry}`));
  const { SkiaWebGate } = execute(new URL('./SkiaWebGate.tsx', import.meta.url));
  function mount() {
    let effects: Effect[] = [];
    const memos: { deps: unknown[]; value: unknown }[] = [];
    const states: unknown[] = [];
    let effectIndex = 0;
    let memoIndex = 0;
    let stateIndex = 0;
    let pending: (() => void)[] = [];
    let props: Record<string, unknown>;
    return {
      writes: 0,
      render(next = props) {
        props = next;
        active = this;
        effectIndex = memoIndex = stateIndex = 0;
        pending = [];
        const tree = SkiaWebGate(props) as Element | string | null;
        pending.forEach((run) => run());
        return tree;
      },
      effect(callback: () => (() => void) | undefined, deps: unknown[]) {
        const index = effectIndex++;
        const previous = effects[index];
        if (previous && sameDeps(deps, previous.deps)) return;
        pending.push(() => {
          previous?.cleanup?.();
          effects[index] = { deps, cleanup: callback() };
        });
      },
      memo(factory: () => unknown, deps: unknown[]) {
        const index = memoIndex++;
        if (!memos[index] || !sameDeps(deps, memos[index].deps)) memos[index] = { deps, value: factory() };
        return memos[index].value;
      },
      state(initial: unknown) {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (next: any) => {
          this.writes++;
          states[index] = typeof next === 'function' ? next(states[index]) : next;
        }];
      },
      unmount() { effects.forEach((effect) => effect.cleanup?.()); },
      replayEffects() { this.unmount(); effects = []; this.render(); },
    };
  }
  const loader = modules['@shopify/react-native-skia/lib/module/web'] as { LoadSkiaWeb: (options: { locateFile: (file: string) => string }) => Promise<void> };
  return { mount, bootstrap, locations, initialize: () => loader.LoadSkiaWeb({ locateFile: (file) => `/canvaskit/${file}` }) };
}

function sameDeps(left: unknown[], right: unknown[]) {
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
}

for (const entry of skiaEntries) test(`failed initialization can retry through ${entry}`, async () => {
  const { mount, bootstrap, locations } = fixture(entry);
  let loads = 0;
  const props = { load: async () => { loads++; return loaded; }, props: { color: 'blue' }, fallback: 'fallback' };
  const first = mount();
  assert.equal(first.render(props), 'fallback');
  await settle();
  assert.equal(bootstrap.length, 1);
  bootstrap[0]!.reject(new Error('temporary WASM failure'));
  await settle();
  assert.equal(first.render(), 'fallback');
  assert.equal(loads, 0);
  assert.equal(bootstrap.length, 1, 'failure must not create an automatic retry loop');
  first.unmount();
  const later = mount();
  assert.equal(later.render(props), 'fallback');
  await settle();
  assert.equal(bootstrap.length, 2, 'a later mount starts a new CanvasKit attempt');
  bootstrap[1]!.resolve({});
  await settle();
  assert.deepEqual(later.render(), { type: Background, props: { color: 'blue' } });
  assert.equal(loads, 1);
  assert.deepEqual(locations, ['/canvaskit/canvaskit.wasm', '/canvaskit/canvaskit.wasm']);
  later.unmount();
});


for (const entry of skiaEntries) test(`pinned loader deduplicates failures and retries through ${entry}`, async () => {
  const { bootstrap, initialize } = fixture(entry);
  const first = initialize();
  const second = initialize();
  const failed = Promise.allSettled([first, second]);
  assert.equal(bootstrap.length, 1);
  bootstrap[0]!.reject(new Error('temporary WASM failure'));
  assert.deepEqual((await failed).map((result) => result.status), ['rejected', 'rejected']);
  const retry = initialize();
  const concurrent = initialize();
  assert.equal(bootstrap.length, 2);
  bootstrap[1]!.resolve({});
  await Promise.all([retry, concurrent]);
  await initialize();
  assert.equal(bootstrap.length, 2, 'successful CanvasKit remains cached globally');
});

test('concurrent gates share pending initialization and keep successful bootstrap cached', async () => {
  const { mount, bootstrap } = fixture();
  let loads = 0;
  const props = { load: async () => { loads++; return loaded; }, props: {}, fallback: 'fallback' };
  const first = mount();
  const second = mount();
  first.render(props);
  second.render(props);
  await settle();
  assert.equal(bootstrap.length, 1);
  assert.equal(loads, 0, 'Skia-dependent modules must wait for CanvasKit');
  bootstrap[0]!.resolve({});
  await settle();
  assert.equal((first.render() as Element).type, Background);
  assert.equal((second.render() as Element).type, Background);
  assert.equal(loads, 2);
  first.unmount();
  second.unmount();
  const later = mount();
  later.render(props);
  await settle();
  assert.equal((later.render() as Element).type, Background);
  assert.equal(bootstrap.length, 1);
  assert.equal(loads, 3);
  later.unmount();
});

test('failed lazy imports are contained and do not invalidate successful initialization', async () => {
  const { mount, bootstrap } = fixture();
  let loads = 0;
  const props = { load: async () => { if (++loads === 1) throw new Error('chunk unavailable'); return loaded; }, props: {}, fallback: 'fallback' };
  const first = mount();
  first.render(props);
  await settle();
  bootstrap[0]!.resolve({});
  await settle();
  assert.equal(first.render(), 'fallback');
  first.unmount();
  const later = mount();
  later.render(props);
  await settle();
  assert.equal((later.render() as Element).type, Background);
  assert.equal(loads, 2);
  assert.equal(bootstrap.length, 1);
  later.unmount();
});

test('synchronous lazy-load exceptions use the default null fallback', async () => {
  const { mount, bootstrap } = fixture();
  const gate = mount();
  gate.render({ load: () => { throw new Error('module failure'); }, props: {} });
  await settle();
  bootstrap[0]!.resolve({});
  await settle();
  assert.equal(gate.render(), null);
  gate.unmount();
});

test('unmount before initialization skips the abandoned lazy load without canceling other consumers', async () => {
  const { mount, bootstrap } = fixture();
  let abandonedLoads = 0;
  const abandoned = mount();
  const live = mount();
  abandoned.render({ load: async () => { abandonedLoads++; return loaded; }, props: {} });
  live.render({ load: async () => loaded, props: {} });
  await settle();
  abandoned.unmount();
  bootstrap[0]!.resolve({});
  await settle();
  assert.equal(abandonedLoads, 0);
  assert.equal(abandoned.writes, 0);
  assert.equal((live.render() as Element).type, Background);
  live.unmount();
});

for (const fail of [false, true]) test(`unmounted pending module cannot commit its ${fail ? 'failure' : 'success'}`, async () => {
  const { mount, bootstrap } = fixture();
  const module = deferred<typeof loaded>();
  const gate = mount();
  gate.render({ load: () => module.promise, props: {} });
  await settle();
  bootstrap[0]!.resolve({});
  await settle();
  gate.unmount();
  const writes = gate.writes;
  if (fail) module.reject(new Error('late failure'));
  else module.resolve(loaded);
  await settle();
  assert.equal(gate.writes, writes);
});

for (const fail of [false, true]) test(`replaced loader cannot overwrite its successor with ${fail ? 'failure' : 'success'}`, async () => {
  const { mount, bootstrap } = fixture();
  const old = deferred<typeof loaded>();
  const gate = mount();
  gate.render({ load: () => old.promise, props: {}, fallback: 'fallback' });
  await settle();
  bootstrap[0]!.resolve({});
  await settle();
  gate.render({ load: async () => ({ default: OtherBackground }), props: { color: 'green' }, fallback: 'fallback' });
  await settle();
  const current = { type: OtherBackground, props: { color: 'green' } };
  assert.deepEqual(gate.render(), current);
  const writes = gate.writes;
  if (fail) old.reject(new Error('obsolete chunk failed'));
  else old.resolve(loaded);
  await settle();
  assert.deepEqual(gate.render(), current);
  assert.equal(gate.writes, writes);
  gate.unmount();
});

test('replacing an already rendered loader shows the existing fallback while the new load fails', async () => {
  const { mount, bootstrap } = fixture();
  const gate = mount();
  gate.render({ load: async () => loaded, props: {}, fallback: 'fallback' });
  await settle();
  bootstrap[0]!.resolve({});
  await settle();
  assert.equal((gate.render() as Element).type, Background);
  const next = deferred<typeof loaded>();
  assert.equal(gate.render({ load: () => next.promise, props: {}, fallback: 'fallback' }), 'fallback');
  await settle();
  next.reject(new Error('replacement unavailable'));
  await settle();
  assert.equal(gate.render(), 'fallback');
  gate.unmount();
});

test('effect cleanup/replay deduplicates bootstrap and abandons the obsolete load', async () => {
  const { mount, bootstrap } = fixture();
  let loads = 0;
  const gate = mount();
  gate.render({ load: async () => { loads++; return loaded; }, props: {} });
  gate.replayEffects();
  await settle();
  assert.equal(bootstrap.length, 1);
  bootstrap[0]!.resolve({});
  await settle();
  assert.equal(loads, 1);
  assert.equal((gate.render() as Element).type, Background);
  gate.unmount();
});
