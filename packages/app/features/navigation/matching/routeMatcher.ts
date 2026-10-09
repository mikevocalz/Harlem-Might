import type { NavigationConfig } from '../config.ts';
import { angleBetweenDegrees } from '../geo/angles.ts';
import { createLocalFrame } from '../geo/localFrame.ts';
import {
  createProjectedPolyline,
  projectOntoPolyline,
  projectOntoSegment,
  segmentBearingDeg,
  type ProjectedPolyline,
  type SegmentProjection,
} from '../geo/polyline.ts';
import type { FilteredPosition, HeadingEstimate, RouteMatch } from '../model/location.ts';
import type { Route } from '../model/route.ts';

/**
 * Snaps filtered positions onto one route.
 *
 * Every segment within the candidate radius is scored by
 *
 *   cost = (crossTrack / σ)² + headingWeight · (1 − cos Δheading)
 *        + continuityWeight · (excess along-track jump / σ)²
 *
 * and the cheapest wins. The continuity term is what keeps a fix that sits
 * between two parallel streets on the street the person was already walking:
 * jumping to the other one means a large along-track jump the person could
 * not have walked since the previous fix.
 *
 * One matcher belongs to one route; a reroute creates a new matcher.
 */
export interface RouteMatcher {
  readonly route: Route;
  readonly polyline: ProjectedPolyline;
  /**
   * Snaps `position`. `fixAccuracyM` is the raw fix's 68% radius; above
   * `maxSnapAccuracyM` the result is `unmatched` (`too-coarse`) with the
   * distance still measured.
   */
  match(position: FilteredPosition, heading: HeadingEstimate | undefined, fixAccuracyM: number): RouteMatch;
  /** Forgets the previous match, e.g. after a GPS reset. */
  resetContinuity(): void;
}

/** Creates a {@linkcode RouteMatcher}. The local frame is anchored at the route's first position. */
export function createRouteMatcher(route: Route, config: NavigationConfig['matching']): RouteMatcher {
  const first = route.geometry.coordinates[0];
  if (!first) throw new RangeError('route geometry is empty');
  const polyline = createProjectedPolyline(createLocalFrame(first), route.geometry.coordinates);
  let previous: { alongTrackM: number; timestampMs: number } | undefined;

  const usableHeading = (heading: HeadingEstimate | undefined): number | undefined =>
    heading && heading.confidence !== 'low' ? heading.headingDeg : undefined;

  return {
    route,
    polyline,
    resetContinuity() {
      previous = undefined;
    },
    match(position, heading, fixAccuracyM) {
      const point = polyline.frame.toLocal(position.coordinate);
      if (fixAccuracyM > config.maxSnapAccuracyM) {
        return {
          kind: 'unmatched',
          reason: 'too-coarse',
          nearestDistanceM: projectOntoPolyline(polyline, point).distanceM,
          timestampMs: position.timestampMs,
        };
      }
      const sigma = Math.max(position.sigmaM, 1);
      const radius = Math.max(config.minCandidateRadiusM, 3 * sigma);
      const headingDeg = usableHeading(heading);

      let best: { projection: SegmentProjection; cost: number; bearing: number } | undefined;
      for (let i = 0; i < polyline.segmentCount; i += 1) {
        const projection = projectOntoSegment(polyline, i, point);
        if (projection.distanceM > radius) continue;
        const bearing = segmentBearingDeg(polyline, i);
        let cost = (projection.distanceM / sigma) ** 2;
        if (headingDeg !== undefined) {
          const delta = angleBetweenDegrees(headingDeg, bearing);
          cost += config.headingWeight * (1 - Math.cos((delta * Math.PI) / 180));
        }
        if (previous) {
          const dtS = Math.max(0, (position.timestampMs - previous.timestampMs) / 1000);
          const reach = position.speedMps * dtS + config.forwardSlackM;
          const jump = projection.alongTrackM - previous.alongTrackM;
          const excess = jump > reach ? jump - reach : jump < -config.backtrackToleranceM ? -config.backtrackToleranceM - jump : 0;
          cost += config.continuityWeight * (excess / sigma) ** 2;
        }
        if (!best || cost < best.cost) best = { projection, cost, bearing };
      }

      if (!best) {
        return {
          kind: 'unmatched',
          reason: 'too-far',
          nearestDistanceM: projectOntoPolyline(polyline, point).distanceM,
          timestampMs: position.timestampMs,
        };
      }

      const { projection, bearing } = best;
      previous = { alongTrackM: projection.alongTrackM, timestampMs: position.timestampMs };
      let travelDirection: 'forward' | 'backward' | 'unknown' = 'unknown';
      if (headingDeg !== undefined) {
        travelDirection = angleBetweenDegrees(headingDeg, bearing) >= config.backwardAngleDeg ? 'backward' : 'forward';
      }
      return {
        kind: 'matched',
        coordinate: polyline.frame.toGeographic(projection.point),
        segmentIndex: projection.segmentIndex,
        alongTrackM: projection.alongTrackM,
        crossTrackM: projection.crossTrackM,
        segmentBearingDeg: bearing,
        travelDirection,
        timestampMs: position.timestampMs,
      };
    },
  };
}
