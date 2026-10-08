import { create } from 'zustand';
import type { CompactPane } from './exploreLayout.ts';

/**
 * Main-window layout choices the user makes in Explore. Selection and the
 * assistant live in `@acme/app` stores; this holds only what is specific to
 * the mobile layout.
 */
interface ExploreLayoutState {
  /** Compact: which full-screen pane shows. Starts on the map (research.md segment 1). */
  compactPane: CompactPane;
  /** Compact: where closing Detail goes back to. */
  compactOrigin: Exclude<CompactPane, 'detail'>;
  /** Medium: whether the Discover drawer is open over the map. */
  discoverDrawerOpen: boolean;
  setCompactPane: (pane: Exclude<CompactPane, 'detail'>) => void;
  /** Compact: shows Detail full screen and remembers the pane it covers. */
  showCompactDetail: (origin: Exclude<CompactPane, 'detail'>) => void;
  /** Compact: leaves Detail for the pane it covered. */
  leaveCompactDetail: () => void;
  setDiscoverDrawerOpen: (open: boolean) => void;
}

export const useExploreLayoutStore = create<ExploreLayoutState>((set) => ({
  compactPane: 'map',
  compactOrigin: 'map',
  discoverDrawerOpen: false,
  setCompactPane: (compactPane) => set({ compactPane, compactOrigin: compactPane }),
  showCompactDetail: (compactOrigin) => set({ compactPane: 'detail', compactOrigin }),
  leaveCompactDetail: () => set((state) => ({ compactPane: state.compactOrigin })),
  setDiscoverDrawerOpen: (discoverDrawerOpen) => set({ discoverDrawerOpen }),
}));
