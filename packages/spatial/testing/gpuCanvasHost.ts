/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';

export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
export type CanvasKind = 'lightcycle' | 'sightline';
export type Platform = 'web' | 'native';
type Props = Record<string, unknown>;
type Effect = { deps: readonly unknown[]; cleanup?: (() => void) | void };

/** Executes the actual TSX effect bodies with controlled hooks, surfaces and GPU
 * leaves. Dependency comparison and cleanup-before-replacement are modeled;
 * this is not a React renderer, browser, native-device or GPU validation test. */
export function createGpuCanvasHost(kind: CanvasKind, platform: Platform) {
  const instances: Renderer[] = [];
  const observers: Observer[] = [];
  const devices: ReturnType<typeof makeDevice>[] = [];
  const warnings: unknown[][] = [];
  const hooks: unknown[] = [];
  let cursor = 0;
  let scheduled: (() => void)[] = [];
  let init: () => Promise<void> = async () => {};
  let disposal: () => Promise<void> = async () => {};
  let missingContext = false;
  let configureError = false;
  let observerError = false;
  const configureCalls: unknown[] = [];
  const surface = {
    width: 0, height: 0, clientWidth: 100, clientHeight: 50,
    getBoundingClientRect: () => ({ width: surface.clientWidth, height: surface.clientHeight }),
    getContext: () => missingContext ? null : context,
  };
  const context = {
    canvas: surface,
    configure(options: unknown) {
      configureCalls.push(options);
      if (configureError) throw new Error('configure failed');
    },
  };
  function makeDevice() {
    const lost = deferred<{ reason: string }>();
    return {
      lost: lost.promise, lose: lost.resolve, destroyed: 0,
      destroy() { this.destroyed++; lost.resolve({ reason: 'destroyed' }); },
    };
  }
  const nativeDevice = makeDevice();
  let currentNativeDevice: ReturnType<typeof makeDevice> | null = nativeDevice;
  const adapter = {
    requestDevice: async () => {
      const device = makeDevice();
      devices.push(device);
      return device;
    },
  };
  const gpu = {
    requestAdapter: async (): Promise<typeof adapter | null> => adapter,
    getPreferredCanvasFormat: () => 'bgra8unorm',
  };
  class Observer {
    disconnected = 0;
    readonly callback: () => void;
    constructor(callback: () => void) { this.callback = callback; observers.push(this); }
    observe() { if (observerError) throw new Error('observe failed'); }
    disconnect() { this.disconnected++; }
  }
  class Renderer {
    initArgs: unknown[] = [];
    disposed = 0;
    liveAllocation = false;
    loop: ((now: number) => void) | null = null;
    activations = 0;
    frames: unknown[][] = [];
    sizes: number[][] = [];
    progress: number[] = [];
    initialize = init;
    release = disposal;
    renderer = {
      setAnimationLoop: async (callback: ((now: number) => void) | null) => {
        this.loop = callback;
        if (callback) this.activations++;
      },
    };
    readonly options: Props;
    constructor(options: Props) { this.options = options; instances.push(this); }
    async init(...args: unknown[]) {
      this.initArgs = args;
      await this.initialize();
      this.liveAllocation = true;
    }
    resize(...size: number[]) { this.sizes.push(size); }
    setProgress(progress: number) { this.progress.push(progress); }
    render(...args: unknown[]) { this.frames.push(args); }
    async dispose() {
      this.disposed++;
      this.loop = null;
      await this.release();
      this.liveAllocation = false;
    }
  }
  const react = {
    useRef(value: unknown) {
      const index = cursor++;
      hooks[index] ??= { current: value };
      return hooks[index];
    },
    useEffect(setup: () => void | (() => void), deps: readonly unknown[]) {
      const index = cursor++;
      const previous = hooks[index] as Effect | undefined;
      if (!previous || deps.length !== previous.deps.length || deps.some((v, i) => !Object.is(v, previous.deps[i]))) {
        scheduled.push(() => {
          previous?.cleanup?.();
          const effect: Effect = { deps };
          hooks[index] = effect;
          effect.cleanup = setup();
        });
      }
    },
  };
  const jsx = (type: unknown, props: Props) => ({ type, props });
  const leaves: Record<string, unknown> = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { PixelRatio: { get: () => 3 } },
    'react-native-webgpu': { Canvas: 'canvas', useDevice: () => ({ device: currentNativeDevice }) },
    '@acme/ui/primitives': { GpuCanvas: 'canvas' },
    './ThreeLightCycleRenderer': { ThreeLightCycleRenderer: Renderer },
    './SightlineHeroRenderer': { SightlineHeroRenderer: Renderer },
  };
  const modules = new Map<string, Props>();
  function load(url: URL): Props {
    const cached = modules.get(url.href);
    if (cached) return cached;
    const output = transpileModule(readFileSync(url, 'utf8'), {
      compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
    }).outputText;
    const exports: Props = {};
    modules.set(url.href, exports);
    new Function('require', 'exports', output)((id: string) => {
      if (id in leaves) return leaves[id];
      assert.ok(id.startsWith('.'), `Unexpected GPU canvas import: ${id}`);
      return load(new URL(`${id}.ts`, url));
    }, exports);
    return exports;
  }
  const componentName = kind === 'lightcycle' ? 'ThreeLightCycleCanvas' : 'SightlineHeroCanvas';
  const file = kind === 'lightcycle' ? `../lightcycle/three/${componentName}` : `../sightline/${componentName}`;
  const component = load(new URL(`${file}.${platform}.tsx`, import.meta.url))[componentName] as (props: Props) => { props: Props };
  const previousGlobals = ['navigator', 'window', 'devicePixelRatio', 'ResizeObserver'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperties(globalThis, {
    navigator: { configurable: true, value: { gpu } },
    window: { configurable: true, value: { devicePixelRatio: 3 } },
    devicePixelRatio: { configurable: true, value: 3 },
    ResizeObserver: { configurable: true, value: Observer },
  });
  const warn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  return {
    instances, observers, devices, nativeDevice, gpu, adapter, surface, configureCalls, warnings,
    setInit(value: () => Promise<void>) { init = value; },
    setDispose(value: () => Promise<void>) { disposal = value; },
    setMissingContext(value: boolean) { missingContext = value; },
    setConfigureError(value: boolean) { configureError = value; },
    setObserverError(value: boolean) { observerError = value; },
    setNativeDevice(value: typeof currentNativeDevice) { currentNativeDevice = value; },
    render(props: Props = {}) {
      cursor = 0;
      scheduled = [];
      const element = component(props);
      (element.props.ref as { current: unknown }).current = surface;
      scheduled.forEach((setup) => setup());
      return element;
    },
    unmount() {
      for (const hook of hooks) {
        const effect = hook as Effect;
        effect.cleanup?.();
        effect.cleanup = undefined;
      }
    },
    restore() {
      console.warn = warn;
      for (const [key, descriptor] of previousGlobals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}
