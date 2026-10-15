import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, it } from 'node:test';
import { ModuleKind, transpileModule } from 'typescript';
import { DEFAULT_SHEET_DETENT, useExplore } from '@acme/app/features/explore/explore.store.ts';
import { exploreHref } from './explore-url.ts';

type Actions = {
  params: URLSearchParams;
  replace(patch: Record<string, string | null>): void;
  select(id: string, opener: string): void;
  close(): void;
  commitQuery(text: string): void;
};
const initialStore = useExplore.getState();
afterEach(() => useExplore.setState(initialStore));

// Run the real hook callbacks with independent, intentionally stale Solito
// render snapshots. History writes update the live browser URL synchronously.
function fixture(search = '') {
  const entries = [new URL(`/explore${search}`, 'https://harlem.invalid')];
  let index = 0;
  const browser = {
    get location() { return entries[index]!; },
    history: {
      replaceState(_state: unknown, _title: string, href: string) {
        entries[index] = new URL(href, browser.location);
      },
      pushState(_state: unknown, _title: string, href: string) {
        entries.splice(index + 1, Infinity, new URL(href, browser.location));
        index++;
      },
      back() { if (index > 0) index--; },
      forward() { if (index < entries.length - 1) index++; },
    },
  };
  const modules: Record<string, unknown> = {
    'solito/navigation': {
      usePathname: () => browser.location.pathname,
      useSearchParams: () => new URLSearchParams(browser.location.search),
      useRouter: () => ({ back: browser.history.back }),
    },
    '@acme/app/features/explore/explore.store.ts': { DEFAULT_SHEET_DETENT, useExplore },
    '@acme/ui/mights': { routes: { explore: () => '/explore' } },
    './explore-url': { exploreHref },
  };
  const compiled = transpileModule(readFileSync(new URL('./explore-actions.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS },
  }).outputText;
  const exports: { useExploreActions?: () => Actions } = {};
  new Function('require', 'exports', 'window', compiled)((id: string) => {
    assert.ok(id in modules, `Unexpected Explore import ${id}`);
    return modules[id];
  }, exports, browser);
  return { browser, actions: () => exports.useExploreActions!(), read: () => browser.location.searchParams };
}

describe('Explore URL mutations', () => {
  it('rebases a delayed query on category and place selections made before its timer fires', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const f = fixture('?view=list');
    const master = f.actions();
    const map = f.actions();
    setTimeout(() => master.commitQuery('Apollo'), 250);
    master.replace({ category: 'Culture' });
    map.select('apollo-theater', 'marker:apollo-theater');
    t.mock.timers.tick(250);
    assert.equal(f.read().get('q'), 'Apollo');
    assert.equal(f.read().get('category'), 'Culture');
    assert.equal(f.read().get('place'), 'apollo-theater');
    assert.equal(f.read().get('view'), 'list');
    // Mutation rebasing does not silently change the hook's rendering snapshot.
    assert.equal(master.params.get('category'), null);
  });

  it('does not restore a place that was closed while the query was pending', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const f = fixture('?place=apollo-theater&category=Culture');
    const master = f.actions();
    const sheet = f.actions();
    setTimeout(() => master.commitQuery('museum'), 250);
    sheet.close();
    t.mock.timers.tick(250);
    assert.equal(f.read().get('place'), null);
    assert.equal(f.read().get('category'), 'Culture');
    assert.equal(f.read().get('q'), 'museum');
  });

  it('composes successive writers and removes only the explicitly cleared fields', () => {
    const f = fixture('?q=old&view=map&campaign=walk');
    const first = f.actions();
    const second = f.actions();
    first.replace({ category: 'Food' });
    second.commitQuery('new');
    first.select('new-cafe', 'row:new-cafe');
    second.replace({ view: 'list' });
    first.commitQuery('');
    assert.deepEqual(Object.fromEntries(f.read()), {
      view: 'list', campaign: 'walk', category: 'Food', place: 'new-cafe',
    });
  });

  it('keeps pushed selection history navigable after a delayed query commits', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const f = fixture('?view=list');
    const master = f.actions();
    setTimeout(() => master.commitQuery('jazz'), 250);
    master.select('jazz-club', 'row:jazz-club');
    t.mock.timers.tick(250);
    const selectedUrl = f.browser.location.href;
    f.actions().close();
    assert.equal(f.read().get('place'), null);
    f.browser.history.forward();
    assert.equal(f.browser.location.href, selectedUrl);
    assert.equal(f.read().get('place'), 'jazz-club');
    assert.equal(f.read().get('q'), 'jazz');
  });
});
