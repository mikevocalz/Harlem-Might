import { create } from 'zustand';

/**
 * - `off`: no native map on this build; Explore draws the schematic.
 * - `loading`: the native map is mounted and its style is loading.
 * - `ready`: the style loaded and Explore's layers are on it.
 * - `failed`: the style or the map could not load; `error` says why.
 */
export type NativeMapStatus = 'off' | 'loading' | 'ready' | 'failed';

interface NativeMapState {
  status: NativeMapStatus;
  error: string | null;
  /** The person turned on "My location" and the OS allowed it. */
  showUserLocation: boolean;
  /** The OS refused location after the person asked for it. */
  locationDenied: boolean;
  setStatus: (status: NativeMapStatus, error?: string | null) => void;
  setShowUserLocation: (show: boolean) => void;
  setLocationDenied: (denied: boolean) => void;
}

/** State of Explore's native Mapbox map, shared by the map and the pane around it. */
export const useNativeMap = create<NativeMapState>((set) => ({
  status: 'off',
  error: null,
  showUserLocation: false,
  locationDenied: false,
  setStatus: (status, error = null) => set({ status, error }),
  setShowUserLocation: (showUserLocation) => set({ showUserLocation, locationDenied: false }),
  setLocationDenied: (locationDenied) => set({ locationDenied, showUserLocation: false }),
}));

/** True while a native street map, not the schematic, fills the pane. */
export const useNativeMapLive = () => useNativeMap((s) => s.status !== 'off' && s.status !== 'failed');
