import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EMPTY_SEARCH,
  horizontalGesturesEnabled,
  resolveSearchBack,
  type PaneSearchState,
  type SearchablePane,
} from './pane-search.ts';
import { resolveBack } from './back-navigation.ts';
import type { SplitNavigableColumn } from './types';

const COLUMNS: readonly SplitNavigableColumn[] = ['primary', 'supplementary', 'secondary'];
const PANES: readonly SearchablePane[] = ['primary', 'supplementary'];

const search = (over: Partial<PaneSearchState> = {}): PaneSearchState => ({
  ...EMPTY_SEARCH,
  ...over,
});

describe('horizontalGesturesEnabled', () => {
  it('allows gestures when nothing is focused', () => {
    assert.equal(horizontalGesturesEnabled([]), true);
    assert.equal(horizontalGesturesEnabled([search(), search()]), true);
  });

  it('blocks them while any pane holds focus', () => {
    assert.equal(horizontalGesturesEnabled([search({ focused: true })]), false);
    assert.equal(horizontalGesturesEnabled([search(), search({ focused: true })]), false);
  });

  it('blocks on focus alone, not on having text', () => {
    // A typed-but-blurred field must not keep the drawer disabled.
    assert.equal(horizontalGesturesEnabled([search({ draft: 'ada', query: 'ada' })]), true);
    assert.equal(horizontalGesturesEnabled([search({ focused: true, draft: '' })]), false);
  });
});

describe('resolveSearchBack — search outranks navigation', () => {
  it('clears a non-empty query first, from any column', () => {
    for (const pane of PANES) {
      for (const activeColumn of COLUMNS) {
        const outcome = resolveSearchBack({
          searches: { [pane]: search({ focused: true, draft: 'gr', query: 'gr' }) },
          activeColumn,
          columnCount: 2,
          canGoBack: true,
        });
        assert.deepEqual(outcome, { kind: 'clearQuery', pane }, `${pane}/${activeColumn}`);
      }
    }
  });

  it('blurs on the second press, once the query is empty', () => {
    for (const pane of PANES) {
      const outcome = resolveSearchBack({
        searches: { [pane]: search({ focused: true }) },
        activeColumn: 'secondary',
        columnCount: 2,
        canGoBack: true,
      });
      assert.deepEqual(outcome, { kind: 'blurSearch', pane });
    }
  });

  it('takes two presses to leave a field with text in it', () => {
    const pane: SearchablePane = 'supplementary';
    const first = resolveSearchBack({
      searches: { [pane]: search({ focused: true, draft: 'ada', query: 'ada' }) },
      activeColumn: 'supplementary',
      columnCount: 2,
      canGoBack: false,
    });
    assert.equal(first.kind, 'clearQuery');

    // Applying that outcome empties the draft; focus is deliberately kept.
    const second = resolveSearchBack({
      searches: { [pane]: search({ focused: true, draft: '', query: '' }) },
      activeColumn: 'supplementary',
      columnCount: 2,
      canGoBack: false,
    });
    assert.equal(second.kind, 'blurSearch');
  });

  it('clears on the draft, not the debounced query', () => {
    // Back pressed before the debounce settles still has to clear the field.
    const outcome = resolveSearchBack({
      searches: { primary: search({ focused: true, draft: 'ad', query: '' }) },
      activeColumn: 'primary',
      columnCount: 2,
      canGoBack: false,
    });
    assert.deepEqual(outcome, { kind: 'clearQuery', pane: 'primary' });
  });
});

describe('resolveSearchBack — falls through to the column policy', () => {
  it('matches resolveBack exactly when no field is focused', () => {
    for (const activeColumn of COLUMNS) {
      for (const columnCount of [1, 2] as const) {
        for (const canGoBack of [true, false]) {
          const params = { activeColumn, columnCount, canGoBack };
          assert.deepEqual(
            resolveSearchBack({ searches: {}, ...params }),
            resolveBack(params),
            `${activeColumn}/${columnCount}/${canGoBack}`,
          );
        }
      }
    }
  });

  it('ignores a field that has text but no focus', () => {
    const params = { activeColumn: 'secondary' as const, columnCount: 2 as const, canGoBack: true };
    assert.deepEqual(
      resolveSearchBack({ searches: { primary: search({ draft: 'ada', query: 'ada' }) }, ...params }),
      resolveBack(params),
    );
  });

  it('never returns a search outcome when nothing is focused', () => {
    for (const activeColumn of COLUMNS) {
      const outcome = resolveSearchBack({
        searches: { primary: search({ draft: 'x' }), supplementary: search({ query: 'y' }) },
        activeColumn,
        columnCount: 2,
        canGoBack: false,
      });
      assert.ok(outcome.kind !== 'clearQuery' && outcome.kind !== 'blurSearch');
    }
  });
});
