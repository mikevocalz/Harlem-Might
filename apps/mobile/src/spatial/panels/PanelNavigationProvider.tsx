import type { ReactNode } from 'react';
import { LinkingContext, NavigationContainerRefContext } from '@react-navigation/native';
import { SolitoProvider } from 'solito';
import { useMainNavigationStore } from '../mainNavigation.store';
import { useMainRouteStore } from '../mainRoute.store';

// solito calls `useLinkTo` as a hook; this one has no hooks of its own.
const PANEL_MIDDLEWARE = {
  useLinkTo: () => (to: string) => useMainRouteStore.getState().push(to),
} as unknown as Parameters<typeof SolitoProvider>[0]['middleware'];

/**
 * Lets solito run inside a Horizon panel, a React Native surface outside
 * expo-router's NavigationContainer, so `Link`, `MightsButton href` and
 * `useRouter` work there unchanged.
 *
 * solito reads three contexts. This provides the main window's container ref
 * and linking options (published by `MainRouteRelay`), and replaces
 * `useLinkTo` so every in-app route is queued for the main window, where
 * solito performs it. Absolute URLs never reach `useLinkTo`: solito's `Link`
 * opens them in the browser itself.
 *
 * Renders nothing until the main window has published, which it does on its
 * first render, before any panel can open.
 */
export function PanelNavigationProvider({ children }: { children: ReactNode }) {
  const containerRef = useMainNavigationStore((state) => state.containerRef);
  const linking = useMainNavigationStore((state) => state.linking);
  if (!containerRef || !linking) return null;
  return (
    <NavigationContainerRefContext.Provider value={containerRef}>
      <LinkingContext.Provider value={linking}>
        <SolitoProvider middleware={PANEL_MIDDLEWARE}>{children}</SolitoProvider>
      </LinkingContext.Provider>
    </NavigationContainerRefContext.Provider>
  );
}
