import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { it } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { eventQuery, eventSearch } from '@acme/app/features/site/today/event-query.ts';
import type { ContentReaders } from '@acme/app/content';
import { routes } from '../../../../packages/ui/mights/routes.ts';

// Metro aliases navigation to Expo's vendored implementation. Exercise those
// installed pure modules, not the separately installed @react-navigation router.
// This is router/parser/cache coverage, not a mounted or physical-device test.
const require = createRequire(import.meta.url);
const expoRoot = dirname(require.resolve('expo-router/package.json'));
const { TabRouter } = require(join(expoRoot, 'build/react-navigation/routers/TabRouter.js')) as typeof import('expo-router/build/react-navigation/routers/TabRouter.js');
const { navigate, goBack } = require(join(expoRoot, 'build/react-navigation/routers/CommonActions.js')) as typeof import('expo-router/build/react-navigation/routers/CommonActions.js');
const { getStateFromPath } = require(join(expoRoot, 'build/fork/getStateFromPath.js')) as typeof import('expo-router/build/fork/getStateFromPath.js');

type Router = ReturnType<typeof TabRouter>;
type State = Parameters<Router['getStateForAction']>[0];
type Action = Parameters<Router['getStateForAction']>[1];
const date = '2026-10-12';
const routeNames = ['explore', 'walks', 'stories', 'music', 'today', '(more)'];

function tabNavigation() {
  // Same initial route and default Back policy as app/(tabs)/_layout.tsx.
  const router = TabRouter({ initialRouteName: 'explore' });
  let state: State = {
    stale: false, type: 'tab', key: 'tabs', routeKeySeq: routeNames.length,
    index: 0, routeNames,
    routes: routeNames.map((name) => ({ name, key: name })),
  };
  const focused = () => state.routes[state.index]!;
  return {
    state: () => state,
    focused,
    dispatch(action: Action) {
      const result = router.getStateForAction(state, action, { routeNames, routeGetIdList: {} });
      assert.ok(result, `TabRouter did not handle ${action.type}`);
      state = result.state;
      return focused();
    },
  };
}

it('native tab Back returns to Explore; returning Today retains Upcoming page 2 and its cache', async () => {
  const tabs = tabNavigation();
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: Infinity, retry: false } } });
  const calls: unknown[][] = [];
  const readers: Pick<ContentReaders, 'listEventsForDateRange'> = {
    listEventsForDateRange: async (...args) => {
      calls.push(args);
      return { status: 'ok', data: { events: [], hasNextPage: false, totalDocs: 0 } };
    },
  };
  const query = () => eventQuery(readers, date, eventSearch(tabs.focused().params ?? {}));
  try {
    tabs.dispatch(navigate('today'));
    const today = query();
    await client.fetchQuery(today);
    tabs.dispatch(navigate('today', { view: 'upcoming' }));
    const upcoming = query();
    await client.fetchQuery(upcoming);
    tabs.dispatch(navigate('today', { view: 'upcoming', page: '2' }));
    const second = query();
    const cachedSecond = await client.fetchQuery(second);

    assert.equal(new Set([today, upcoming, second].map(({ queryKey }) => JSON.stringify(queryKey))).size, 3);
    assert.deepEqual(tabs.state().history, [{ type: 'route', key: 'explore' }, { type: 'route', key: 'today' }]);
    tabs.dispatch(goBack());
    assert.equal(tabs.focused().name, 'explore');
    const retainedToday = tabs.state().routes.find(({ name }) => name === 'today')!;
    assert.deepEqual(retainedToday.params, { view: 'upcoming', page: '2' });
    assert.strictEqual(client.getQueryData(second.queryKey), cachedSecond);

    // AppTabBar passes route.key to navigateToTab; Expo's bottom-tab adapter
    // resolves that route and forwards exactly navigate(route.name, route.params).
    tabs.dispatch(navigate(retainedToday.name, retainedToday.params));
    assert.equal(tabs.focused().name, 'today');
    assert.deepEqual(query().queryKey, second.queryKey);
    assert.strictEqual(await client.fetchQuery(query()), cachedSecond);
    assert.equal(calls.length, 3, 'Returning to the tab reuses the still-fresh page cache');

    // A fresh bare Today link is a different intent from selecting the tab.
    tabs.dispatch(navigate('today'));
    assert.deepEqual(eventSearch(tabs.focused().params ?? {}), { view: 'today', page: 1 });
    assert.deepEqual(query().queryKey, today.queryKey);
  } finally {
    client.clear();
  }
});

const linking = {
  initialRouteName: '(tabs)',
  screens: {
    '(tabs)': {
      path: '', initialRouteName: 'explore',
      screens: { explore: 'explore', walks: 'walks', stories: 'stories', music: 'music', today: 'today', '(more)': 'more' },
    },
  },
};

it('real Expo deep-link parsing feeds safe event query normalization, including repeated values', () => {
  const tabs = tabNavigation();
  const cases = [
    ['/today', '/today'],
    ['/today?view=upcoming&page=2', '/today?view=upcoming&page=2'],
    ['/today?view=upcoming&page=1', '/today?view=upcoming'],
    ['/today?view=unknown&page=-1', '/today'],
    ['/today?view=upcoming&page=10001', '/today?view=upcoming'],
    ['/today?view=upcoming&page=1.5', '/today?view=upcoming'],
    ['/today?view=upcoming&page=9007199254740993', '/today?view=upcoming'],
    ['/today?view=upcoming&view=today&page=2&page=3', '/today'],
    ['/today?view=%3Cscript%3E&page=NaN', '/today'],
  ] as const;
  for (const [path, normalizedPath] of cases) {
    const parsed = getStateFromPath(path, linking);
    assert.ok(parsed, path);
    let leaf = parsed.routes[parsed.index ?? parsed.routes.length - 1]!;
    while (leaf.state) leaf = leaf.state.routes[leaf.state.index ?? leaf.state.routes.length - 1]!;
    assert.equal(leaf.name, 'today');
    if (path.includes('&view=today')) {
      assert.deepEqual(leaf.params, { view: ['upcoming', 'today'], page: ['2', '3'] });
    }
    const search = eventSearch(leaf.params ?? {});
    assert.equal(routes.today(search), normalizedPath);
    tabs.dispatch(navigate(leaf.name, leaf.params));
    assert.deepEqual(eventSearch(tabs.focused().params ?? {}), search);
  }
  // Normalization governs the read/UI; this does not assert the OS URL was rewritten.
});
