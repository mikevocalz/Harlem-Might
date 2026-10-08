import { createLocalFrame, type LocalPoint } from '../geo/localFrame.ts';
import type { GeographicCoordinate } from '../model/geo.ts';
import type { Route } from '../model/route.ts';
import type { NavigationState } from '../session/navigationStore.ts';

/**
 * Drops route vertices that sit within `toleranceM` of the line through
 * their neighbours (Ramer–Douglas–Peucker, in local metres). A schematic or
 * overview line needs the shape, not every crosswalk vertex, and a shorter
 * list keeps the map's SVG and GeoJSON cheap to redraw on a reroute.
 *
 * Works in a tangent plane at the first vertex, never in degrees: a degree
 * of longitude in Harlem is 0.76 of a degree of latitude, so a tolerance in
 * degrees would cut east-west streets harder than avenues.
 *
 * First and last vertices are always kept. Input order is preserved.
 */
export function simplifyRoute(coordinates: readonly GeographicCoordinate[], toleranceM: number): GeographicCoordinate[] {
  if (coordinates.length <= 2 || !(toleranceM > 0)) return [...coordinates];
  const frame = createLocalFrame(coordinates[0]!);
  const local = coordinates.map((c) => frame.toLocal(c));
  const keep = new Uint8Array(local.length);
  keep[0] = 1;
  keep[local.length - 1] = 1;
  const stack: [number, number][] = [[0, local.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let worst = -1;
    let worstDistance = toleranceM;
    for (let i = start + 1; i < end; i += 1) {
      const d = distanceToSegment(local[i]!, local[start]!, local[end]!);
      if (d > worstDistance) {
        worst = i;
        worstDistance = d;
      }
    }
    if (worst !== -1) {
      keep[worst] = 1;
      stack.push([start, worst], [worst, end]);
    }
  }
  return coordinates.filter((_, i) => keep[i] === 1);
}

function distanceToSegment(p: LocalPoint, a: LocalPoint, b: LocalPoint): number {
  const dx = b.eastM - a.eastM;
  const dy = b.northM - a.northM;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.eastM - a.eastM) * dx + (p.northM - a.northM) * dy) / lengthSq));
  return Math.hypot(p.eastM - (a.eastM + t * dx), p.northM - (a.northM + t * dy));
}

/** GeoJSON `[lng, lat]` positions for a map line. The only place the UI converts from the domain's order. */
export function toLngLat(coordinates: readonly GeographicCoordinate[]): [number, number][] {
  return coordinates.map((c) => [c.longitude, c.latitude]);
}

/**
 * Splits a route line at the matched position: the part already walked and
 * the part ahead, so the map can draw them differently. Before the first
 * match (`alongTrackM` undefined) everything is ahead.
 */
export function splitRouteAt(
  coordinates: readonly GeographicCoordinate[],
  matched: { readonly coordinate: GeographicCoordinate; readonly segmentIndex: number } | undefined,
): { walked: GeographicCoordinate[]; ahead: GeographicCoordinate[] } {
  if (!matched || coordinates.length < 2) return { walked: [], ahead: [...coordinates] };
  const cut = Math.min(Math.max(matched.segmentIndex, 0), coordinates.length - 2);
  return {
    walked: [...coordinates.slice(0, cut + 1), matched.coordinate],
    ahead: [matched.coordinate, ...coordinates.slice(cut + 1)],
  };
}

/** The route a map should draw, and whether it is a preview or being followed. */
export interface DisplayedRoute {
  readonly route: Route;
  /** Bumps on every reroute; a map redraws its line when this or `route.id` changes. */
  readonly generation: number;
  readonly kind: 'preview' | 'active';
}

/**
 * The route the map shows: the selected option while choosing, the active
 * route while guiding. Nothing otherwise: the map never draws a line the
 * session does not hold, and never a straight one.
 */
export function selectDisplayedRoute(
  state: Pick<NavigationState, 'session'>,
): DisplayedRoute | undefined {
  const session = state.session;
  if (session.phase === 'routeReady') {
    const route = session.routes[session.selectedRouteIndex] ?? session.routes[0];
    return { route, generation: 0, kind: 'preview' };
  }
  if ('activeRoute' in session) {
    return { route: session.activeRoute.route, generation: session.activeRoute.generation, kind: 'active' };
  }
  return undefined;
}
