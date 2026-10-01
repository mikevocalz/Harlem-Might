'use client';

import type { LightCycleMatchState } from './lightcycle/tabletopCore';
import { useTabletopRaceStore } from './tabletopRaceStore';

/**
 * Renderer-neutral view of the current authoritative tabletop match.
 *
 * Viro owns the XR scene; Three/WebGPU owns its canvas. Both read the exact
 * same immutable match snapshot from this Zustand store instead of advancing
 * separate simulations.
 */
export function useTabletopRenderState(): LightCycleMatchState | null {
  return useTabletopRaceStore((state) => state.hostRenderState);
}

export function getTabletopRenderState(): LightCycleMatchState | null {
  return useTabletopRaceStore.getState().hostRenderState;
}
