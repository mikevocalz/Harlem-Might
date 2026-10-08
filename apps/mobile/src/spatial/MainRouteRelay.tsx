import { useContext, useEffect } from 'react';
import { LinkingContext, NavigationContainerRefContext } from '@react-navigation/native';
import { useRouter } from 'solito/navigation';
import { useMainNavigationStore } from './mainNavigation.store';
import { useMainRouteStore } from './mainRoute.store';

/**
 * The main window's side of panel navigation. Mount once, inside the root
 * layout (expo-router's NavigationContainer). Renders nothing.
 *
 * - Publishes this navigator's container ref and linking options, so solito
 *   can run inside a Horizon panel (`PanelNavigationProvider`).
 * - Performs the routes a panel queues (`mainRoute.store.ts`) with solito, in
 *   the main window.
 */
export function MainRouteRelay() {
  const router = useRouter();
  const containerRef = useContext(NavigationContainerRefContext);
  const linking = useContext(LinkingContext);
  const publish = useMainNavigationStore((state) => state.publish);
  const pending = useMainRouteStore((state) => state.pending);
  const done = useMainRouteStore((state) => state.done);

  useEffect(() => {
    publish(containerRef, linking);
  }, [containerRef, linking, publish]);

  useEffect(() => {
    if (!pending) return;
    if (pending.method === 'push') router.push(pending.url);
    else router.replace(pending.url);
    done(pending.id);
  }, [pending, router, done]);

  return null;
}
