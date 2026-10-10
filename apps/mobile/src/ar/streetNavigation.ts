import type { RouteLeg } from '@mikevocalz/nitro-mapbox-ar/navigation';
import type { EnuOrigin } from '@mapbox/react-native-mapbox-ar-reactvision/src/types.ts';
import { projectToEnu } from '@mapbox/react-native-mapbox-ar-reactvision/src/enu.ts';
import { DIORAMA_ALTITUDE_M } from './arTabletop.ts';
import type { EnuGround, Vec3 } from './streetScene.ts';

/**
 * Simulated turn-by-turn presentation for the street scene (decision S19,
 * slice 2). The route and the step index come from the shared
 * NavigationSession; this module only turns them into scene geometry. The
 * wearer moves one manoeuvre at a time by teleport, and only when they press
 * Next, Previous or Start.
 */

/** One manoeuvre in the scene's ENU frame. */
export interface NavStep {
  readonly instruction: string;
  readonly kind: string;
  readonly modifier?: string;
  /** Where the manoeuvre happens. */
  readonly at: EnuGround;
  /** Compass bearings (clockwise from north) into and out of the manoeuvre. */
  readonly bearingBeforeDeg: number;
  readonly bearingAfterDeg: number;
  /** Metres from this manoeuvre to the next one. */
  readonly distanceToNextM: number;
  /** Path to the next manoeuvre, starting at `at`. */
  readonly path: readonly EnuGround[];
}

/** Where the wearer stands for a step and which way the world faces. */
export interface StepStance {
  readonly user: EnuGround;
  /** World-root heading (see `worldRootTransform`) that faces the wearer down the street. */
  readonly headingDeg: number;
}

/** How far before a turn the wearer stands, so its indicator is in view ahead. */
export const STANCE_BEFORE_TURN_M = 6;
/** Chevron spacing along the path, and the gap kept clear at both ends. */
export const CHEVRON_SPACING_M = 4;
const CHEVRON_END_GAP_M = 2;
/** Chevron arm length and width, and the half-angle between the arms. */
const CHEVRON_ARM_M = 0.9;
const CHEVRON_ARM_WIDTH_M = 0.22;
const CHEVRON_HALF_ANGLE_DEG = 40;
/** Turn indicator arm lengths, in metres. */
const TURN_IN_M = 5;
const TURN_OUT_M = 6;
const TURN_HEAD_M = 1.6;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const normalize = (deg: number) => ((deg % 360) + 360) % 360;

function direction(bearingDeg: number): EnuGround {
  const r = toRad(bearingDeg);
  return { eastM: Math.sin(r), northM: Math.cos(r) };
}

function offset(p: EnuGround, bearingDeg: number, distanceM: number): EnuGround {
  const d = direction(bearingDeg);
  return { eastM: p.eastM + d.eastM * distanceM, northM: p.northM + d.northM * distanceM };
}

const bearingBetween = (a: EnuGround, b: EnuGround) =>
  normalize((Math.atan2(b.eastM - a.eastM, b.northM - a.northM) * 180) / Math.PI);

/** Projects the session's route steps (all legs, in travel order) into ENU metres from `origin`. */
export function navSteps(origin: EnuOrigin, legs: readonly RouteLeg[]): NavStep[] {
  const toGround = (latitude: number, longitude: number): EnuGround => {
    const enu = projectToEnu(origin, { latitude, longitude, altitude: DIORAMA_ALTITUDE_M });
    return { eastM: enu.eastM, northM: enu.northM };
  };
  const steps = legs.flatMap((leg) => leg.steps);
  return steps.map((step, i) => {
    const at = toGround(step.maneuver.location.latitude, step.maneuver.location.longitude);
    const next = steps[i + 1]?.maneuver.location;
    const path =
      step.geometry && step.geometry.length >= 2
        ? step.geometry.map((c) => toGround(c.latitude, c.longitude))
        : next
          ? [at, toGround(next.latitude, next.longitude)]
          : [at];
    return {
      instruction: step.maneuver.instruction,
      kind: step.maneuver.kind,
      ...(step.maneuver.modifier ? { modifier: step.maneuver.modifier } : {}),
      at,
      bearingBeforeDeg: step.maneuver.bearingBeforeDeg,
      bearingAfterDeg: step.maneuver.bearingAfterDeg,
      distanceToNextM: step.distanceM,
      path,
    };
  });
}

/**
 * The world-root heading at which the wearer, looking down the scene's -z,
 * faces compass `bearingDeg`. Heading 0 faces north and a right turn adds
 * degrees (`snapTurn`), so the heading is the bearing itself.
 */
export function headingForBearing(bearingDeg: number): number {
  if (!Number.isFinite(bearingDeg)) throw new RangeError('bearingDeg must be finite');
  return normalize(bearingDeg);
}

/**
 * Where to stand for a step. At the departure the wearer stands on the start
 * facing the first street. For every other step they stand
 * {@linkcode STANCE_BEFORE_TURN_M} short of the manoeuvre, facing the way they
 * arrive, so the turn (or the destination) is straight ahead.
 */
