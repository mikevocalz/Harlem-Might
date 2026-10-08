import type { ContextType } from 'react';
import type { LinkingContext, NavigationContainerRefContext } from '@react-navigation/native';
import { create } from 'zustand';

/**
 * The main window's navigation contexts, published by `MainRouteRelay` from
 * inside expo-router's NavigationContainer so a Horizon panel, a second
 * React Native surface with no navigator, can hand them to solito
 * (`PanelNavigationProvider`).
 */
interface MainNavigationState {
  containerRef: ContextType<typeof NavigationContainerRefContext> | null;
  linking: ContextType<typeof LinkingContext> | null;
  publish: (
    containerRef: ContextType<typeof NavigationContainerRefContext>,
    linking: ContextType<typeof LinkingContext>,
  ) => void;
}

export const useMainNavigationStore = create<MainNavigationState>((set) => ({
  containerRef: null,
  linking: null,
  publish: (containerRef, linking) => set({ containerRef, linking }),
}));
