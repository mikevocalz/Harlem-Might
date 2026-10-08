import { create } from 'zustand';

// Mount phase of the one Sightline island on /ar (ADR 0004: one renderer per
// page, so a module store is enough). Scroll progress never enters this store;
// it is read from layout inside the render loop.
//   waiting      server render, JS off, or not scrolled near yet
//   unsupported  no navigator.gpu
//   loading      chunk requested, device and first frame pending
//   ready        first frame drawn
//   failed       no adapter, init threw, or the device was lost
export type SightlinePhase = 'waiting' | 'unsupported' | 'loading' | 'ready' | 'failed';

export const useSightlineIsland = create<{ phase: SightlinePhase; setPhase: (phase: SightlinePhase) => void }>((set) => ({
  phase: 'waiting',
  setPhase: (phase) => set({ phase }),
}));
