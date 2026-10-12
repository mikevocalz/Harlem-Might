import type { ArSessionState } from './arSession.store.ts';
import type { fetchWalkingRoute, RoutePlace } from './walkingRoute.ts';

type RouteSession = Pick<ArSessionState,
  'requested' | 'route' | 'clearRoute' | 'setRouteLoading' | 'setRouteUnavailable' | 'setRoute'>;

/** Owns one effect's request, including transports that settle after abort. */
export function startTabletopRouteRequest(input: {
  readonly placeId: string | undefined;
  readonly from: RoutePlace | null;
  readonly to: readonly RoutePlace[];
  readonly accessToken: string | undefined;
}, dependencies: {
  readonly getSession: () => RouteSession;
  readonly fetchRoute: typeof fetchWalkingRoute;
}): () => void {
  const session = dependencies.getSession();
  if (!input.placeId) {
    session.clearRoute();
    return () => {};
  }
  if (!input.from?.lngLat || input.to.length === 0) {
    session.setRouteUnavailable(input.from?.lngLat ? 'no-destinations' : 'missing-origin');
    return () => {};
  }

  const controller = new AbortController();
  session.setRouteLoading();
  const loading = dependencies.getSession().route;
  const ownsLoading = () => {
    const current = dependencies.getSession();
    return current.route === loading && current.requested === session.requested;
  };
  const from = input.from;
  const load = async () => {
    try {
      const route = await dependencies.fetchRoute({
        from, to: input.to, accessToken: input.accessToken, signal: controller.signal,
      });
      if (!controller.signal.aborted && ownsLoading()) dependencies.getSession().setRoute(route);
    } catch {
      if (!controller.signal.aborted && ownsLoading()) {
        dependencies.getSession().setRouteUnavailable('request-failed');
      }
    }
  };
  void load();

  return () => {
    controller.abort();
    if (ownsLoading()) dependencies.getSession().clearRoute();
  };
}
