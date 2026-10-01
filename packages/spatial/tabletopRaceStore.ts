'use client';

import { create } from 'zustand';
import type { LightCycleMatchState } from './lightcycle/tabletopCore';

type TabletopRaceState = {
  hostRenderState: LightCycleMatchState | null;
  setHostRenderState: (state: LightCycleMatchState | null) => void;
  reset: () => void;
};

export const useTabletopRaceStore = create<TabletopRaceState>((set) => ({
  hostRenderState: null,
  setHostRenderState: (hostRenderState) => set({ hostRenderState }),
  reset: () => set({ hostRenderState: null }),
}));

export const tabletopRace = {
  getState: useTabletopRaceStore.getState,
  setHostRenderState: (state: LightCycleMatchState | null) =>
    useTabletopRaceStore.getState().setHostRenderState(state),
  reset: () => useTabletopRaceStore.getState().reset(),
};
