import { create } from 'zustand';

/**
 * Whether the GL map came up. `unavailable` covers a missing token and a
 * browser without WebGL; either way the list still holds every place, so the
 * workspace swaps the map pane for a plate that points there.
 */
export type MapStatus = 'loading' | 'ready' | 'unavailable';

export const useMapStatus = create<{ status: MapStatus; setStatus: (status: MapStatus) => void }>((set) => ({
  status: 'loading',
  setStatus: (status) => set({ status }),
}));
