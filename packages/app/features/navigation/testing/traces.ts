// Test-only. Synthesises GPS traces by sampling a REAL recorded route
// geometry. No street geometry is invented here: every true position lies on
// a Mapbox-provided polyline; only measurement noise, drift, reversals and
// dropouts are added, from a seeded generator so every run is identical.
import { createLocalFrame, type LocalPoint } from '../geo/localFrame.ts';
import { createProjectedPolyline, pointAtDistance } from '../geo/polyline.ts';
import type { LocationFix } from '../model/location.ts';
import type { Route } from '../model/route.ts';

/** mulberry32: small, fast, seedable PRNG (public domain). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample by Box-Muller. */
export function gaussian(random: () => number): number {
  const u = Math.max(random(), 1e-12);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** A disturbance applied to part of a trace, keyed by distance along the route. */
export type TraceEvent =
  /** No fixes between the two distances (tunnel, scaffolding, phone in pocket). */
  | { readonly kind: 'dropout'; readonly fromM: number; readonly toM: number }
  /** Positions biased by a constant offset (multipath off a building face). */
  | { readonly kind: 'drift'; readonly fromM: number; readonly toM: number; readonly eastM: number; readonly northM: number }
  /** One fix displaced by a large jump. */
  | { readonly kind: 'jump'; readonly atM: number; readonly eastM: number; readonly northM: number }
  /** The walker turns around at `atM` and walks back `forM` metres. */
  | { readonly kind: 'reverse'; readonly atM: number; readonly forM: number }
  /** The walker leaves the route at `atM`, walking `forM` metres on `bearingDeg`, and stops there. */
  | { readonly kind: 'leave'; readonly atM: number; readonly forM: number; readonly bearingDeg: number };

export interface TraceOptions {
  readonly seed: number;
  readonly startMs?: number;
  readonly speedMps?: number;
  readonly intervalMs?: number;
  /** Per-axis noise sigma in metres. */
  readonly noiseSigmaM?: number;
  /** Reported 68% radius. @default noiseSigmaM × 1.51 */
  readonly accuracyM?: number;
  readonly events?: readonly TraceEvent[];
  /** Extra fixes after the end of the route, standing still. */
  readonly dwellFixes?: number;
}

export interface SyntheticFix {
  readonly fix: LocationFix;
  /** Where the walker truly was. */
  readonly truth: LocalPoint;
  /** Distance along the route of the walker's nearest on-route position. */
  readonly routeDistanceM: number;
}

/** Samples a walk along `route` with seeded noise and the given events. */
export function synthesizeTrace(route: Route, options: TraceOptions): SyntheticFix[] {
  const random = seededRandom(options.seed);
  const startMs = options.startMs ?? 1_760_000_000_000;
  const speed = options.speedMps ?? 1.4;
  const intervalMs = options.intervalMs ?? 1000;
  const sigma = options.noiseSigmaM ?? 3;
  const accuracy = options.accuracyM ?? sigma * 1.51;
  const events = options.events ?? [];
  const frame = createLocalFrame(route.geometry.coordinates[0]!);
  const polyline = createProjectedPolyline(frame, route.geometry.coordinates);
  const step = (speed * intervalMs) / 1000;

  // Path of along-route distances, with reversals and departures expanded.
  type Pose = { along: number; offset?: LocalPoint };
  const poses: Pose[] = [];
  const leave = events.find((e): e is Extract<TraceEvent, { kind: 'leave' }> => e.kind === 'leave');
  const reverses = events.filter((e): e is Extract<TraceEvent, { kind: 'reverse' }> => e.kind === 'reverse');
  let along = 0;
  const end = leave ? leave.atM : polyline.lengthM;
  while (along < end) {
    poses.push({ along });
    const reverse = reverses.find((r) => along < r.atM && along + step >= r.atM);
    along += step;
    if (reverse) {
      for (let back = reverse.atM - step; back >= reverse.atM - reverse.forM; back -= step) poses.push({ along: back });
      for (let fwd = reverse.atM - reverse.forM; fwd < reverse.atM; fwd += step) poses.push({ along: fwd });
    }
  }
  if (leave) {
    const rad = (leave.bearingDeg * Math.PI) / 180;
    for (let d = step; d <= leave.forM; d += step) {
      poses.push({ along: leave.atM, offset: { eastM: Math.sin(rad) * d, northM: Math.cos(rad) * d } });
    }
    const last = poses[poses.length - 1]!;
    for (let i = 0; i < (options.dwellFixes ?? 0); i += 1) poses.push(last);
  } else {
    poses.push({ along: polyline.lengthM });
    for (let i = 0; i < (options.dwellFixes ?? 0); i += 1) poses.push({ along: polyline.lengthM });
  }

  const fixes: SyntheticFix[] = [];
  poses.forEach((pose, i) => {
    const base = pointAtDistance(polyline, pose.along).point;
    const truth = pose.offset
      ? { eastM: base.eastM + pose.offset.eastM, northM: base.northM + pose.offset.northM }
      : base;
    const t = startMs + i * intervalMs;
    let e = truth.eastM + gaussian(random) * sigma;
    let n = truth.northM + gaussian(random) * sigma;
    let dropped = false;
    for (const event of events) {
      if (event.kind === 'dropout' && pose.along >= event.fromM && pose.along < event.toM && !pose.offset) dropped = true;
      if (event.kind === 'drift' && pose.along >= event.fromM && pose.along < event.toM) {
        e += event.eastM;
        n += event.northM;
      }
      if (event.kind === 'jump' && pose.along <= event.atM && pose.along + step > event.atM && !pose.offset) {
        e += event.eastM;
        n += event.northM;
      }
    }
    if (dropped) return;
    fixes.push({
      fix: {
        coordinate: frame.toGeographic({ eastM: e, northM: n }),
        accuracy: { horizontalM: accuracy },
        timestampMs: t,
        source: 'device-gps',
      },
      truth,
      routeDistanceM: pose.along,
    });
  });
  return fixes;
}
