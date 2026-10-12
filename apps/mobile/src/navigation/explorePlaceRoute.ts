import { useExplore } from '@acme/app';

type PlaceRoute = { key: string; params: object | undefined; placeId: string };

// Remember only the latest deep-link identity and an absent native dismissal.
// Expo Router retains key/params when replaying a route mount. Its NAVIGATE
// action replaces params even for the same place; a new entry can change key.
let lastAppliedRoute: PlaceRoute | null = null;
let dismissedRoute: PlaceRoute | null = null;

/** The native user-close event invalidates restoration of its retained route. */
export function dismissRetainedExplorePlaceRoute() {
  dismissedRoute = lastAppliedRoute;
}

/** Apply normal route effects, except replay of a natively dismissed entry. */
export function selectExplorePlaceRoute(route: PlaceRoute) {
  if (dismissedRoute?.key === route.key && dismissedRoute.params === route.params
    && dismissedRoute.placeId === route.placeId) return;
  lastAppliedRoute = route;
  dismissedRoute = null;
  useExplore.getState().openPlace(route.placeId, null);
}
