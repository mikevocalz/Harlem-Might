import { enuToViroPosition, projectRouteToEnu, projectToEnu, type EnuPlacement } from '@mapbox/react-native-mapbox-ar-reactvision/src/enu.ts';
import { cumulativeRouteLengthsM, projectOntoRoute } from '@mapbox/react-native-mapbox-ar-reactvision/src/routeMatch.ts';
import type { CompassPlacementConfidence } from '@mapbox/react-native-mapbox-ar-reactvision/src/compassPlacement.ts';
import type { EnuOrigin, GeoWorldPosition } from '@mapbox/react-native-mapbox-ar-reactvision/src/types.ts';
import type { ActiveRoute, ArTrackingState, NavigationSession } from '@acme/app/features/navigation/model/session.ts';
import type { ConfidenceLevel, HeadingEstimate, RouteMatch } from '@acme/app/features/navigation/model/location.ts';
import type { PositioningState, RouteProgress } from '@acme/app/features/navigation/model/progress.ts';
import type { GeographicCoordinate } from '@acme/app/features/navigation/model/geo.ts';
import type { NavigationManeuver } from '@acme/app/features/navigation/model/route.ts';

/**
 * Pure logic for the phone AR navigation scene (spec Phase 3). The scene
 * reads the shared navigation session; nothing here fetches or recomputes a
 * route.
 *
 * Frames: WGS84 → ENU at the route start (`projectRouteToEnu`) → Viro
 * node-local (x east, y up, z = −north) → AR world through one
 * {@linkcode EnuPlacement} (position + yaw). The placement is solved once at
 * calibration and afterwards only slewed (`slewPlacement`), never recomputed
 * from the live heading each frame.
 */

const DEG = Math.PI / 180;

/** A route projected once per route generation. */
export interface NavRouteFrame {
  readonly routeId: string;
  readonly generation: number;
  readonly origin: EnuOrigin;
  /** Node-local Viro points, one per route geometry coordinate. */
  readonly points: readonly GeoWorldPosition[];
  /** Horizontal along-track distance of each point, same metric as `projectOntoRoute`. */
  readonly cumulativeM: readonly number[];
}

/**
 * Projects the active route from its first coordinate. The origin altitude is
 * 0 and every vertex uses it, so the route lies on a flat plane; the scene
 * puts that plane on the ground with the placement height. Harlem's slopes
 * (a few metres per block at most) are ignored.
 *
 * @throws {RangeError} When the route geometry has fewer than two coordinates.
 */
export function projectNavRoute(active: ActiveRoute): NavRouteFrame {
  const coordinates = active.route.geometry.coordinates;
  if (coordinates.length < 2) throw new RangeError('route geometry needs at least two coordinates');
  const first = coordinates[0]!;
  const origin: EnuOrigin = {
    frame: { kind: 'route-start', routeId: `${active.route.id}#${active.generation}` },
    latitude: first.latitude,
    longitude: first.longitude,
    altitude: 0,
  };
  const points = projectRouteToEnu(origin, coordinates);
  return {
    routeId: active.route.id,
    generation: active.generation,
    origin,
    points,
    cumulativeM: cumulativeRouteLengthsM(points),
  };
}

/** Node-local Viro position of a coordinate, on the route plane (y = 0). */
export function localPointOf(origin: EnuOrigin, coordinate: GeographicCoordinate): GeoWorldPosition {
  const [x, , z] = enuToViroPosition(
    projectToEnu(origin, { latitude: coordinate.latitude, longitude: coordinate.longitude, altitude: origin.altitude }),
  );
  return [x, 0, z];
}

function rotateY(x: number, z: number, yawDeg: number): [number, number] {
  const c = Math.cos(yawDeg * DEG);
  const s = Math.sin(yawDeg * DEG);
  return [c * x + s * z, -s * x + c * z];
}

/**
 * The same world transform expressed for another origin: where `to` sits in
 * the AR world if `placement` is right for `from`. Used when a reroute brings
 * a route that starts elsewhere, so the new geometry lands where the old one
 * was without re-solving (and without a visible jump). Height is kept.
 * Meridian convergence between two Harlem origins is under 0.01°, so the yaw
 * is kept too.
 */
