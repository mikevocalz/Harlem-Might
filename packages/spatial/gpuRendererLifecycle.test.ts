import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';
import { deferred, flush } from './testing/gpuCanvasHost.ts';

type LifecycleRenderer = {
  init: (...args: string[]) => Promise<void>;
  dispose: () => void | Promise<void>;
};

// Exercise the production renderer lifecycle methods with controlled backend,
// asset-loader and scene leaves. Scene construction/shaders are outside this
// host; the TSX tests separately execute all four actual canvas components.
function rendererLifecycle(kind: 'lightcycle' | 'sightline') {
  const backendInit = deferred();
  const backendDispose = deferred();
  const headLoad = deferred();
  const bikeLoad = deferred();
  let initialized = false;
  const calls = { loops: 0, rendererDisposals: 0, backendDisposals: 0, roots: 0, heads: 0, bikes: 0, headDisposals: 0 };
  const backend = {
    async dispose() { calls.backendDisposals++; await backendDispose.promise; },
  };
  const renderer = {
    backend,
    async init() { await backendInit.promise; initialized = true; },
    async setAnimationLoop() {
      calls.loops++;
      // Three r186 calls init again here when initialization failed.
      if (!initialized) await renderer.init();
    },
    async dispose() {
      calls.rendererDisposals++;
      if (initialized) await backend.dispose();
      void renderer.setAnimationLoop();
    },
  };
  let headAllocated = false;
  const modules = new Map<string, Record<string, unknown>>();
  const leaves: Record<string, unknown> = {
    'three/webgpu': { Mesh: class {} },
    'three/addons/loaders/GLTFLoader.js': { GLTFLoader: class {
      async loadAsync() { calls.bikes++; await bikeLoad.promise; throw new Error('bike unavailable'); }
    } },
    'three/addons/utils/SkeletonUtils.js': { clone() { throw new Error('unexpected clone'); } },
    'three/addons/geometries/RoundedBoxGeometry.js': {},
    typegpu: {},
    '../../mcp/three/McpThreePresence': {},
    './energyMaterial': {},
    './sightlineMaterial': {},
  };
  function load(url: URL): Record<string, unknown> {
    const cached = modules.get(url.href);
    if (cached) return cached;
    const output = transpileModule(readFileSync(url, 'utf8'), {
      compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
    }).outputText;
    const exports: Record<string, unknown> = {};
    modules.set(url.href, exports);
    new Function('require', 'exports', output)((id: string) => {
      if (id in leaves) return leaves[id];
      assert.ok(id.startsWith('.'), `Unexpected renderer import ${id}`);
      return load(new URL(id.endsWith('.ts') ? id : `${id}.ts`, url));
    }, exports);
    return exports;
  }
  const className = kind === 'lightcycle' ? 'ThreeLightCycleRenderer' : 'SightlineHeroRenderer';
  const file = kind === 'lightcycle' ? `./lightcycle/three/${className}.ts` : `./sightline/${className}.ts`;
  const Class = load(new URL(file, import.meta.url))[className] as { prototype: LifecycleRenderer };
  // Seed the resources owned by a constructed renderer, then execute its real
  // init/mountCycles/dispose methods (not a rewritten lifecycle model).
  const instance = Object.assign(Object.create(Class.prototype) as LifecycleRenderer, {
    renderer,
    initialBackend: backend,
    typegpu: { destroy() { calls.roots++; } },
    initialized: false,
    disposed: false,
    cycles: new Map(),
    trailPool: [],
    crashPresentations: new Map(),
    trailMaterials: { p1: { material: { dispose() {} } }, p2: { material: { dispose() {} } } },
    lens: { material: { dispose() {} } },
    scene: { traverse() {}, remove() {} },
    mcpPresence: {
      async init() { calls.heads++; await headLoad.promise; headAllocated = true; },
      dispose() { calls.headDisposals++; headAllocated = false; },
    },
  });
  return { instance, calls, backendInit, backendDispose, headLoad, bikeLoad, headAllocated: () => headAllocated };
}

for (const kind of ['lightcycle', 'sightline'] as const) {
  test(`${kind} renderer: rejected backend init disposes without restarting failed initialization`, async () => {
    const host = rendererLifecycle(kind);
    const init = host.instance.init('/bike.glb', '/head.glb');
    host.backendInit.reject(new Error('backend failed'));
    await assert.rejects(init, /backend failed/);
    const closing = host.instance.dispose();
    host.backendDispose.resolve();
    await closing;
    assert.equal(host.calls.backendDisposals, 1);
    assert.equal(host.calls.rendererDisposals, 0);
    assert.equal(host.calls.loops, 0, 'setAnimationLoop would retry the rejected init');
    assert.equal(host.calls.roots, 1);
    await host.instance.dispose();
    assert.equal(host.calls.backendDisposals, 1);
  });
}

