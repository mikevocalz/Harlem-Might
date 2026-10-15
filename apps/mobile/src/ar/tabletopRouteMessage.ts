import type { ArRouteState } from './arSession.store.ts';

/** Bounded copy shared by the entry panel and the immersive status card. */
export function tabletopRouteUnavailableMessage(route: ArRouteState): string | null {
  if (route.status !== 'unavailable') return null;
  switch (route.reason) {
    case 'missing-origin': return 'This place has no mapped location yet';
    case 'no-destinations': return 'No nearby mapped places are available for a route';
    case 'request-failed': return 'The walking route could not be loaded';
  }
}
