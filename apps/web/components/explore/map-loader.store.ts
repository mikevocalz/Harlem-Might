import { create } from 'zustand';

/**
 * The map-loading overlay's own phase, separate from `mapStatus` (which the
 * map owns): `mapStatus` says what the GL map is doing, this store says
 * what the loader is allowed to show. Entering is delayed by CSS
 * (`hm-suspense-in`, 250 ms) and exiting is held to a minimum visible time
 * so a fast map never flashes the loader and a slow one exits cleanly.
 */

const MIN_SHOW_MS = 700;
const EXIT_MS = 450;

type OverlayPhase = 'hidden' | 'loading' | 'complete';

interface MapLoaderState {
  phase: OverlayPhase;
  enter: () => void;
  complete: () => void;
  fail: () => void;
}

let shownAt = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useMapLoader = create<MapLoaderState>((set, get) => ({
  phase: 'hidden',
  enter: () => {
    if (get().phase !== 'hidden') return;
    shownAt = Date.now();
    set({ phase: 'loading' });
  },
  complete: () => {
    // Never shown → nothing to choreograph; fast loads stay silent.
    if (get().phase === 'hidden') return;
    const remaining = Math.max(0, shownAt + MIN_SHOW_MS - Date.now());
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      set({ phase: 'complete' });
      hideTimer = setTimeout(() => {
        hideTimer = null;
        set({ phase: 'hidden' });
      }, EXIT_MS);
    }, remaining);
  },
  fail: () => {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    set({ phase: 'hidden' });
  },
}));
