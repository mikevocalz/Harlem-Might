import { create } from 'zustand';
import type { TravelMode } from '../model/route.ts';
import type { LocationAvailability } from './locationSource.ts';

/** Where the person wants the route to start, before the session has an origin. */
export type OriginChoice = { readonly kind: 'device' } | { readonly kind: 'place'; readonly placeId: string };

/**
 * Screen state around the navigation session: choices made before a route
 * is requested and what the chrome shows. The session itself (route, phase,
 * progress) lives only in `useNavigationStore`; nothing here duplicates it,
 * so map, sheet, HUD and AR never disagree about the trip.
 */
export interface NavigationUiState {
  /**
   * The place whose directions panel is open, before a route request gives
   * the session a destination. Once the session has one, the session wins.
   */
  readonly directionsPlaceId: string | null;
  /** Travel mode picked in the directions panel. */
  readonly mode: TravelMode;
  readonly originChoice: OriginChoice;
  /** Device location state, written by the navigation runtime. */
  readonly location: LocationAvailability;
  /** `false` when the platform reports no network, `undefined` when it cannot tell. */
  readonly online: boolean | undefined;
  /** The awareness notice was read and dismissed for this trip. */
  readonly awarenessAcknowledged: boolean;
  /** The map camera follows the position. Panning turns it off; Recenter turns it back on. */
  readonly followUser: boolean;
  /** The full step list is open over the map during guidance (phones). */
  readonly stepsOpen: boolean;
  /** The "Start from a place" list is open in the directions panel. */
  readonly originPickerOpen: boolean;
  openDirections(placeId: string): void;
  closeDirections(): void;
  setMode(mode: TravelMode): void;
  setOriginChoice(choice: OriginChoice): void;
  setLocation(location: LocationAvailability): void;
  setOnline(online: boolean | undefined): void;
  acknowledgeAwareness(): void;
  setFollowUser(follow: boolean): void;
  setStepsOpen(open: boolean): void;
  setOriginPickerOpen(open: boolean): void;
  /** Back to defaults for a new trip. Keeps `location` and `online`, which describe the device. */
  resetTrip(): void;
}

const TRIP_DEFAULTS = {
  directionsPlaceId: null,
  mode: 'walking',
  originChoice: { kind: 'device' },
  awarenessAcknowledged: false,
  followUser: true,
  stepsOpen: false,
  originPickerOpen: false,
} as const satisfies Partial<NavigationUiState>;

export const useNavigationUi = create<NavigationUiState>()((set) => ({
  ...TRIP_DEFAULTS,
  location: 'unknown',
  online: undefined,
  openDirections: (directionsPlaceId) => set({ directionsPlaceId }),
  closeDirections: () => set({ directionsPlaceId: null }),
  setMode: (mode) => set({ mode }),
  setOriginChoice: (originChoice) => set({ originChoice }),
  setLocation: (location) => set({ location }),
  setOnline: (online) => set({ online }),
  acknowledgeAwareness: () => set({ awarenessAcknowledged: true }),
  setFollowUser: (followUser) => set({ followUser }),
  setStepsOpen: (stepsOpen) => set({ stepsOpen }),
  setOriginPickerOpen: (originPickerOpen) => set({ originPickerOpen }),
  resetTrip: () => set(TRIP_DEFAULTS),
}));
