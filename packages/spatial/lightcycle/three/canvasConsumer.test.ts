import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';
import * as core from '../tabletopCore.ts';
import { tabletopRace } from '../runtime/tabletopRaceStore.ts';
import { tabletopSession } from '../runtime/tabletopSessionStore.ts';
import { tabletopSoloInput } from '../runtime/tabletopSoloInputStore.ts';
import { handleTabletopCanvasUnavailable } from './tabletopCanvasFailure.ts';

type Element = { type: unknown; props: Record<string, unknown> };
const jsx = (type: unknown, props: Element['props']) => ({ type, props });
function evaluate(url: URL, leaves: Record<string, unknown>) {
  const exports: Record<string, unknown> = {};
  const output = transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'exports', output)((id: string) => {
    if (id.endsWith('.glb') || id.endsWith('.wav')) return 1;
    assert.ok(id in leaves, `Unexpected consumer import ${id}`);
    return leaves[id];
  }, exports);
  return exports;
}
function allElements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(allElements);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const element = value as Element;
  return [element, ...allElements(element.props.children)];
}

for (const platform of ['web', 'native'] as const) {
  test(`tabletop ${platform}: real consumer routes canvas failure into the visible session error and closed view`, () => {
    tabletopSession.getState().reset();
    tabletopSession.getState().setPlayerName('PLAYER');
    tabletopSession.getState().beginSolo();
    const Canvas = 'ThreeLightCycleCanvas';
    const leaves = {
      react: { useEffect() {} },
      'react/jsx-runtime': { jsx, jsxs: jsx },
      '@acme/ui/tw': { View: 'View', Text: 'Text', Pressable: 'Pressable' },
      'react-native': { Image: { resolveAssetSource: () => ({ uri: '/head.glb' }) } },
      [`./ThreeLightCycleCanvas.${platform}`]: { ThreeLightCycleCanvas: Canvas },
      './tabletopCanvasFailure': { handleTabletopCanvasUnavailable },
      [`../../mcp/McpVoicePlayback.${platform}`]: { McpVoicePlaybackWeb: 'Voice', McpVoicePlaybackNative: 'Voice' },
      '../ui/TabletopRiveScoreboard.web': { TabletopRiveScoreboardWeb: 'Scoreboard' },
      '../runtime/tabletopSessionStore': { useTabletopSessionStore: (select: (state: ReturnType<typeof tabletopSession.getState>) => unknown) => select(tabletopSession.getState()) },
      '../runtime/tabletopRaceStore': { useTabletopRaceStore: (select: (state: { hostRenderState: null }) => unknown) => select({ hostRenderState: null }) },
      '../runtime/tabletopSoloInputStore': { tabletopSoloInput },
      '../runtime/useTabletopSoloDriver': { useTabletopSoloDriver: () => ({ getState: () => null }) },
    };
    const { TabletopThreeExperience } = evaluate(new URL(`./TabletopThreeExperience.${platform}.tsx`, import.meta.url), leaves);
    const tree = (TabletopThreeExperience as () => Element)();
    const canvas = allElements(tree).find((element) => element.type === Canvas)!;
    assert.equal(canvas.props.onUnavailable, handleTabletopCanvasUnavailable);
    (canvas.props.onUnavailable as (reason: string) => void)('init-failed');
    assert.equal(tabletopSession.getState().spatialViewOpen, false);
    assert.equal(tabletopSession.getState().mode, 'idle');
    assert.match(tabletopSession.getState().error!, /3D race is unavailable/);
    assert.equal(tabletopSession.getState().playerName, 'PLAYER');
    assert.equal(tabletopRace.getState().hostRenderState, null);
    tabletopSession.getState().beginSolo();
    assert.equal(tabletopSession.getState().error, null, 'existing Solo action permits a clean retry');
    tabletopSession.getState().reset();
  });
}

test('tabletop capability failure explains WebGPU and does not dismiss another session mode', () => {
  tabletopSession.getState().setPlayerName('PLAYER');
  tabletopSession.getState().beginSolo();
  handleTabletopCanvasUnavailable('no-webgpu');
  assert.match(tabletopSession.getState().error!, /WebGPU support/);
  tabletopSession.getState().beginHost();
  handleTabletopCanvasUnavailable('init-failed');
  assert.equal(tabletopSession.getState().mode, 'host');
  assert.equal(tabletopSession.getState().spatialViewOpen, true);
  assert.equal(tabletopSession.getState().error, null);
  tabletopSession.getState().reset();
});

test('solo production driver keeps one getter across tick-driven re-renders and reads the latest state', (t) => {
  const slots: unknown[] = [];
  let cursor = 0;
  let setup: (() => () => void) | undefined;
  let cleanup: (() => void) | undefined;
  const callbacks = new Map<number, (now: number) => void>();
  let id = 0;
  const originalRequest = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
  const originalCancel = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame');
  Object.defineProperties(globalThis, {
    requestAnimationFrame: { configurable: true, value: (callback: (now: number) => void) => { callbacks.set(++id, callback); return id; } },
    cancelAnimationFrame: { configurable: true, value: (key: number) => callbacks.delete(key) },
  });
  t.after(() => {
    cleanup?.();
    for (const [key, descriptor] of [['requestAnimationFrame', originalRequest], ['cancelAnimationFrame', originalCancel]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  const react = {
    useRef(current: unknown) { const key = cursor++; return slots[key] ??= { current }; },
    useCallback(callback: unknown) { const key = cursor++; return slots[key] ??= callback; },
    useEffect(next: () => () => void, deps: unknown[]) {
      const key = cursor++;
      const previous = slots[key] as unknown[] | undefined;
      if (!previous || deps.some((value, index) => !Object.is(value, previous[index]))) {
        slots[key] = deps;
        setup = next;
      }
    },
  };
  const module = evaluate(new URL('../runtime/useTabletopSoloDriver.ts', import.meta.url), {
    react,
    '../tabletopCore': core,
    // AI choice is a controlled leaf; production stepping and stores run here.
    '../tabletopAi': { chooseTabletopAiInput: () => ({ turn: 0, boost: false }) },
    './tabletopRaceStore': { tabletopRace },
    './tabletopSoloInputStore': { tabletopSoloInput },
  });
  // This executes the exported hook inside the controlled hook host above,
  // rather than calling a React hook from this test runner's render function.
  const runDriver = module.useTabletopSoloDriver as (name: string) => { getState: () => core.LightCycleMatchState | null };
  const render = (name = 'PLAYER') => {
    cursor = 0;
    setup = undefined;
    const driver = runDriver(name);
    if (setup) { cleanup?.(); cleanup = (setup as () => () => void)(); }
    return driver;
  };
  const driver = render();
  const initial = driver.getState()!;
  const frame = (now: number) => {
    const [key, callback] = callbacks.entries().next().value!;
    callbacks.delete(key);
    callback(now);
  };
  frame(10);
  frame(30);
  assert.ok(driver.getState()!.tick > initial.tick);
  assert.equal(driver.getState(), tabletopRace.getState().hostRenderState);
  assert.equal(render().getState, driver.getState, 'a tick must not change the canvas effect dependency');
  assert.equal(render('RENAMED').getState, driver.getState);
  assert.equal(driver.getState()!.riders.p1.name, 'RENAMED');
  cleanup?.();
  cleanup = undefined;
  assert.equal(driver.getState(), null);
  assert.equal(callbacks.size, 0);
});
