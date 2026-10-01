'use client';
import { create } from 'zustand';
import { EMPTY_SEARCH, type PaneSearchState, type SearchablePane } from './pane-search.ts';

interface PaneSearchStore {
  /** One slice per pane. A pane with no entry has never been searched. */
  panes: Partial<Record<SearchablePane, PaneSearchState>>;
  /** Every keystroke. Never debounced — the field must echo instantly. */
  setDraft: (pane: SearchablePane, draft: string) => void;
  /** The debounced value consumers filter on. */
  setQuery: (pane: SearchablePane, query: string) => void;
  setFocused: (pane: SearchablePane, focused: boolean) => void;
  /** Empty both draft and query, keeping focus — the first Back press. */
  clear: (pane: SearchablePane) => void;
}

/**
 * Search state, one slice per pane.
 *
 * Per-pane rather than a single global pair of values: two panes can host a
 * field, and a global query would leak one pane's filter into the other's list
 * the moment both were visible — which at expanded widths is the normal case.
 *
 * It also lives outside the components so a pane can collapse to zero width and
 * come back with its query and focus intact; the panes stay mounted, but the
 * state does not depend on that.
 */
export const usePaneSearchStore = create<PaneSearchStore>((set, get) => ({
  panes: {},

  setDraft: (pane, draft) =>
    set({ panes: { ...get().panes, [pane]: { ...(get().panes[pane] ?? EMPTY_SEARCH), draft } } }),

  setQuery: (pane, query) =>
    set({ panes: { ...get().panes, [pane]: { ...(get().panes[pane] ?? EMPTY_SEARCH), query } } }),

  setFocused: (pane, focused) =>
    set({
      panes: {
        ...get().panes,
        [pane]: { ...(get().panes[pane] ?? EMPTY_SEARCH), focused },
      },
    }),

  clear: (pane) =>
    set({
      panes: {
        ...get().panes,
        [pane]: { ...(get().panes[pane] ?? EMPTY_SEARCH), draft: '', query: '' },
      },
    }),
}));

/** Read one pane's slice. Panes never searched read as empty, not undefined. */
export function usePaneSearch(pane: SearchablePane): PaneSearchState {
  return usePaneSearchStore((state) => state.panes[pane] ?? EMPTY_SEARCH);
}
