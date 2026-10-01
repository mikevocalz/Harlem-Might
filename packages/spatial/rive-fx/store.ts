'use client';

import { create } from 'zustand';
import type { GridFxEvent, GridFxEventInput } from './types';

const HISTORY_LIMIT = 32;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
}

function mixSeed(serial: number) {
  let value = Math.imul(serial ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

type GridFxState = {
  serial: number;
  current: GridFxEvent | null;
  history: GridFxEvent[];
  emit: (input: GridFxEventInput) => GridFxEvent;
  clear: () => void;
};

export const useGridFxStore = create<GridFxState>((set, get) => ({
  serial: 0,
  current: null,
  history: [],

  emit: (input) => {
    const serial = get().serial + 1;
    const event: GridFxEvent = {
      serial,
      type: input.type,
      intensity: clamp01(input.intensity ?? 1),
      seed: input.seed ?? mixSeed(serial),
      playerColor: input.playerColor ?? '#00f3ff',
      opponentColor: input.opponentColor ?? '#ff7a00',
      impactAngle: input.impactAngle ?? 0,
      velocity: Math.max(0, input.velocity ?? 0),
      world: {
        x: input.world?.x ?? 0,
        y: input.world?.y ?? 0,
        z: input.world?.z ?? 0,
      },
      collisionCause: input.collisionCause ?? 'none',
      winner: input.winner ?? 'none',
      localPlayer: input.localPlayer ?? 'none',
      qualityTier: input.qualityTier ?? 'standard',
    };

    set((state) => ({
      serial,
      current: event,
      history: [...state.history, event].slice(-HISTORY_LIMIT),
    }));

    return event;
  },

  clear: () => set({ current: null }),
}));

export const gridFx = {
  getState: useGridFxStore.getState,
  emit: (input: GridFxEventInput) => useGridFxStore.getState().emit(input),
  clear: () => useGridFxStore.getState().clear(),
};
