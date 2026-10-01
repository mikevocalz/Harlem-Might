'use client';
import { create } from 'zustand';
import { clampPrimaryWidth } from './resize.ts';
import { COLUMN_RANK } from './constants.ts';
import type { SplitNavigableColumn } from './types';

/**
 * Which column is on top when the split view is collapsed.
 *
 * Module-level rather than per-instance because the split view is a singleton
 * by construction — expo-router throws 'There can only be one SplitView in the
 * navigation hierarchy.' on a nested mount, and the Android implementation
 * mirrors that guard.
 *
 * Store state rather than component state so it survives the remount a
 * configuration change can trigger (rotation, fold, multi-window resize):
 * compact -> expanded -> compact returns to the same column.
 *
 * `null` means "not yet navigated", so the component can fall back to the
 * `topColumnForCollapsing` prop without writing to the store during render.
 */
interface SplitViewState {
  column: SplitNavigableColumn | null;
  setColumn: (column: SplitNavigableColumn) => void;
  /** Travel direction of the last column change, for the pane transition. */
  direction: 'forward' | 'back';
  /** User-resized primary width in dp; null keeps the token width. */
  primaryWidth: number | null;
  setPrimaryWidth: (width: number) => void;
  resetPrimaryWidth: () => void;
}

export const useSplitViewStore = create<SplitViewState>((set) => ({
  column: null,
  direction: 'forward',
  setColumn: (column) =>
    set((state) => ({
      column,
      direction: COLUMN_RANK[column] >= COLUMN_RANK[state.column ?? 'primary'] ? 'forward' : 'back',
    })),

  primaryWidth: null,
  setPrimaryWidth: (width) => set({ primaryWidth: clampPrimaryWidth(width) }),
  resetPrimaryWidth: () => set({ primaryWidth: null }),
}));
