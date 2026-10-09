import type { GeographicCoordinate } from '../model/geo.ts';
import { bearingOfVector } from './angles.ts';
import type { LocalFrame, LocalPoint } from './localFrame.ts';

/**
 * A route geometry projected into a {@linkcode LocalFrame}, with cumulative
 * distances so along-track lookups are O(1) per segment.
 *
 * Zero-length segments (repeated vertices, which providers do emit) are
 * removed at construction so every segment has a direction.
 */
export interface ProjectedPolyline {
  readonly frame: LocalFrame;
  readonly points: readonly LocalPoint[];
  /** `cumulativeM[i]` is the distance from the start to `points[i]`. */
  readonly cumulativeM: readonly number[];
  readonly lengthM: number;
  /** Number of segments, `points.length - 1`. */
  readonly segmentCount: number;
}

/** The closest point on one segment to a query point. */
export interface SegmentProjection {
  readonly segmentIndex: number;
  /** 0..1 position along the segment. */
  readonly t: number;
  readonly point: LocalPoint;
  readonly alongTrackM: number;
  /** Signed: positive when the query point is left of the segment's direction. */
  readonly crossTrackM: number;
  /** Unsigned distance from the query point to `point`. */
  readonly distanceM: number;
}

const MIN_SEGMENT_M = 0.01;

/**
 * Projects `coordinates` into `frame`.
 *
 * @throws {RangeError} When fewer than two distinct positions remain.
 */
export function createProjectedPolyline(
  frame: LocalFrame,
  coordinates: readonly GeographicCoordinate[],
): ProjectedPolyline {
  const points: LocalPoint[] = [];
  const cumulativeM: number[] = [];
  let total = 0;
  for (const coordinate of coordinates) {
    const point = frame.toLocal(coordinate);
    const previous = points[points.length - 1];
    if (previous) {
      const length = Math.hypot(point.eastM - previous.eastM, point.northM - previous.northM);
      if (length < MIN_SEGMENT_M) continue;
      total += length;
    }
    points.push(point);
    cumulativeM.push(total);
  }
  if (points.length < 2) {
    throw new RangeError('A route needs at least two distinct positions');
  }
  return { frame, points, cumulativeM, lengthM: total, segmentCount: points.length - 1 };
}

/** Projects `point` onto segment `segmentIndex` (clamped to its end points). */
export function projectOntoSegment(
  polyline: ProjectedPolyline,
  segmentIndex: number,
  point: LocalPoint,
): SegmentProjection {
  const a = polyline.points[segmentIndex];
  const b = polyline.points[segmentIndex + 1];
  const start = polyline.cumulativeM[segmentIndex];
  if (!a || !b || start === undefined) {
    throw new RangeError(`segmentIndex ${segmentIndex} is outside 0..${polyline.segmentCount - 1}`);
  }
  const de = b.eastM - a.eastM;
  const dn = b.northM - a.northM;
  const lengthSq = de * de + dn * dn;
  const pe = point.eastM - a.eastM;
  const pn = point.northM - a.northM;
  const t = Math.min(1, Math.max(0, (pe * de + pn * dn) / lengthSq));
  const foot = { eastM: a.eastM + de * t, northM: a.northM + dn * t };
  const length = Math.sqrt(lengthSq);
  // Cross product sign: (segment × point) > 0 means the point is to the left.
  const cross = (de * pn - dn * pe) / length;
  const distance = Math.hypot(point.eastM - foot.eastM, point.northM - foot.northM);
  return {
    segmentIndex,
    t,
    point: foot,
    alongTrackM: start + length * t,
    crossTrackM: cross >= 0 ? distance : -distance,
    distanceM: distance,
  };
}

/** Compass bearing of segment `segmentIndex`, degrees from true north. */
export function segmentBearingDeg(polyline: ProjectedPolyline, segmentIndex: number): number {
  const a = polyline.points[segmentIndex];
  const b = polyline.points[segmentIndex + 1];
  if (!a || !b) throw new RangeError(`segmentIndex ${segmentIndex} is outside the polyline`);
  return bearingOfVector(b.eastM - a.eastM, b.northM - a.northM);
}

/** The closest projection over every segment. */
export function projectOntoPolyline(polyline: ProjectedPolyline, point: LocalPoint): SegmentProjection {
  let best = projectOntoSegment(polyline, 0, point);
  for (let i = 1; i < polyline.segmentCount; i += 1) {
    const candidate = projectOntoSegment(polyline, i, point);
    if (candidate.distanceM < best.distanceM) best = candidate;
  }
  return best;
}

/**
 * The point `distanceM` along the polyline, clamped to its ends, with the
 * index of the segment it lies on.
 */
export function pointAtDistance(
  polyline: ProjectedPolyline,
  distanceM: number,
): { readonly point: LocalPoint; readonly segmentIndex: number } {
  if (!Number.isFinite(distanceM)) throw new RangeError('distanceM must be finite');
  const { points, cumulativeM, segmentCount } = polyline;
  if (distanceM <= 0) return { point: points[0]!, segmentIndex: 0 };
  if (distanceM >= polyline.lengthM) return { point: points[segmentCount]!, segmentIndex: segmentCount - 1 };
  let lo = 0;
  let hi = segmentCount - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cumulativeM[mid]! <= distanceM) lo = mid;
    else hi = mid - 1;
  }
  const a = points[lo]!;
  const b = points[lo + 1]!;
  const t = (distanceM - cumulativeM[lo]!) / (cumulativeM[lo + 1]! - cumulativeM[lo]!);
  return {
    point: { eastM: a.eastM + (b.eastM - a.eastM) * t, northM: a.northM + (b.northM - a.northM) * t },
    segmentIndex: lo,
  };
}
