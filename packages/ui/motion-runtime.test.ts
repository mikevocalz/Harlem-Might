/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import ts from 'typescript';

type Element = ReactElement<Record<string, unknown>>;
type Trace = {
  hydrated: boolean;
  wrapped: unknown[];
  css: { component: unknown; props: unknown; mapping: unknown }[];
  motion: { component: unknown; props: Record<string, unknown> }[];
};

// Execute both production css forks and the real motion/preset/consumer modules.
// Legend and platform styling leaves are inert, so these check forwarding and
// composition without claiming native animation or browser hydration coverage.
async function loadPlatform(platform: 'web' | 'native') {
  const prefix = `motion-contract-${platform}:`;
  const source = (path: string) => new URL(`${path}?motion-contract=${platform}`, import.meta.url).href;
  const motionUrl = source('./motion.tsx');
  const cssUrl = source(`./html/css.${platform}.tsx`);
  const emptyUrl = source('./EmptyState.tsx');
  const toastUrl = source('./Toast.tsx');
  const sources = [motionUrl, cssUrl, emptyUrl, toastUrl];
  const leaves: Record<string, string> = {
    trace: `export const trace = { hydrated: false, wrapped: [], css: [], motion: [] };`,
    react: `
      import { trace } from '${prefix}trace';
      export const useSyncExternalStore = (_subscribe, snapshot, serverSnapshot) =>
        trace.hydrated ? snapshot() : serverSnapshot();
    `,
    '@legendapp/motion': `
      import { createElement } from 'react';
      import { trace } from '${prefix}trace';
      const leaf = component => props => {
        trace.motion.push({ component, props });
        return createElement(component, props);
      };
      export const Motion = { View: leaf('Motion.View'), Text: leaf('Motion.Text') };
      export const AnimatePresence = leaf('AnimatePresence');
      export const createMotionComponent = leaf;
      export const createMotionAnimatedComponent = Component => {
        trace.wrapped.push(Component);
        return leaf(Component);
      };
    `,
    'react-native-css': `
      import { createElement } from 'react';
      import { trace } from '${prefix}trace';
      export const useCssElement = (component, props, mapping) => {
        trace.css.push({ component, props, mapping });
        return createElement(component, props);
      };
    `,
    uniwind: `
      import { createElement } from 'react';
      export const withUniwind = Component => props => createElement(Component, props);
    `,
    './tw': `export const View = 'View';`,
    './Text': `export const Text = 'Text';`,
  };
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith(prefix)) return { url: specifier, shortCircuit: true };
      if (context.parentURL?.startsWith(prefix)) return next(specifier, { ...context, parentURL: import.meta.url });
      if (context.parentURL && sources.includes(context.parentURL)) {
        if (specifier in leaves && (specifier !== 'react' || context.parentURL === motionUrl)) {
          return { url: `${prefix}${specifier}`, shortCircuit: true };
        }
        if (specifier === './html/css') return next(cssUrl, context);
        if (specifier === './motion') return next(motionUrl, context);
        if (specifier === './tv') return next(new URL('./tv.ts', import.meta.url).href, context);
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.startsWith(prefix)) {
        return { format: 'module', shortCircuit: true, source: leaves[url.slice(prefix.length)]! };
      }
      if (sources.includes(url)) {
        return { format: 'module', shortCircuit: true, source: ts.transpileModule(
          readFileSync(new URL(url), 'utf8'),
          { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } },
        ).outputText };
      }
      return next(url, context);
    },
  });
  try {
    return {
      kit: await import(motionUrl) as typeof import('./motion'),
      empty: await import(emptyUrl) as typeof import('./EmptyState'),
      toast: await import(toastUrl) as typeof import('./Toast'),
      trace: (await import(`${prefix}trace`) as { trace: Trace }).trace,
    };
  } finally {
    hooks.deregister();
  }
}

function render(element: ReactNode): Element {
  assert.ok(isValidElement<Record<string, unknown>>(element));
  let current = element;
  while (typeof current.type === 'function') {
    current = (current.type as (props: Element['props']) => Element)(current.props);
  }
  return current;
}