export function stanceForStep(step: NavStep): StepStance {
  if (step.kind === 'depart') {
    return { user: step.at, headingDeg: headingForBearing(step.bearingAfterDeg) };
  }
  return {
    user: offset(step.at, step.bearingBeforeDeg + 180, STANCE_BEFORE_TURN_M),
    headingDeg: headingForBearing(step.bearingBeforeDeg),
  };
}

/** A flat mesh on the ground, in the world-root frame. */
export interface GroundMesh {
  readonly vertices: [number, number, number][];
  readonly normals: [number, number, number][];
  readonly texcoords: [number, number][];
  /** One flat index list (one submesh), as ViroGeometry's native side reads it. */
  readonly indices: number[];
}

/**
 * Chevrons every {@linkcode CHEVRON_SPACING_M} along a path, each pointing
 * the way the path runs, so a row of them leads to the next manoeuvre rather
 * than straight at the destination. Every chevron is two flat arms meeting at
 * its tip; triangles face up (+y), so back-face culling keeps them visible
 * from above.
 */
export function chevronMesh(path: readonly EnuGround[], liftM: number): GroundMesh {
  const mesh: GroundMesh = { vertices: [], normals: [], texcoords: [], indices: [] };
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    const d = Math.hypot(path[i]!.eastM - path[i - 1]!.eastM, path[i]!.northM - path[i - 1]!.northM);
    lengths.push(d);
    total += d;
  }
  const quad = (a: EnuGround, b: EnuGround, halfWidth: number) => {
    const len = Math.hypot(b.eastM - a.eastM, b.northM - a.northM);
    if (len === 0) return;
    // Left of travel in ENU is (-dn, de).
    const le = (-(b.northM - a.northM) / len) * halfWidth;
    const ln = ((b.eastM - a.eastM) / len) * halfWidth;
    const base = mesh.vertices.length;
    for (const [e, n] of [
      [a.eastM - le, a.northM - ln],
      [b.eastM - le, b.northM - ln],
      [b.eastM + le, b.northM + ln],
      [a.eastM + le, a.northM + ln],
    ] as const) {
      mesh.vertices.push([e, liftM, -n]);
      mesh.normals.push([0, 1, 0]);
      mesh.texcoords.push([0, 0]);
    }
    // a-right, b-right, b-left, a-left run counter-clockwise seen from above
    // (+y) in Viro's axes, where +x is east and -z is north.
    mesh.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  for (let s = CHEVRON_END_GAP_M; s <= total - CHEVRON_END_GAP_M; s += CHEVRON_SPACING_M) {
    let remaining = s;
    let segment = 0;
    while (segment < lengths.length - 1 && remaining > lengths[segment]!) {
      remaining -= lengths[segment]!;
      segment += 1;
    }
    const a = path[segment]!;
    const b = path[segment + 1]!;
    const t = lengths[segment]! === 0 ? 0 : remaining / lengths[segment]!;
    const tip = { eastM: a.eastM + (b.eastM - a.eastM) * t, northM: a.northM + (b.northM - a.northM) * t };
    const heading = bearingBetween(a, b);
    quad(offset(tip, heading + 180 - CHEVRON_HALF_ANGLE_DEG, CHEVRON_ARM_M), tip, CHEVRON_ARM_WIDTH_M / 2);
    quad(offset(tip, heading + 180 + CHEVRON_HALF_ANGLE_DEG, CHEVRON_ARM_M), tip, CHEVRON_ARM_WIDTH_M / 2);
  }
  return mesh;
}

/**
 * A turn indicator lying on the ground at a manoeuvre, in the world-root
 * frame at height `liftM`: the street in, the street out, and a two-stroke
 * head. Uses the real bearings, so a slight turn draws as a slight turn.
 */
export function turnIndicator(step: NavStep, liftM: number): Vec3[] {
  const toScene = (p: EnuGround): Vec3 => [p.eastM, liftM, -p.northM];
  const tail = offset(step.at, step.bearingBeforeDeg + 180, TURN_IN_M);
  const tip = offset(step.at, step.bearingAfterDeg, TURN_OUT_M);
  const left = offset(tip, step.bearingAfterDeg + 180 - 35, TURN_HEAD_M);
  const right = offset(tip, step.bearingAfterDeg + 180 + 35, TURN_HEAD_M);
  return [toScene(tail), toScene(step.at), toScene(tip), toScene(left), toScene(tip), toScene(right)];
}

/** "185 m" or "1.2 km". */
export function formatDistance(distanceM: number): string {
  if (!(distanceM >= 0)) return '';
  if (distanceM < 950) return `${Math.max(5, Math.round(distanceM / 5) * 5)} m`;
  return `${(distanceM / 1000).toFixed(1)} km`;
}

/** The panel's two lines for the current step. */
export function stepLines(steps: readonly NavStep[], index: number): { title: string; detail: string } {
  const step = steps[index];
  if (!step) return { title: '', detail: '' };
  const position = `Step ${index + 1} of ${steps.length}`;
  if (step.kind === 'arrive') return { title: step.instruction, detail: `${position} · You have arrived` };
  return { title: step.instruction, detail: `${position} · Next turn in ${formatDistance(step.distanceToNextM)}` };
}

/** Total metres of a set of steps. */
export function routeDistanceM(steps: readonly NavStep[]): number {
  return steps.reduce((sum, step) => sum + step.distanceToNextM, 0);
}
