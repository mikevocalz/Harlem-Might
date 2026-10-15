import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { ModuleKind, transpileModule } from 'typescript';
import type { ThreeLightCycleRenderer, ThreeLightCycleRendererOptions } from './ThreeLightCycleRenderer';

type Scenario = 'uninitialized' | 'webgpu-ready' | 'webgpu-failed' | 'webgl-ready' | 'webgl-failed';

function disposalCount(resource: THREE.BufferGeometry | THREE.Material) {
  let count = 0;
  resource.addEventListener('dispose', () => { count++; });
  return () => count;
}

// Run the real constructor, arena, fallback bikes and disposal methods against
// pinned Three scene objects. Only GPU initialization, shaders and MCP are
// controlled leaves: no DOM, device, asset downloads or transpiler GPU plugin.
function createHost(scenario: Scenario, realRenderer = false) {
  const calls = { gpu: 0, gl: 0, loops: 0, renderers: 0, roots: 0, devices: 0, heads: 0 };
  const removedListeners: unknown[][] = [];
  const device = { destroy() { calls.devices++; } } as unknown as GPUDevice;
  const context = {
    canvas: {
      width: 320,
      height: 240,
      addEventListener() {},
      removeEventListener(...args: unknown[]) { removedListeners.push(args); },
    },
  } as unknown as GPUCanvasContext;
  const gpuBackend = { async dispose() { calls.gpu++; } };
  const contextLost = () => {};
  const glBackend = {
    isWebGLBackend: true,
    gl: scenario === 'webgl-failed' ? {} : { getExtension() {} },
    _onContextLost: contextLost,
    async dispose() { calls.gl++; },
  };
  class RendererBoundary {
    backend: typeof gpuBackend | typeof glBackend = gpuBackend;
    domElement = context.canvas;
    constructor(options: { device: GPUDevice; context: GPUCanvasContext }) {
      assert.equal(options.device, device);
      assert.equal(options.context, context);
    }
    setSize() {}
    async init() {
      if (scenario.startsWith('webgl')) this.backend = glBackend;
      if (scenario.endsWith('failed')) throw new Error('backend failed');
    }
    async setAnimationLoop(loop: null) { assert.equal(loop, null); calls.loops++; }
    async dispose() { calls.renderers++; await this.backend.dispose(); }
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const headGeometryDisposals = disposalCount(head.geometry);
  const headMaterialDisposals = disposalCount(head.material);
  class McpBoundary {
    root = new THREE.Group().add(head);
    async init() {}
    dispose() {
      calls.heads++;
      head.geometry.dispose();
      head.material.dispose();
    }
  }
  const trailDisposals: (() => number)[] = [];
  const leaves: Record<string, unknown> = {
    'three/webgpu': realRenderer ? THREE : { ...THREE, WebGPURenderer: RendererBoundary },
    'three/addons/loaders/GLTFLoader.js': { GLTFLoader: class {
      loadAsync() { throw new Error('Unexpected asset download'); }
    } },
    'three/addons/utils/SkeletonUtils.js': { clone },
    typegpu: { tgpu: { initFromDevice(options: { device: GPUDevice }) {
      assert.equal(options.device, device);
      return { destroy() { calls.roots++; } };
    } } },
    '../../mcp/three/McpThreePresence': { McpThreePresence: McpBoundary },
    './energyMaterial': { createLightCycleEnergyMaterial() {
      const material = new THREE.MeshBasicMaterial();
      trailDisposals.push(disposalCount(material));
      return { material, setIntensity() {} };
    } },
  };
  const modules = new Map<string, Record<string, unknown>>();
  function load(url: URL): Record<string, unknown> {
    const cached = modules.get(url.href);
    if (cached) return cached;
    const exports: Record<string, unknown> = {};
    modules.set(url.href, exports);
    const output = transpileModule(readFileSync(url, 'utf8'), {
      compilerOptions: { module: ModuleKind.CommonJS },
    }).outputText;
    new Function('require', 'exports', output)((id: string) => {
      if (id in leaves) return leaves[id];
      assert.ok(id.startsWith('.'), `Unexpected renderer import ${id}`);
      return load(new URL(id.endsWith('.ts') ? id : `${id}.ts`, url));
    }, exports);
    return exports;
  }
  const Renderer = load(new URL('./ThreeLightCycleRenderer.ts', import.meta.url)).ThreeLightCycleRenderer as
    new (options: ThreeLightCycleRendererOptions) => ThreeLightCycleRenderer;
  const instance = new Renderer({ context, device, width: 320, height: 240 });
  const floor = instance.scene.children.find((object) => object instanceof THREE.Mesh);
  const grid = instance.scene.children.find((object) => object instanceof THREE.GridHelper);
  assert.ok(floor instanceof THREE.Mesh && floor.geometry instanceof THREE.BoxGeometry);
  assert.ok(floor.material instanceof THREE.MeshStandardMaterial);
  assert.ok(grid instanceof THREE.GridHelper);
  assert.deepEqual(floor.geometry.parameters, { width: 1.24, height: 0.018, depth: 0.84, widthSegments: 1, heightSegments: 1, depthSegments: 1 });
  assert.equal(grid.geometry.getAttribute('position').count, 100);
  assert.equal(grid.scale.z, 0.66);
  const arenaDisposals = [floor.geometry, floor.material, grid.geometry, grid.material].map(disposalCount);
  const borrowed = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const borrowedDisposals = [borrowed.geometry, borrowed.material].map(disposalCount);
  instance.scene.add(borrowed);
  return {
    instance, calls, device, floor, grid, borrowed, arenaDisposals, borrowedDisposals,
    headDisposals: [headGeometryDisposals, headMaterialDisposals], trailDisposals,
    removedListeners, contextLost,
  };
}

for (const scenario of ['uninitialized', 'webgpu-ready', 'webgpu-failed', 'webgl-ready', 'webgl-failed'] as const) {
  test(`arena: ${scenario} disposes the constructor's floor and grid exactly once`, async () => {
    const host = createHost(scenario);
    if (scenario.endsWith('failed')) await assert.rejects(host.instance.init(), /backend failed/);
    else if (scenario.endsWith('ready')) await host.instance.init();

    assert.deepEqual(host.arenaDisposals.map((count) => count()), [0, 0, 0, 0]);
    await host.instance.dispose();
    await host.instance.dispose();
    assert.deepEqual(host.arenaDisposals.map((count) => count()), [1, 1, 1, 1]);
    assert.equal(host.floor.parent, null);
    assert.equal(host.grid.parent, null);
    assert.deepEqual(host.headDisposals.map((count) => count()), [1, 1], 'MCP retains its own cleanup');
    assert.deepEqual(host.trailDisposals.map((count) => count()), [1, 1], 'trail materials retain their own cleanup');
    assert.deepEqual(host.borrowedDisposals.map((count) => count()), [0, 0], 'scene membership does not confer resource ownership');
    assert.equal(host.borrowed.parent, host.instance.scene);
    assert.deepEqual(host.calls, {
      gpu: 1,
      gl: scenario === 'webgl-ready' ? 1 : 0,
      loops: scenario.endsWith('ready') ? 1 : 0,
      renderers: scenario.endsWith('ready') ? 1 : 0,
      roots: 1,
      devices: 0,
      heads: 1,
    });
    assert.deepEqual(host.removedListeners, scenario === 'webgl-failed' ? [['webglcontextlost', host.contextLost]] : []);
    host.borrowed.geometry.dispose();
    host.borrowed.material.dispose();
  });
}

test('arena: real pinned Three backend cleanup leaves a supplied device alive', async () => {
  const host = createHost('uninitialized', true);
  // Model the point where Three adopted the caller's device before an init
  // failure, without starting WebGPU. Its actual backend disposal runs below.
  Object.assign(host.instance.renderer.backend, { device: host.device });
  await host.instance.dispose();
  await host.instance.dispose();
  assert.deepEqual(host.arenaDisposals.map((count) => count()), [1, 1, 1, 1]);
  assert.equal(host.calls.devices, 0);
  assert.equal(host.calls.roots, 1);
  host.borrowed.geometry.dispose();
  host.borrowed.material.dispose();
});

test('arena: releases registered buffer attributes before Three removes its disposal listeners', async () => {
  const [{ default: Attributes }, { default: Geometries }, { default: Info }] = await Promise.all([
    import('three/src/renderers/common/Attributes.js'),
    import('three/src/renderers/common/Geometries.js'),
    import('three/src/renderers/common/Info.js'),
  ]);
  const host = createHost('webgpu-ready');
  await host.instance.init();
  const allocated = new Set<THREE.BufferAttribute>();
  let destroyed = 0;
  // Use Three's actual buffer ownership/listener machinery, substituting only
  // the GPU allocation leaf. No browser or graphics hardware is required.
  const backend = {
    createAttribute(attribute: THREE.BufferAttribute) { allocated.add(attribute); },
    createIndexAttribute(attribute: THREE.BufferAttribute) { allocated.add(attribute); },
    destroyAttribute(attribute: THREE.BufferAttribute) {
      assert.ok(allocated.delete(attribute), 'an attribute must be released only once');
      destroyed++;
    },
  };
  const info = new Info();
  const geometries = new Geometries(new Attributes(backend, info), info);
  for (const object of [host.floor, host.grid]) {
    geometries.updateForRender({
      geometry: object.geometry,
      material: object.material,
      getAttributes: () => Object.values(object.geometry.attributes),
    });
  }
  assert.equal(allocated.size, 6, 'four floor buffers and two grid buffers');
  assert.equal(info.memory.geometries, 2);
  const disposeRenderer = host.instance.renderer.dispose.bind(host.instance.renderer);
  host.instance.renderer.dispose = async () => {
    // Pinned Renderer.dispose calls this, which removes geometry listeners.
    geometries.dispose();
    await disposeRenderer();
  };
  await host.instance.dispose();
  await host.instance.dispose();
  assert.equal(allocated.size, 0, 'arena geometry must release buffers before backend teardown');
  assert.equal(destroyed, 6);
  assert.equal(info.memory.geometries, 0);
  host.borrowed.geometry.dispose();
  host.borrowed.material.dispose();
});
