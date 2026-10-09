import { create } from 'zustand';
import type { EnuPlacement } from '@mapbox/react-native-mapbox-ar-reactvision/src/enu.ts';
import type { NavPlacement, NavRouteFrame } from './navAr';

/**
 * The route frame and the world transform, always written together so a
 * reroute swaps geometry and placement in one update (no frame where the new
 * route sits under the old transform).
 */
export interface NavArWorld {
  readonly frame: NavRouteFrame;
  /** The solved transform the scene is moving toward. */
  readonly target: NavPlacement | undefined;
  /** The transform on screen this frame; slews toward `target`. */
  readonly displayed: EnuPlacement | undefined;
}

/** What ARCore Earth can do on this device, as far as the scene knows. */
export type GeospatialStatus = 'checking' | 'available' | 'unavailable';

/**
 * State the AR scene shares with the 2D HUD drawn over it. Navigation state
 * itself (phase, progress, positioning) stays in the shared navigation store.
 */
export interface NavArState {
  readonly world: NavArWorld | undefined;
  readonly geospatial: GeospatialStatus;
  /** Compass samples gathered toward the current calibration. */
  readonly compassSamples: number;
  /** Along-track distance of the matched position on the current frame. */
  readonly alongM: number | undefined;
  /** The safety notice was acknowledged in this AR visit. */
  readonly isAwarenessAcknowledged: boolean;
  setWorld(world: NavArWorld | undefined): void;
  setGeospatial(status: GeospatialStatus): void;
  setCompassSamples(count: number): void;
  setAlongM(alongM: number | undefined): void;
  acknowledgeAwareness(): void;
  /** Clears everything when the AR screen closes; the navigation session is untouched. */
  reset(): void;
}

const INITIAL = {
  world: undefined,
  geospatial: 'checking' as GeospatialStatus,
  compassSamples: 0,
  alongM: undefined,
  isAwarenessAcknowledged: false,
};

export const useNavAr = create<NavArState>()((set) => ({
  ...INITIAL,
  setWorld: (world) => set({ world }),
  setGeospatial: (geospatial) => set({ geospatial }),
  setCompassSamples: (compassSamples) => set({ compassSamples }),
  setAlongM: (alongM) => set({ alongM }),
  acknowledgeAwareness: () => set({ isAwarenessAcknowledged: true }),
  reset: () => set(INITIAL),
}));
