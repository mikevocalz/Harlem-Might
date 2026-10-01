'use client';
import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import type { WindowSizeClass } from './constants.ts';
import {
  clearPaneOverrides,
  togglePaneOverride,
  type PaneOverrides,
  type TogglablePane,
} from './pane-overrides.ts';

/**
 * WHERE OVERRIDES PERSIST: MMKV, instance id `split-view`, key `pane-overrides`,
 * as a JSON blob of the size-class-keyed map.
 *
 * MMKV rather than a React state hook because the layout a user chose has to
 * survive a process death, and MMKV's reads are synchronous — the first render
 * already knows the answer, so no pane flashes open and then closes once an
 * async read resolves.
 */
// v4 replaced the `new MMKV()` constructor with this factory; `MMKV` is a
// type-only export now.
const storage = createMMKV({ id: 'split-view' });
const STORAGE_KEY = 'pane-overrides';

function readOverrides(): PaneOverrides {
  const raw = storage.getString(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PaneOverrides;
  } catch {
    // A malformed blob means a partial write or a shape change across versions.
    // Automatic behaviour is always a safe layout, so drop it rather than
    // leaving the user with panes that will not open.
    storage.remove(STORAGE_KEY);
    return {};
  }
}

interface PaneOverrideState {
  overrides: PaneOverrides;
  /** Toggle one pane for one size class. `visible` is what is on screen NOW. */
  toggle: (sizeClass: WindowSizeClass, pane: TogglablePane, visible: boolean) => void;
  /** Return one size class to automatic behaviour. */
  reset: (sizeClass: WindowSizeClass) => void;
}

export const usePaneOverrideStore = create<PaneOverrideState>((set, get) => ({
  overrides: readOverrides(),

  toggle: (sizeClass, pane, visible) => {
    const overrides = togglePaneOverride(get().overrides, sizeClass, pane, visible);
    storage.set(STORAGE_KEY, JSON.stringify(overrides));
    set({ overrides });
  },

  reset: (sizeClass) => {
    const overrides = clearPaneOverrides(get().overrides, sizeClass);
    storage.set(STORAGE_KEY, JSON.stringify(overrides));
    set({ overrides });
  },
}));
