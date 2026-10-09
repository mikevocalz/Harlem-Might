import type { ArMode, ArModeRequest } from '@viro-external/xr-contract';
import { create } from 'zustand';
import type { ModeDegradedEvent } from './arMode.ts';
import { snapTurn as nextHeading, type EnuGround } from './streetScene.ts';
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
 * Which scene a request opens on a headset. `street` is the 1:1 VR scene
 * (HarlemStreetScene, decision S19); every other request opens the tabletop.
 * Phones resolve `street` through ARCore Geospatial instead (`resolveArMode`).
 */
export type ArSceneMode = 'tabletop' | 'street';

export function sceneModeFor(requested: { readonly mode: ArModeRequest } | null | undefined): ArSceneMode {
  return requested?.mode === 'street' ? 'street' : 'tabletop';
}

/** Where the wearer stands in the street scene and which way the world faces. */
export interface ArStreetPose {
  /** Ground point under the scene origin, in ENU metres from the place. */
  readonly user: EnuGround;
  /** Snap-turn heading in [0, 360). */
  readonly headingDeg: number;
}

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
  /** Street scene pose; reset to the place itself on every request. */
  readonly street: ArStreetPose;
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
  /**
   * Moves the wearer to a ground point (already clamped by the scene), and
   * turns the world to `headingDeg` when given.
   * @throws {RangeError} When a coordinate or the heading is not finite.
   */
  teleport: (to: EnuGround, headingDeg?: number) => void;
  /** One 45 degree snap turn. */
  snapTurn: (direction: 'left' | 'right') => void;
  reset: () => void;
}

/**
 * Where the street scene starts: 4 m south of the place, facing north, so its
 * pillar stands in front of the wearer instead of around their head.
 */
export const STREET_START: EnuGround = { eastM: 0, northM: -4 };

const INITIAL = {
  requested: null,
  resolved: null,
  degraded: [],
  placement: null,
  route: { status: 'idle' },
  playheadM: 0,
  street: { user: STREET_START, headingDeg: 0 },
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
  teleport: (to, headingDeg) => {
    if (!Number.isFinite(to.eastM) || !Number.isFinite(to.northM)) {
      throw new RangeError('teleport target must be finite');
    }
    if (headingDeg !== undefined && !Number.isFinite(headingDeg)) {
      throw new RangeError('headingDeg must be finite');
    }
    set((s) => ({
      street: {
        user: { eastM: to.eastM, northM: to.northM },
        headingDeg: headingDeg === undefined ? s.street.headingDeg : ((headingDeg % 360) + 360) % 360,
      },
    }));
  },
  snapTurn: (direction) =>
    set((s) => ({ street: { ...s.street, headingDeg: nextHeading(s.street.headingDeg, direction) } })),
  reset: () => set(INITIAL),
}));
