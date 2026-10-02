'use client';

import { create } from 'zustand';
import type { WindowSizeClass } from './constants';
import {
  clearPaneOverrides,
  togglePaneOverride,
  type PaneOverrides,
  type TogglablePane,
} from './pane-overrides';

const STORAGE_KEY = 'hm-split-view-pane-overrides';

function readOverrides(): PaneOverrides {
  if (typeof localStorage === 'undefined') return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as PaneOverrides;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

interface PaneOverrideState {
  overrides: PaneOverrides;
  toggle: (sizeClass: WindowSizeClass, pane: TogglablePane, visible: boolean) => void;
  reset: (sizeClass: WindowSizeClass) => void;
}

export const usePaneOverrideStore = create<PaneOverrideState>((set, get) => ({
  overrides: readOverrides(),

  toggle: (sizeClass, pane, visible) => {
    const overrides = togglePaneOverride(get().overrides, sizeClass, pane, visible);
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(overrides));
    set({ overrides });
  },

  reset: (sizeClass) => {
    const overrides = clearPaneOverrides(get().overrides, sizeClass);
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(overrides));
    set({ overrides });
  },
}));