export function rebasePlacement(placement: EnuPlacement, from: EnuOrigin, to: EnuOrigin): EnuPlacement {
  const [lx, , lz] = localPointOf(from, to);
  const [wx, wz] = rotateY(lx, lz, placement.rotation[1]);
  return {
    position: [placement.position[0] + wx, placement.position[1], placement.position[2] + wz],
    rotation: placement.rotation,
  };
}

/**
 * The matched along-track distance in the frame's own metric. The domain
 * matcher measures along the geodesic; re-projecting onto the ENU points,
 * restricted to segments around the matched one, keeps chevrons on the pass
 * of a doubled-back route the walker is on.
 *
 * `undefined` while unmatched, or when the match is for another route.
 */
export function alongTrackOnFrame(frame: NavRouteFrame, match: RouteMatch | undefined): number | undefined {
  if (match?.kind !== 'matched') return undefined;
  const last = frame.points.length - 2;
  if (match.segmentIndex > last) return undefined;
  const local = localPointOf(frame.origin, match.coordinate);
  return projectOntoRoute(frame.points, local, {
    fromSegment: Math.max(0, match.segmentIndex - 2),
    toSegment: Math.min(last, match.segmentIndex + 2),
  }).alongTrackM;
}

/** Node-local point and route bearing `alongM` metres along the frame. */
export function pointOnFrame(frame: NavRouteFrame, alongM: number): { point: GeoWorldPosition; bearingDeg: number } {
  const { points, cumulativeM } = frame;
  const total = cumulativeM[cumulativeM.length - 1]!;
  const along = Math.min(Math.max(alongM, 0), total);
  let i = 0;
  while (i < points.length - 2 && (cumulativeM[i + 1]! <= along || cumulativeM[i + 1] === cumulativeM[i])) i += 1;
  while (i > 0 && cumulativeM[i + 1] === cumulativeM[i]) i -= 1;
  const a = points[i]!;
  const b = points[i + 1]!;
  const length = cumulativeM[i + 1]! - cumulativeM[i]!;
  const t = length === 0 ? 0 : (along - cumulativeM[i]!) / length;
  const bearing = Math.atan2(b[0] - a[0], -(b[2] - a[2])) / DEG;
  return {
    point: [a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t],
    bearingDeg: bearing < 0 ? bearing + 360 : bearing,
  };
}

/** Chevrons run to the next manoeuvre plus this. */
export const CHEVRON_PAST_MANEUVER_M = 5;

/**
 * Where chevrons stop: the next manoeuvre plus 5 m, or the route end on the
 * final step.
 */
export function chevronStopAlongTrackM(alongM: number, progress: RouteProgress | undefined): number | undefined {
  if (!progress?.nextManeuver) return undefined;
  return alongM + progress.distanceToNextManeuverM + CHEVRON_PAST_MANEUVER_M;
}

