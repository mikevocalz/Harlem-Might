import { create } from 'zustand';

/** A navigation a panel asks the main window to perform. */
export interface MainRouteRequest {
  /** Increments per request, so the same URL twice still navigates twice. */
  id: number;
  method: 'push' | 'replace';
  url: string;
}

/**
 * Navigation requests from surfaces that have no navigator of their own.
 *
 * A Horizon panel (`SpatialPanelActivity`) is a second React Native surface
 * on the same runtime, outside expo-router's NavigationContainer. solito runs
 * there through `PanelNavigationProvider`, whose `useLinkTo` queues each
 * route here; `MainRouteRelay`, mounted in the root layout, performs it with
 * solito against the main window's navigator.
 */
interface MainRouteState {
  pending: MainRouteRequest | null;
  push: (url: string) => void;
  replace: (url: string) => void;
  /** Clears `pending` if it is still request `id`. */
  done: (id: number) => void;
}

let nextId = 1;

export const useMainRouteStore = create<MainRouteState>((set) => ({
  pending: null,
  push: (url) => set({ pending: { id: nextId++, method: 'push', url } }),
  replace: (url) => set({ pending: { id: nextId++, method: 'replace', url } }),
  done: (id) => set((state) => (state.pending?.id === id ? { pending: null } : state)),
}));
