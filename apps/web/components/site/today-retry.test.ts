import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { it } from 'node:test';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';

// Component wiring test; hooks are isolated, not a mounted-browser assertion.
const h = {
  failed: false, pending: false, refreshes: 0, input: undefined as unknown,
  action: async (_input: unknown): Promise<void> => {}, transition: Promise.resolve(),
};
Object.assign(globalThis, { __todayRetry: h });
const base = 'const h = globalThis.__todayRetry;';
const stubs: Record<string, string> = {
  react: `${base}
    export const useState = () => [h.failed, value => { h.failed = value; }];
    export const useTransition = () => [h.pending, run => { h.transition = run(); }];`,
  'next/navigation': `${base} export const useRouter = () => ({ refresh: () => h.refreshes++ });`,
  '@acme/ui/mights': 'export const MightsButton = () => null; export const MightsText = () => null;',
  '../../lib/today-retry-action.ts': `${base} export const retryTodayEvents = input => { h.input = input; return h.action(input); };`,
};
const url = new URL('./TodayRetry.tsx', import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === url && specifier in stubs) return { url: `today-retry-test:${specifier}`, shortCircuit: true };
    return next(specifier, context);
  },
  load(specifier, context, next) {
    if (specifier.startsWith('today-retry-test:')) return { format: 'module', source: stubs[specifier.slice('today-retry-test:'.length)]!, shortCircuit: true };
    if (specifier === url) return { format: 'module', source: transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX } }).outputText, shortCircuit: true };
    return next(specifier, context);
  },
});
const { TodayRetry } = await import('./TodayRetry.tsx');

it('retry awaits scoped invalidation before refreshing and disables the pending control', async () => {
  const search = { view: 'upcoming' as const, page: 2 };
  let release!: () => void;
  h.action = () => new Promise<void>((resolve) => { release = resolve; });
  TodayRetry(search).props.children[0].props.onPress();
  assert.deepEqual(h.input, search);
  assert.equal(h.refreshes, 0);
  h.pending = true;
  const pending = TodayRetry(search).props.children[0];
  assert.equal(pending.props.disabled, true);
  assert.equal(pending.props.children, 'Checking…');
  release();
  await h.transition;
  assert.equal(h.refreshes, 1);
  h.pending = false;
});

it('action failures stay retryable and the next attempt uses the current view/page', async () => {
  h.action = async () => { throw new Error('Network unavailable'); };
  const before = h.refreshes;
  TodayRetry({ view: 'upcoming', page: 2 }).props.children[0].props.onPress();
  await h.transition;
  assert.equal(h.failed, true);
  assert.equal(h.refreshes, before);
  const failed = TodayRetry({ view: 'upcoming', page: 2 });
  assert.match(failed.props.children[1].props.children, /Please try again/);
  assert.equal(failed.props.children[0].props.disabled, false);
  h.action = async () => {};
  TodayRetry({ view: 'today', page: 1 }).props.children[0].props.onPress();
  await h.transition;
  assert.deepEqual(h.input, { view: 'today', page: 1 });
  assert.equal(h.failed, false);
  assert.equal(h.refreshes, before + 1);
});
