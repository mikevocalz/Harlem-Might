'use client';

import { create } from 'zustand';
import type {
  LightCycleInputEvent,
  LightCycleMatchState,
  LightCyclePlayerId,
} from '../tabletopCore.ts';
import { LightCycleInputQueue } from '../sessionProtocol.ts';

/** One room owns simulation, input history and rendering, even if AR relocalizes. */
export type TabletopRoomRuntime = {
  roomId: string;
  hostState: LightCycleMatchState | null;
  queue: LightCycleInputQueue;
  seenSequence: Record<LightCyclePlayerId, number>;
  boostHeld: Record<LightCyclePlayerId, boolean>;
  localSequence: number;
  localHistory: LightCycleInputEvent[];
  lastDerezFxRound: number;
  lastDerezFxTick: number;
};

type TabletopRaceState = {
  roomRuntime: TabletopRoomRuntime | null;
  hostRenderState: LightCycleMatchState | null;
  enterRoom: (roomId: string) => TabletopRoomRuntime;
  leaveRoom: (runtime: TabletopRoomRuntime) => void;
  setRoomRenderState: (runtime: TabletopRoomRuntime, state: LightCycleMatchState) => void;
  setHostRenderState: (state: LightCycleMatchState | null) => void;
  reset: () => void;
};

export const useTabletopRaceStore = create<TabletopRaceState>((set, get) => ({
  roomRuntime: null,
  hostRenderState: null,
  enterRoom: (roomId) => {
    const current = get().roomRuntime;
    if (current?.roomId === roomId) return current;
    const runtime: TabletopRoomRuntime = {
      roomId,
      hostState: null,
      queue: new LightCycleInputQueue(),
      seenSequence: { p1: -1, p2: -1 },
      boostHeld: { p1: false, p2: false },
      localSequence: 0,
      localHistory: [],
      lastDerezFxRound: -1,
      lastDerezFxTick: -1,
    };
    set({ roomRuntime: runtime, hostRenderState: null });
    return runtime;
  },
  leaveRoom: (runtime) => {
    if (get().roomRuntime === runtime) {
      set({ roomRuntime: null, hostRenderState: null });
    }
  },
  setRoomRenderState: (runtime, hostRenderState) => {
    if (get().roomRuntime === runtime) set({ hostRenderState });
  },
  // Solo drivers retain the existing renderer-neutral snapshot API.
  setHostRenderState: (hostRenderState) => set({ hostRenderState }),
  reset: () => set({ roomRuntime: null, hostRenderState: null }),
}));

export const tabletopRace = {
  getState: useTabletopRaceStore.getState,
  enterRoom: (roomId: string) => useTabletopRaceStore.getState().enterRoom(roomId),
  leaveRoom: (runtime: TabletopRoomRuntime) =>
    useTabletopRaceStore.getState().leaveRoom(runtime),
  setRoomRenderState: (runtime: TabletopRoomRuntime, state: LightCycleMatchState) =>
    useTabletopRaceStore.getState().setRoomRenderState(runtime, state),
  setHostRenderState: (state: LightCycleMatchState | null) =>
    useTabletopRaceStore.getState().setHostRenderState(state),
  reset: () => useTabletopRaceStore.getState().reset(),
};
