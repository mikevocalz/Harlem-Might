import { createMapboxDirectionsProvider } from '@acme/app/features/navigation/providers/mapboxDirections.ts';
import { RouteProviderError, type RouteProvider } from '@acme/app/features/navigation/providers/routeProvider.ts';
import {
  createNavigationController,
  type NavigationController,
} from '@acme/app/features/navigation/session/navigationController.ts';
import { mapboxToken } from './mapboxToken';

let controller: NavigationController | undefined;

/** Answers every request with `missing-token` so the session shows a real error instead of throwing at start-up. */
function missingTokenProvider(message: string): RouteProvider {
  return {
    id: 'mapbox',
    supportedModes: ['walking', 'cycling', 'driving'],
    getRoutes: () => Promise.reject(new RouteProviderError('missing-token', 'mapbox', message)),
  };
}

/**
 * The app's one navigation controller, writing the shared
 * `useNavigationStore`. The map (Phase 2) and the AR view (Phase 3) must use
 * this instance so they drive the same session: AR never plans or refetches
 * a route of its own.
 */
export function getNavigationController(): NavigationController {
  if (controller) return controller;
  const token = mapboxToken();
  const provider =
    token.kind === 'public'
      ? createMapboxDirectionsProvider({ accessToken: token.token })
      : missingTokenProvider(
          token.kind === 'missing'
            ? 'EXPO_PUBLIC_MAPBOX_TOKEN is not set'
            : 'EXPO_PUBLIC_MAPBOX_TOKEN is not a public pk. token',
        );
  controller = createNavigationController({ provider });
  return controller;
}
