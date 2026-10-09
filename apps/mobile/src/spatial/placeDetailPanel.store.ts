import { create } from 'zustand';
import type { PlaceDetailPanelStatus } from './placeDetailPanel.ts';

/**
 * The Place Detail panel's status (`placeDetailPanel.ts`). In memory only: a
 * panel never outlives the process that opened it.
 */
interface PlaceDetailPanelState {
  status: PlaceDetailPanelStatus;
  setStatus: (status: PlaceDetailPanelStatus) => void;
}

export const usePlaceDetailPanelStore = create<PlaceDetailPanelState>((set) => ({
  status: 'closed',
  setStatus: (status) => set({ status }),
}));