/** Wraps degrees into (−180, 180]. */
export function wrapDeg(degrees: number): number {
  const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

// ---------------------------------------------------------------------------
// Compass calibration

/** One yaw candidate: `cameraYawDeg(forward) + heading`, at the same moment. */
export interface YawSample {
  readonly yawDeg: number;
  readonly timestampMs: number;
}

/** Circular statistics of recent {@linkcode YawSample}s. */
export interface YawSummary {
  /** Circular mean, (−180, 180]. */
  readonly meanDeg: number;
  /** Mean resultant length, 0..1; 1 when every sample agrees. */
  readonly resultant: number;
  readonly count: number;
  readonly spanMs: number;
}

/** Keep at most this many yaw samples. */
export const YAW_WINDOW = 30;

/** Appends a sample, keeping the newest {@linkcode YAW_WINDOW}. */
export function addYawSample(samples: readonly YawSample[], sample: YawSample): YawSample[] {
  if (!Number.isFinite(sample.yawDeg) || !Number.isFinite(sample.timestampMs)) return [...samples];
  const next = [...samples, sample];
  return next.length > YAW_WINDOW ? next.slice(next.length - YAW_WINDOW) : next;
}

/** Circular mean and spread. Averages unit vectors, so 179° and −179° average to 180°. */
export function summarizeYawSamples(samples: readonly YawSample[]): YawSummary | undefined {
  if (samples.length === 0) return undefined;
  let sx = 0;
  let sy = 0;
  for (const s of samples) {
    sx += Math.sin(s.yawDeg * DEG);
    sy += Math.cos(s.yawDeg * DEG);
  }
  const n = samples.length;
  return {
    meanDeg: wrapDeg(Math.atan2(sx, sy) / DEG),
    resultant: Math.hypot(sx, sy) / n,
    count: n,
    spanMs: samples[n - 1]!.timestampMs - samples[0]!.timestampMs,
  };
}

/** Thresholds for {@linkcode isCompassSettled}. */
export const COMPASS_CALIBRATION = {
  minCount: 10,
  minSpanMs: 1500,
  /** R = 0.95 is a per-sample circular spread of about 18°. */
  minResultant: 0.95,
} as const;

/** True once enough agreeing samples span long enough to trust the mean. */
export function isCompassSettled(summary: YawSummary | undefined): boolean {
  return (
    summary !== undefined &&
    summary.count >= COMPASS_CALIBRATION.minCount &&
    summary.spanMs >= COMPASS_CALIBRATION.minSpanMs &&
    summary.resultant >= COMPASS_CALIBRATION.minResultant
  );
}

/**
 * Systematic heading error that averaging cannot remove (magnetic
 * disturbance from cars, steel and subway grates), by heading confidence.
 */
const HEADING_FLOOR_DEG: Readonly<Record<ConfidenceLevel, number>> = { high: 6, medium: 12, low: 30 };

/**
 * 68% yaw uncertainty of a compass calibration: the standard error of the
 * circular mean, but never better than the floor for the heading's
 * confidence.
 */
export function compassYawAccuracyDeg(summary: YawSummary, heading: HeadingEstimate | undefined): number {
  const r = Math.min(Math.max(summary.resultant, 1e-6), 1);
  const spreadDeg = Math.sqrt(-2 * Math.log(r)) / DEG;
  const standardError = spreadDeg / Math.sqrt(summary.count);
  return Math.max(standardError, HEADING_FLOOR_DEG[heading?.confidence ?? 'low']);
}

// ---------------------------------------------------------------------------
// Geospatial (ARCore Earth / VPS)

/** 1D normal: the 68.27% half-width is 1σ, the 95% half-width is 1.96σ. */
export function angle68From95(deg95: number): number {
  return deg95 / 1.959964;
}

/**
 * Same thresholds as `solveCompassPlacement`'s confidence, applied to any
 * placement source: high ≤ 10° and ≤ 10 m, medium ≤ 25° and ≤ 25 m.
 */
export function placementConfidence(yawAccuracyDeg: number, horizontalAccuracyM: number): CompassPlacementConfidence {
  if (!(yawAccuracyDeg >= 0) || !(horizontalAccuracyM >= 0)) return 'low';
  if (yawAccuracyDeg <= 10 && horizontalAccuracyM <= 10) return 'high';
  if (yawAccuracyDeg <= 25 && horizontalAccuracyM <= 25) return 'medium';
  return 'low';
}

/** ENU offset `metres` north of a coordinate, as a coordinate (for a reference anchor). */
export function coordinateNorthOf(coordinate: GeographicCoordinate, metres: number): GeographicCoordinate {
  // One degree of latitude is 110.6–111.7 km; at 40.8° N it is about 111.03 km.
  // The anchor solve uses the projected ENU offset, not this nominal distance.
  return { latitude: coordinate.latitude + metres / 111_030, longitude: coordinate.longitude };
}

/** How the world transform was solved. */
export type PlacementSource = 'geospatial' | 'compass';

/** A solved placement with what it is worth. */
export interface NavPlacement {
  readonly placement: EnuPlacement;
  readonly source: PlacementSource;
  readonly confidence: CompassPlacementConfidence;
  /** 68% yaw uncertainty in degrees. */
  readonly yawAccuracyDeg: number;
  /** Along-track distance where it was solved, for {@linkcode shouldResolvePlacement}. */
  readonly solvedAtAlongM: number;
  readonly solvedAtMs: number;
}

/**
 * Whether to re-solve the placement (and then slew to it). Geospatial
 * re-solves every 10 s, and only adopts results whose yaw accuracy is at
 * least 2° better. Compass re-solves after 15 m of walking, where VIO drift
 * and heading error have had room to grow.
 */
export function shouldResolvePlacement(input: {
  readonly current: NavPlacement;
  readonly alongM: number | undefined;
  readonly nowMs: number;
}): boolean {
  if (input.current.source === 'geospatial') return input.nowMs - input.current.solvedAtMs >= 10_000;
  return input.alongM !== undefined && Math.abs(input.alongM - input.current.solvedAtAlongM) >= 15;
}

/** Whether a re-solved placement should replace the current one. */
export function isBetterPlacement(current: NavPlacement, next: NavPlacement): boolean {
  if (current.source === 'compass' && next.source === 'geospatial') return true;
  if (current.source === 'geospatial' && next.source === 'compass') return false;
  if (next.source === 'geospatial') return next.yawAccuracyDeg <= current.yawAccuracyDeg - 2;
  // Compass: a fresh solve near the user beats an old one far behind, unless much worse.
  return next.yawAccuracyDeg <= current.yawAccuracyDeg + 5;
}

// ---------------------------------------------------------------------------
// Presentation

/** Calibration checklist shown while `calibratingAR`. */
export interface CalibrationChecklist {
  readonly gps: 'acquiring' | 'weak' | 'ready';
  readonly camera: 'starting' | 'limited' | 'ready';
  readonly heading: 'waiting' | 'low' | 'ready';
}

/** What the AR screen shows. Each kind decides which 3D content may render. */
export type NavArPresentation =
  | { readonly kind: 'calibrating'; readonly checklist: CalibrationChecklist }
  | { readonly kind: 'speed-paused' }
  | { readonly kind: 'paused' }
  | { readonly kind: 'rerouting' }
  | {
      readonly kind: 'guidance';
      /** `arrow-2d` when the world transform cannot be trusted: no route content in 3D. */
      readonly render: '3d' | 'arrow-2d';
      readonly showDestination: boolean;
      readonly confidence: CompassPlacementConfidence;
    }
  | { readonly kind: 'arrived'; readonly showDestination: boolean; readonly confidence: 'confirmed' | 'estimated' }
  | { readonly kind: 'ended' };

export interface NavArPresentationInput {
  readonly session: NavigationSession;
  readonly positioning: PositioningState;
  readonly arTracking: ArTrackingState;
  readonly placement: NavPlacement | undefined;
  readonly isMatched: boolean;
  readonly headingConfidence: ConfidenceLevel | undefined;
}

function checklist(input: NavArPresentationInput): CalibrationChecklist {
  const p = input.positioning;
  const gps = p.kind !== 'tracking' ? 'acquiring' : p.confidence === 'low' || !input.isMatched ? 'weak' : 'ready';
  const a = input.arTracking;
  const camera = a.kind === 'normal' ? 'ready' : a.kind === 'limited' ? 'limited' : 'starting';
  const heading =
    input.placement !== undefined && input.placement.confidence !== 'low'
      ? 'ready'
      : input.placement !== undefined || input.headingConfidence === 'low'
        ? 'low'
        : 'waiting';
  return { gps, camera, heading };
}

/**
 * Chooses the screen state. Route content is drawn in 3D only when the
 * camera tracks normally, the position is matched to the route, and the
 * placement is at least `medium`; otherwise a 2D arrow stands in, so the
 * app never shows precise-looking 3D content it cannot place.
 */
export function navArPresentation(input: NavArPresentationInput): NavArPresentation {
  const { session } = input;
  if (input.positioning.kind === 'tracking' && input.positioning.isMovingTooFast) return { kind: 'speed-paused' };
  switch (session.phase) {
    case 'calibratingAR':
      return { kind: 'calibrating', checklist: checklist(input) };
    case 'paused':
      return { kind: 'paused' };
    case 'rerouting':
      return { kind: 'rerouting' };
    case 'arrived': {
      const arrival = session.arrival;
      return {
        kind: 'arrived',
        showDestination: input.placement?.confidence === 'high' && input.arTracking.kind === 'normal',
        confidence: arrival.kind === 'arrived' ? arrival.confidence : 'estimated',
      };
    }
    case 'navigatingAR': {
      const placement = input.placement;
      const trusted =
        placement !== undefined &&
        placement.confidence !== 'low' &&
        input.arTracking.kind === 'normal' &&
        input.isMatched &&
        input.positioning.kind === 'tracking' &&
        input.positioning.confidence !== 'low';
      return {
        kind: 'guidance',
        render: trusted ? '3d' : 'arrow-2d',
        showDestination:
          trusted && placement.confidence === 'high' && input.positioning.kind === 'tracking' && input.positioning.confidence === 'high',
        confidence: placement?.confidence ?? 'low',
      };
    }
    default:
      return { kind: 'ended' };
  }
}

/** True when calibration may hand over to `navigatingAR`. */
export function canCompleteCalibration(input: NavArPresentationInput): boolean {
  return (
    input.session.phase === 'calibratingAR' &&
    input.arTracking.kind === 'normal' &&
    input.positioning.kind === 'tracking' &&
    input.isMatched &&
    input.placement !== undefined
  );
}

/** Session phases the AR navigation screen is shown for. */
export function isArNavigationPhase(session: NavigationSession): boolean {
  switch (session.phase) {
    case 'calibratingAR':
    case 'navigatingAR':
      return true;
    case 'rerouting':
    case 'paused':
      return session.resumePhase !== 'navigating';
    default:
      return false;
  }
}

/**
 * Whether the AR route shows the AR navigation screen: an AR phase, or an
 * arrival reached while AR was running (AR tracking still reported), so the
 * arrival card appears in AR instead of dropping to another screen.
 */
export function isArNavigationScreen(session: NavigationSession, arTracking: ArTrackingState): boolean {
  return isArNavigationPhase(session) || (session.phase === 'arrived' && arTracking.kind !== 'off');
}

// ---------------------------------------------------------------------------
// 2D arrow and turn glyphs

/** Where a target lies relative to where the phone points (ARQuest's buckets). */
export type RelativeDirection = 'ahead' | 'left' | 'right' | 'behind';

/** ahead within ±45°, behind beyond ±135°, otherwise left or right. */
export function relativeDirection(relativeDeg: number): RelativeDirection {
  const d = wrapDeg(relativeDeg);
  if (Math.abs(d) <= 45) return 'ahead';
  if (Math.abs(d) >= 135) return 'behind';
  return d < 0 ? 'left' : 'right';
}

/**
 * Bearing from the user's matched point to the route `lookM` metres ahead,
 * capped at the next manoeuvre, so the 2D arrow follows the path and never
 * points across a block at the destination.
 */
export function guidanceBearingDeg(frame: NavRouteFrame, alongM: number, stopAlongM: number | undefined, lookM = 12): number {
  const target = Math.min(alongM + lookM, stopAlongM ?? Number.POSITIVE_INFINITY);
  const from = pointOnFrame(frame, alongM).point;
  const to = pointOnFrame(frame, Math.max(target, alongM + 1)).point;
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  if (Math.hypot(dx, dz) < 0.5) return pointOnFrame(frame, alongM).bearingDeg;
  const bearing = Math.atan2(dx, -dz) / DEG;
  return bearing < 0 ? bearing + 360 : bearing;
}

/** Screen rotation of the 2D arrow: target bearing minus the phone's heading, clockwise. */
export function arrowRotationDeg(targetBearingDeg: number, heading: HeadingEstimate | undefined): number | undefined {
  if (!heading) return undefined;
  return wrapDeg(targetBearingDeg - heading.headingDeg);
}

/** Turn glyph rotation, clockwise degrees from straight ahead; `undefined` for arrive/depart. */
export function maneuverTurnDeg(maneuver: NavigationManeuver | undefined): number | undefined {
  if (!maneuver || maneuver.type === 'arrive' || maneuver.type === 'depart') return undefined;
  switch (maneuver.modifier) {
    case 'uturn':
      return 180;
    case 'sharp-right':
      return 135;
    case 'right':
      return 90;
    case 'slight-right':
      return 45;
    case 'slight-left':
      return -45;
    case 'left':
      return -90;
    case 'sharp-left':
      return -135;
    default:
      return 0;
  }
}

/** Maps Viro's tracking callback (`ViroTrackingStateConstants`, `ViroARTrackingReasonConstants`). */
export function arTrackingFromViro(state: number, reason: number): ArTrackingState {
  if (state === 3) return { kind: 'normal' };
  if (state === 2) {
    return { kind: 'limited', reason: reason === 2 ? 'excessive-motion' : 'insufficient-features' };
  }
  return { kind: 'initializing' };
}
