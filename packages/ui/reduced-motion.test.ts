/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';
import { createStore, type StateCreator } from 'zustand/vanilla';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
type Element = { type: unknown; props: Record<string, unknown> };

// Execute the production singleton and press-scale consumer with real Zustand
// state. Only React hook scheduling/binding, platform events and render leaves
// are controlled; this does not exercise device accessibility or animations.
function fixture() {
  let resolve!: (value: boolean) => void;
  let reject!: (error: Error) => void;
  const snapshot = new Promise<boolean>((yes, no) => { resolve = yes; reject = no; });
  const effects: (() => void)[] = [];
  const listeners: ((value: boolean) => void)[] = [];
  const calls: string[] = [];
  const warnings: string[] = [];
  const jsx = (type: unknown, props: Element['props']): Element => ({ type, props });
  const modules: Record<string, unknown> = {
    react: { useEffect: (effect: () => void) => effects.push(effect) },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    zustand: {
      create: <T>(initializer: StateCreator<T>) => {
        const store = createStore(initializer);
        return Object.assign((select: (state: T) => unknown) => select(store.getState()), store);
      },
    },
    'react-native': { AccessibilityInfo: {
      isReduceMotionEnabled() { calls.push('read'); return snapshot; },
      addEventListener(name: string, listener: (value: boolean) => void) {
        assert.equal(name, 'reduceMotionChanged');
        calls.push('subscribe'); listeners.push(listener);
        return { remove() { throw new Error('The app-lifetime listener should not be removed'); } };
      },
    } },
    '@legendapp/motion': { Motion: { Pressable: 'Motion.Pressable' } },
    './html/css': { css: (component: unknown) => component },
    './motion': { MotionView: 'MotionView' },
  };
  function execute<T>(name: string): T {
    const output = transpileModule(readFileSync(new URL(name, import.meta.url), 'utf8'), {
      compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
    }).outputText;
    const exports = {};
    new Function('require', 'exports', 'console', output)((id: string) => {
      assert.ok(id in modules, `Unexpected dependency: ${id}`);
      return modules[id];
    }, exports, { warn: (message: string) => warnings.push(message) });
    return exports as T;
  }
  const kit = execute<typeof import('./reduced-motion')>('./reduced-motion.ts');
  modules['./reduced-motion'] = kit;
  const { PressScale } = execute<typeof import('./press-scale.native')>('./press-scale.native.tsx');
  return {
    kit, PressScale, calls, warnings, resolve, reject,
    flushEffects() { effects.splice(0).forEach((effect) => effect()); },
    emit(value: boolean) { listeners.forEach((listener) => listener(value)); },
    value() { return kit.useReducedMotionStore.getState().reduceMotion; },
  };
}

test('initial setting is read lazily and applied when no event supersedes it', async () => {
  for (const setting of [false, true]) {
    const f = fixture();
    assert.deepEqual(f.calls, []);
    assert.equal(f.kit.useReducedMotion(), false);
    f.flushEffects();
    assert.equal(f.value(), false);
    f.resolve(setting); await tick();
    assert.equal(f.value(), setting);
    assert.equal(f.kit.useReducedMotion(), setting);
    assert.deepEqual(f.warnings, []);
  }
});

test('system events supersede a pending initial snapshot in either direction', async () => {
  for (const latest of [false, true]) {
    const f = fixture();
    f.kit.useReducedMotion(); f.flushEffects();
    f.emit(latest);
    f.resolve(!latest); await tick();
    assert.equal(f.value(), latest, `a stale ${!latest} snapshot must not replace a ${latest} event`);
  }
});

test('the last of multiple events wins, including an event after snapshot resolution but before its callback', async () => {
  const f = fixture();
  f.kit.useReducedMotion(); f.flushEffects();
  f.emit(true); f.emit(false);
  f.resolve(false);
  f.emit(true); await tick();
  assert.equal(f.value(), true);
  f.emit(false);
  assert.equal(f.value(), false);
});

test('snapshot-first initialization continues following changes in both directions', async () => {
  const f = fixture();
  f.kit.useReducedMotion(); f.flushEffects();
  f.resolve(true); await tick();
  assert.equal(f.value(), true);
  f.emit(false); assert.equal(f.value(), false);
  f.emit(true); assert.equal(f.value(), true);
});

test('multiple consumers and repeated effects share one read and one app-lifetime listener', async () => {
  const f = fixture();
  f.kit.useReducedMotion(); f.kit.useReducedMotion(); f.flushEffects();
  f.kit.useReducedMotion(); f.flushEffects();
  assert.deepEqual(f.calls, ['subscribe', 'read']);
  f.emit(true); f.resolve(false); await tick();
  assert.equal(f.kit.useReducedMotion(), true);
  f.flushEffects();
  assert.deepEqual(f.calls, ['subscribe', 'read']);
});

test('a rejected initial read keeps the current value, reports the failure and still follows events', async () => {
  for (const eventBeforeFailure of [false, true]) {
    const f = fixture();
    f.kit.useReducedMotion(); f.flushEffects();
    if (eventBeforeFailure) f.emit(true);
    f.reject(new Error('native read failed')); await tick();
    assert.equal(f.value(), eventBeforeFailure);
    assert.deepEqual(f.warnings, ['[reduced-motion] could not read the system setting: Error: native read failed']);
    f.emit(!eventBeforeFailure); assert.equal(f.value(), !eventBeforeFailure);
    f.emit(eventBeforeFailure); assert.equal(f.value(), eventBeforeFailure);
  }
});

test('transition and press-scale consumers keep reduced motion after a stale snapshot', async () => {
  const f = fixture();
  const onPress = () => {};
  const props = { children: 'Open', onPress, className: 'surface', outerClassName: 'hit-area', 'aria-label': 'Open place' };
  let press = f.PressScale(props) as unknown as Element;
  const inner = () => press.props.children as Element;
  assert.deepEqual(inner().props.whileTap, { scale: 0.96, opacity: 0.9 });
  f.flushEffects(); f.emit(true); f.resolve(false); await tick();
  press = f.PressScale(props) as unknown as Element;
  assert.equal(inner().props.whileTap, undefined);
  assert.equal(press.props.onPress, onPress);
  assert.equal(press.props.className, 'hit-area');
  assert.equal(press.props['aria-label'], 'Open place');
  assert.equal(inner().props.className, 'surface');
  assert.equal(inner().props.children, 'Open');
  const spring = { type: 'spring', damping: 22, stiffness: 500 };
  assert.equal(f.kit.transitionFor(f.value(), spring), f.kit.INSTANT_TRANSITION);
  assert.deepEqual(f.kit.INSTANT_TRANSITION, { type: 'timing', duration: 0 });
  f.emit(false);
  press = f.PressScale(props) as unknown as Element;
  assert.deepEqual(inner().props.whileTap, { scale: 0.96, opacity: 0.9 });
  assert.equal(f.kit.transitionFor(f.value(), spring), spring);
});
