import { resolveBack, type BackOutcome } from './back-navigation.ts';
import type { SplitNavigableColumn } from './types';

/** Panes that can host a search field. The detail pane searches its own content. */
export type SearchablePane = 'primary' | 'supplementary';

export interface PaneSearchState {
  /** What the field shows. Echoes every keystroke, never debounced. */
  readonly draft: string;
  /** The debounced value consumers filter on. */
  readonly query: string;
  readonly focused: boolean;
}

export const EMPTY_SEARCH: PaneSearchState = { draft: '', query: '', focused: false };

/**
 * Whether a horizontal gesture may run.
 *
 * A focused search field competes directly with the drawer swipe and the pane
 * collapse swipe: both start with a horizontal drag near the screen edge, which
 * is also how you move the caret or select text. Generalised from the
 * reference's `use-drawer-enabled`, which disabled the drawer whenever its
 * search input held focus.
 */
export function horizontalGesturesEnabled(searches: readonly PaneSearchState[]): boolean {
  return !searches.some((search) => search.focused);
}

export type SearchBackOutcome =
  /** Empty the query but keep the keyboard up — the user is still searching. */
  | { kind: 'clearQuery'; pane: SearchablePane }
  /** Dismiss the keyboard, leaving the (empty) field in place. */
  | { kind: 'blurSearch'; pane: SearchablePane }
  | BackOutcome;

/**
 * Back policy, search included.
 *
 * PRIORITY ORDER, highest first:
 *
 *   1. Focused search with a non-empty query -> clear the query.
 *   2. Focused search with an empty query    -> blur it.
 *   3. Detail pane showing with a poppable stack -> defer to the navigator.
 *   4. Collapsed split view not on the leading column -> step back one column.
 *   5. Nothing left -> fall through to the system.
 *
 * 1 and 2 outrank everything because the keyboard is the most recent thing the
 * user opened, and Back's job is to undo the most recent thing. Splitting them
 * into two presses means a mis-typed query costs one press to fix instead of
 * forcing the user out of the field and back into it. 3 through 5 are the
 * existing column policy, unchanged — search is layered on top of it rather
 * than replacing it.
 *
 * Only ONE pane can be focused at a time (a field takes focus from the other),
 * so the focused pane is searched for rather than passed in.
 */
export function resolveSearchBack(params: {
  searches: Partial<Record<SearchablePane, PaneSearchState>>;
  activeColumn: SplitNavigableColumn;
  columnCount: 1 | 2;
  canGoBack: boolean;
}): SearchBackOutcome {
  const { searches, ...columnParams } = params;

  const focused = (['primary', 'supplementary'] as const).find(
    (pane) => searches[pane]?.focused,
  );

  if (focused) {
    const state = searches[focused] ?? EMPTY_SEARCH;
    // The DRAFT decides, not the debounced query: a user who has typed and hit
    // Back before the debounce settles still expects the field cleared.
    return state.draft.length > 0
      ? { kind: 'clearQuery', pane: focused }
      : { kind: 'blurSearch', pane: focused };
  }

  return resolveBack(columnParams);
}
