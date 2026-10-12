import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { it } from 'node:test';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';

type Harness = {
  params: Record<string, string>;
  query: Record<string, unknown>;
  result: Record<string, unknown>;
  subscribe?: (changed: () => void) => () => void;
  onAppState?: (state: string) => void;
  removed: number;
};
const harness: Harness = { params: {}, query: {}, result: { data: undefined }, removed: 0 };
Object.assign(globalThis, { __harlemTodayHarness: harness });
const base = 'const h = globalThis.__harlemTodayHarness;';
const stubs: Record<string, string> = {
  react: `${base} export const useSyncExternalStore = (subscribe, getSnapshot) => { h.subscribe = subscribe; return getSnapshot(); };`,
  'react-native': `${base} export const AppState = { addEventListener: (_, cb) => { h.onAppState = cb; return { remove: () => h.removed++ }; } };`,
  'expo-router': `${base} export const useLocalSearchParams = () => h.params;`,
  '@tanstack/react-query': `${base} export const useQuery = options => { h.query = options; return h.result; };`,
  '@acme/ui/mights': 'export const MightsButton = () => null;',
  '@acme/app/features/site/today/TodayScreen.tsx': 'export const TodayScreen = () => null;',
  '@/src/site/content-readers': 'export const contentReaders = { listEventsForDateRange: async () => ({ status: "ok", data: { events: [], totalDocs: 0, hasNextPage: false } }) };',
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/app/(tabs)/today.tsx') && specifier in stubs) return { url: `native-today-test:${specifier}`, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('native-today-test:')) return { format: 'module', source: stubs[url.slice('native-today-test:'.length)]!, shortCircuit: true };
    if (url.endsWith('/app/(tabs)/today.tsx')) return { format: 'module', source: transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX } }).outputText, shortCircuit: true };
    return next(url, context);
  },
});
const { default: TodayRoute } = await import('../../app/(tabs)/today.tsx');

it('native Today derives view/page from the router and isolates query caches through Back', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-12T15:00:00Z') });
  harness.params = {};
  assert.equal(TodayRoute().props.view, 'today');
  const todayKey = harness.query.queryKey;
  harness.params = { view: 'upcoming', page: '2' };
  assert.equal(TodayRoute().props.page, 2);
  assert.deepEqual(harness.query.queryKey, ['events', 'upcoming', '2026-10-12', '2027-01-09', 2]);
  harness.params = {};
  TodayRoute();
  assert.deepEqual(harness.query.queryKey, todayKey);
  assert.equal(harness.query.placeholderData, undefined);
});

it('native Harlem date refreshes at midnight and resume; subscription cleanup removes both listeners', (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: Date.parse('2026-10-13T03:59:59Z') });
  harness.params = { view: 'upcoming' };
  assert.equal(TodayRoute().props.date, '2026-10-12');
  let changes = 0;
  const remove = harness.subscribe!(() => changes++);
  t.mock.timers.tick(30_000);
  assert.equal(changes, 1);
  assert.equal(TodayRoute().props.date, '2026-10-13');
  harness.onAppState!('background');
  assert.equal(changes, 1);
  harness.onAppState!('active');
  assert.equal(changes, 2);
  const prior = harness.removed;
  remove();
  assert.equal(harness.removed, prior + 1);
  t.mock.timers.tick(60_000);
  assert.equal(changes, 2);
});

it('native errors stay unavailable and retry refetches the current query without resetting its URL', () => {
  let retries = 0;
  harness.params = { view: 'upcoming', page: '2' };
  harness.result = { isError: true, isFetching: false, refetch: () => { retries++; } };
  const screen = TodayRoute();
  assert.deepEqual(screen.props.result, { status: 'unavailable' });
  assert.equal(screen.props.page, 2);
  screen.props.retryAction.props.onPress();
  assert.equal(retries, 1);
  harness.result = { data: undefined, isFetching: true };
  assert.equal(TodayRoute().props.retryAction.props.disabled, true);
});
