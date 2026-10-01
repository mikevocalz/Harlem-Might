'use client';

import { create } from 'zustand';
import type { LightCycleTurn } from './lightcycle/tabletopCore';

type TabletopSoloInputState = {
  turn: LightCycleTurn;
  turnSerial: number;
  boostHeld: boolean;
  queueTurn: (turn: Exclude<LightCycleTurn, 0>) => void;
  setBoost: (boostHeld: boolean) => void;
  reset: () => void;
};

export const useTabletopSoloInputStore = create<TabletopSoloInputState>((set) => ({
  turn: 0,
  turnSerial: 0,
  boostHeld: false,
  queueTurn: (turn) =>
    set((state) => ({ turn, turnSerial: state.turnSerial + 1 })),
  setBoost: (boostHeld) => set({ boostHeld }),
  reset: () => set({ turn: 0, boostHeld: false }),
}));

export const tabletopSoloInput = {
  getState: useTabletopSoloInputStore.getState,
  queueTurn: (turn: -1 | 1) =>
    useTabletopSoloInputStore.getState().queueTurn(turn),
  setBoost: (active: boolean) =>
    useTabletopSoloInputStore.getState().setBoost(active),
  reset: () => useTabletopSoloInputStore.getState().reset(),
};
