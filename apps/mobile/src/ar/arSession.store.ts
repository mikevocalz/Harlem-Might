import type { ArMode, ArModeRequest } from '@viro-external/xr-contract';
import { create } from 'zustand';
import type { ModeDegradedEvent } from './arMode.ts';
import type { WalkingRoute } from './walkingRoute.ts';

/** The plane the diorama was placed on. */
export interface ArPlacement {
  readonly anchorId: string;
  /** Room-model label: `Table` or `Floor` on Quest. */
  readonly surface: string;
  readonly widthM: number;
  readonly depthM: number;
}

/** The route as the scene sees it while the map layer fetches it. */
export type ArRouteState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly route: WalkingRoute };

/**
 * One AR session: what was asked for, what resolved, the route and the
 * playhead. Selection stays in `useExplore`, which the 2D panel and the
 * immersive scene share (one JS runtime on Quest).
 */
export interface ArSessionState {
  readonly requested: { readonly mode: ArModeRequest; readonly placeId: string } | null;
  readonly resolved: ArMode | null;
  readonly degraded: readonly ModeDegradedEvent[];
  readonly placement: ArPlacement | null;
  readonly route: ArRouteState;
  /** Metres along the projected route, in world metres (not table metres). */
  readonly playheadM: number;
  /** Starts a session for a place; clears the previous one. */
  request: (requested: { mode: ArModeRequest; placeId: string }) => void;
  resolve: (mode: ArMode, degraded: readonly ModeDegradedEvent[]) => void;
  place: (placement: ArPlacement | null) => void;
  setRouteLoading: () => void;
  /** Sets the route and moves the playhead back to its start. */
  setRoute: (route: WalkingRoute) => void;
  /**
   * Moves the playhead. Negative values clamp to 0; the scene clamps the far
   * end to the route length.
   * @throws {RangeError} When `distanceM` is not finite.
   */
  setPlayheadM: (distanceM: number) => void;
  reset: () => void;
}

const INITIAL = {
  requested: null,
  resolved: null,
  degraded: [],
  placement: null,
  route: { status: 'idle' },
  playheadM: 0,
} as const satisfies Partial<ArSessionState>;

export const useArSession = create<ArSessionState>((set) => ({
  ...INITIAL,
  request: (requested) => set({ ...INITIAL, requested }),
  resolve: (resolved, degraded) => set({ resolved, degraded }),
  place: (placement) => set({ placement }),
  setRouteLoading: () => set({ route: { status: 'loading' } }),
  setRoute: (route) => set({ route: { status: 'ready', route }, playheadM: 0 }),
  setPlayheadM: (distanceM) => {
    if (!Number.isFinite(distanceM)) throw new RangeError('distanceM must be finite');
    set({ playheadM: Math.max(0, distanceM) });
  },
  reset: () => set(INITIAL),
}));