test('lightcycle renderer: failed bike asset waits for the concurrent head load before cleanup', async () => {
  const host = rendererLifecycle('lightcycle');
  let outcome: 'pending' | 'resolved' | 'rejected' = 'pending';
  const init = host.instance.init('/bike.glb', '/head.glb').then(
    () => { outcome = 'resolved'; },
    () => { outcome = 'rejected'; },
  );
  host.backendInit.resolve();
  await flush();
  assert.equal(host.calls.heads, 1);
  assert.equal(host.calls.bikes, 1);
  host.bikeLoad.resolve();
  await flush();
  assert.equal(outcome, 'pending', 'a rejected asset cannot strand its still-running sibling');
  host.headLoad.resolve();
  await init;
  assert.equal(outcome, 'rejected');
  assert.equal(host.headAllocated(), true);
  let closed = false;
  const disposal = Promise.resolve(host.instance.dispose()).then(() => { closed = true; });
  await flush();
  assert.equal(closed, false, 'the renderer exposes asynchronous backend disposal to its owner');
  assert.equal(host.headAllocated(), false);
  host.backendDispose.resolve();
  await disposal;
  assert.equal(host.calls.rendererDisposals, 1);
  assert.equal(host.calls.backendDisposals, 1);
  assert.equal(host.calls.headDisposals, 1);
});

test('sightline renderer: successful init exposes asynchronous backend disposal', async () => {
  const host = rendererLifecycle('sightline');
  const init = host.instance.init();
  host.backendInit.resolve();
  await init;
  let closed = false;
  const disposal = Promise.resolve(host.instance.dispose()).then(() => { closed = true; });
  await flush();
  assert.equal(closed, false);
  assert.equal(host.calls.rendererDisposals, 1);
  host.backendDispose.resolve();
  await disposal;
  assert.equal(closed, true);
  assert.equal(host.calls.backendDisposals, 1);
  assert.equal(host.calls.roots, 1);
});


function loadDisposer() {
  const exports: Record<string, unknown> = {};
  const output = transpileModule(readFileSync(new URL('./disposeWebGPURenderer.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS },
  }).outputText;
  new Function('exports', output)(exports);
  return exports.disposeWebGPURenderer as (renderer: object, initialized: boolean, backend: object) => Promise<void>;
}

for (const hasListener of [false, true]) {
  test(`failed Three WebGL fallback before context acquisition releases original GPU backend (${hasListener ? 'registered' : 'no'} listener)`, async () => {
    const calls: unknown[][] = [];
    const original = { dispose: async () => { calls.push(['gpu']); } };
    const listener = () => {};
    const fallback = {
      isWebGLBackend: true,
      // A supplied GPUCanvasContext has no WebGL getExtension method.
      gl: hasListener ? {} : null,
      _onContextLost: hasListener ? listener : undefined,
      dispose() { throw new Error('uninitialized WebGL disposal must not run'); },
    };
    const renderer = {
      backend: fallback,
      domElement: { removeEventListener: (...args: unknown[]) => calls.push(args) },
      setAnimationLoop() { throw new Error('must not restart initialization'); },
      dispose() { throw new Error('must not restart initialization'); },
    };
    await loadDisposer()(renderer, false, original);
    assert.deepEqual(calls, hasListener ? [['gpu'], ['webglcontextlost', listener]] : [['gpu']]);
  });
}

test('successful Three fallback releases the replaced GPU backend and keeps normal renderer disposal', async () => {
  const calls: string[] = [];
  const original = { dispose: async () => { calls.push('gpu'); } };
  const renderer = {
    backend: {},
    setAnimationLoop: async () => { calls.push('stop'); },
    dispose: async () => { calls.push('renderer'); },
  };
  await loadDisposer()(renderer, true, original);
  assert.deepEqual(calls, ['gpu', 'stop', 'renderer']);
});

test('backend disposal preserves its receiver at the declared/runtime boundary', async () => {
  const backend = { calls: 0, dispose() { this.calls++; } };
  await loadDisposer()({ backend }, false, backend);
  assert.equal(backend.calls, 1);
});

test('unsupported replaced backend still cleans the current renderer before reporting failure', async () => {
  const calls: string[] = [];
  await assert.rejects(loadDisposer()({
    backend: {},
    setAnimationLoop: async () => { calls.push('stop'); },
    dispose: async () => { calls.push('renderer'); },
  }, true, {}), /Three backend does not provide disposal/);
  assert.deepEqual(calls, ['stop', 'renderer']);
});