for (const platform of ['web', 'native'] as const) {
  const { kit, empty, toast, trace } = await loadPlatform(platform);

  test(`motion forwards custom, motion, styling and ref props on ${platform}`, () => {
    const Card = (props: { label: string; style?: unknown; ref?: unknown }) => createElement('Card', props);
    const MotionCard = kit.motion(Card);
    assert.equal(MotionCard.displayName, 'CSS(Motion(Card))');
    assert.equal(trace.wrapped.at(-1), Card);
    const onAnimationComplete = () => {};
    const ref = { current: null };
    const props = {
      label: 'Apollo', ref, className: 'p-4', style: [{ opacity: 0.8 }],
      initial: { y: 12 }, animate: { y: 0 }, exit: { opacity: 0 },
      animateProps: { label: 'New label' }, initialProps: { label: 'Initial' },
      whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 },
      transition: { type: 'spring' as const, damping: 18 },
      transformOrigin: { x: '50%' as const }, onAnimationComplete,
    };
    const result = render(createElement(MotionCard, props));
    assert.equal(result.type, 'Card');
    assert.deepEqual(result.props, props);
    const received = trace.motion.at(-1)!;
    assert.equal(received.component, Card);
    for (const key of Object.keys(props)) assert.equal(received.props[key], props[key as keyof typeof props]);
    if (platform === 'web') assert.deepEqual(trace.css.at(-1)?.mapping, { className: 'style' });

    Card.displayName = 'NamedCard';
    assert.equal(kit.motion(Card).displayName, 'CSS(Motion(NamedCard))');
    assert.equal(kit.motion(Card, 'Override').displayName, 'CSS(Motion(Override))');
  });

  test(`motion primitives keep view props and text styling on ${platform}`, () => {
    const viewProps = { className: 'overflow-hidden', animate: { width: 300 }, style: { flexGrow: 1 }, children: 'Pane' };
    assert.deepEqual(render(createElement(kit.MotionView, viewProps)).props, viewProps);
    const text = render(createElement(kit.MotionText, { className: 'text-primary', numberOfLines: 1 }, 'Harlem'));
    assert.equal(text.type, 'Motion.Text');
    assert.equal(text.props.className, 'text-body-default text-primary');
    assert.equal(text.props.children, 'Harlem');
    assert.equal(text.props.numberOfLines, 1);
  });

  test(`motion presets retain visible server content, entrances and overrides on ${platform}`, () => {
    for (const [Preset, initial, animate, transition] of [
      [kit.FadeIn, { y: 12 }, { y: 0 }, { type: 'timing', duration: 280, ease: 'easeOut', delay: 80 }],
      [kit.ScaleIn, { scale: 0.94 }, { scale: 1 }, { type: 'spring', damping: 18, stiffness: 260, delay: 80 }],
      [kit.SlideUp, { y: 24 }, { y: 0 }, { type: 'spring', damping: 20, stiffness: 300, delay: 80 }],
    ] as const) {
      trace.hydrated = false;
      const server = Preset({ children: 'Visible content', className: 'panel', delay: 80 });
      assert.equal(server.key, 'ssr');
      assert.equal(server.props.initial, undefined);
      assert.equal(server.props.animate, undefined);
      assert.equal(render(server).props.children, 'Visible content');
      trace.hydrated = true;
      const hydrated = Preset({ children: 'Visible content', className: 'panel', delay: 80 });
      assert.equal(hydrated.key, 'hydrated');
      assert.deepEqual(hydrated.props.initial, initial);
      assert.deepEqual(hydrated.props.animate, animate);
      assert.deepEqual(hydrated.props.transition, transition);
      assert.equal('delay' in hydrated.props, false);
      const override = { initial: { opacity: 0.5 }, animate: { opacity: 1 }, transition: { type: 'timing' as const, duration: 0 } };
      const custom = Preset(override);
      for (const key of ['initial', 'animate', 'transition'] as const) assert.equal(custom.props[key], override[key]);
    }
  });

  test(`existing empty-state and toast consumers keep their preset composition on ${platform}`, () => {
    trace.hydrated = false;
    const state = empty.EmptyState({ icon: 'Icon', title: 'No places', description: 'Try another search', className: 'custom-empty' });
    assert.equal(state.type, kit.FadeIn);
    assert.match(String(state.props.className), /custom-empty/);
    const icon = (state.props.children as ReactNode[])[0] as Element;
    assert.equal(icon.type, kit.ScaleIn);
    assert.equal(icon.props.delay, 80);
    assert.equal(icon.props['aria-hidden'], true);
    assert.equal(render(icon).props.children, 'Icon');
    const notification = toast.Toast({ title: 'Saved', description: 'Apollo', className: 'custom-toast' });
    assert.equal(notification.type, kit.SlideUp);
    const result = render(notification);
    assert.equal(result.props.role, 'status');
    assert.match(String(result.props.className), /custom-toast/);
    assert.equal(result.props.initial, undefined);
    assert.equal(result.props.animate, undefined);
  });
}
