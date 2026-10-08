import type { EnuOrigin } from '@mapbox/react-native-mapbox-ar-reactvision/src/types.ts';
import { projectToEnu } from '@mapbox/react-native-mapbox-ar-reactvision/src/enu.ts';
import { DIORAMA_ALTITUDE_M } from './arTabletop.ts';

/**
 * Pure math for the street-scale VR scene (decision S19, slice 1). The scene
 * is 1:1 metres around a WGS84 origin at the selected place. Viro's frame is
 * y up, x east, z = -north (the same convention as `enuToViroPosition`).
 *
 * The user never moves: teleport and snap turn move a world-root node, so the
 * head pose stays the wearer's own (no camera motion without input).
 */

export type Vec3 = readonly [number, number, number];

/** A point on the ground, in metres east and north of the scene origin. */
export interface EnuGround {
  readonly eastM: number;
  readonly northM: number;
}

export interface StreetBounds {
  readonly minEastM: number;
  readonly maxEastM: number;
  readonly minNorthM: number;
  readonly maxNorthM: number;
}

/** A place as the street scene reads it: `lngLat` is `[longitude, latitude]`. */
export interface StreetPlace {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly lngLat?: readonly [number, number];
}

export interface StreetPillar extends EnuGround {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  /** Pillar foot in the world-root frame. */
  readonly position: Vec3;
}

/** Default snap-turn step. Meta's comfort guidance is 30 to 45 degrees. */
export const SNAP_TURN_DEG = 45;

/** Every place with coordinates, projected once to ENU metres from `origin`. */
export function streetPillars(origin: EnuOrigin, places: readonly StreetPlace[]): StreetPillar[] {
  const pillars: StreetPillar[] = [];
  for (const place of places) {
    if (!place.lngLat) continue;
    const enu = projectToEnu(origin, {
      latitude: place.lngLat[1],
      longitude: place.lngLat[0],
      altitude: DIORAMA_ALTITUDE_M,
    });
    pillars.push({
      id: place.id,
      name: place.name,
      category: place.category,
      eastM: enu.eastM,
      northM: enu.northM,
      position: [enu.eastM, 0, -enu.northM],
    });
  }
  return pillars;
}

/**
 * The walkable area: every pillar plus the origin, grown by `marginM`.
 * @throws {RangeError} When `marginM` is negative or not finite.
 */
export function streetBounds(pillars: readonly EnuGround[], marginM: number): StreetBounds {
  if (!(marginM >= 0) || !Number.isFinite(marginM)) throw new RangeError('marginM must be >= 0');
  let minEastM = 0;
  let maxEastM = 0;
  let minNorthM = 0;
  let maxNorthM = 0;
  for (const p of pillars) {
    minEastM = Math.min(minEastM, p.eastM);
    maxEastM = Math.max(maxEastM, p.eastM);
    minNorthM = Math.min(minNorthM, p.northM);
    maxNorthM = Math.max(maxNorthM, p.northM);
  }
  return {
    minEastM: minEastM - marginM,
    maxEastM: maxEastM + marginM,
    minNorthM: minNorthM - marginM,
    maxNorthM: maxNorthM + marginM,
  };
}

export function clampToBounds(point: EnuGround, bounds: StreetBounds): EnuGround {
  return {
    eastM: Math.min(bounds.maxEastM, Math.max(bounds.minEastM, point.eastM)),
    northM: Math.min(bounds.maxNorthM, Math.max(bounds.minNorthM, point.northM)),
  };
}

/**
 * The heading after one snap turn, in [0, 360). A right turn adds `stepDeg`:
 * the world root rotates counter-clockwise seen from above, which reads as the
 * wearer turning right.
 * @throws {RangeError} When `headingDeg` is not finite or `stepDeg` is not positive.
 */
export function snapTurn(headingDeg: number, direction: 'left' | 'right', stepDeg = SNAP_TURN_DEG): number {
  if (!Number.isFinite(headingDeg)) throw new RangeError('headingDeg must be finite');
  if (!(stepDeg > 0) || !Number.isFinite(stepDeg)) throw new RangeError('stepDeg must be positive');
  const next = headingDeg + (direction === 'right' ? stepDeg : -stepDeg);
  return ((next % 360) + 360) % 360;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Position and rotation for the world-root node that puts `user` (an ENU
 * ground point) at the scene origin, facing `headingDeg`. Viro rotates about
 * +Y counter-clockwise seen from above: scene = R(heading)·local + position.
 */
export function worldRootTransform(
  user: EnuGround,
  headingDeg: number,
): { position: [number, number, number]; rotation: [number, number, number] } {
  const r = toRad(headingDeg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const x = user.eastM;
  const z = -user.northM;
  return {
    position: [-(c * x + s * z), 0, -(-s * x + c * z)],
    rotation: [0, headingDeg, 0],
  };
}

/** Inverse of {@linkcode worldRootTransform}: a scene point back to ENU ground metres. */
export function sceneToEnu(scene: Vec3, user: EnuGround, headingDeg: number): EnuGround {
  const { position } = worldRootTransform(user, headingDeg);
  const r = toRad(headingDeg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const dx = scene[0] - position[0];
  const dz = scene[2] - position[2];
  const x = c * dx - s * dz;
  const z = s * dx + c * dz;
  return { eastM: x, northM: -z };
}

/**
 * Where a ground click teleports the user: the clicked point, clamped to the
 * scene bounds. Returns null for a hit Viro did not report as a 3D point.
 */
export function teleportTarget(
  hit: readonly number[],
  user: EnuGround,
  headingDeg: number,
  bounds: StreetBounds,
): EnuGround | null {
  if (hit.length < 3 || !hit.every((v) => Number.isFinite(v))) return null;
  return clampToBounds(sceneToEnu([hit[0]!, hit[1]!, hit[2]!], user, headingDeg), bounds);
}

/** ViroText height per point at scale 1, in metres (HarlemTabletopScene). */
const VIRO_TEXT_M_PER_PT = 0.012;
/** The label font size the scene uses. */
export const LABEL_FONT_PT = 22;
/** Scale that keeps a panel label one degree tall at 1.5 m. */
const NEAR_LABEL_SCALE = 0.1;
const DISTANCE_BANDS_M = [1.5, 3, 5, 10, 15, 20, 30, 40, 60, 80, 120, 160, 240];

/**
 * ViroText scale that keeps a {@linkcode LABEL_FONT_PT} label at least one
 * degree of visual angle tall at `distanceM` (Meta's minimum text size). The
 * distance is rounded up to a band, so the scale only changes when the user
 * crosses a band edge rather than on every teleport.
 */
export function labelScaleForDistance(distanceM: number): number {
  const d = Math.max(0, distanceM);
  const band = DISTANCE_BANDS_M.find((edge) => d <= edge) ?? Math.ceil(d / 80) * 80;
  const needed = (band * Math.tan(toRad(1))) / (LABEL_FONT_PT * VIRO_TEXT_M_PER_PT);
  return Math.max(NEAR_LABEL_SCALE, Math.ceil(needed * 100) / 100);
}

/** Horizontal distance between two ground points. */
export function groundDistanceM(a: EnuGround, b: EnuGround): number {
  return Math.hypot(a.eastM - b.eastM, a.northM - b.northM);
}

/**
 * Grid lines for the ground as two serpentine polylines (one draw call each).
 * The connecting segments run along the bounds' edges, so they draw the
 * border. Points are in the world-root frame at height `liftM`.
 */
export function groundGrid(bounds: StreetBounds, spacingM: number, liftM: number): Vec3[][] {
  if (!(spacingM > 0)) throw new RangeError('spacingM must be positive');
  const eastLines: Vec3[] = [];
  const startE = Math.ceil(bounds.minEastM / spacingM) * spacingM;
  let flip = false;
  for (let e = startE; e <= bounds.maxEastM; e += spacingM) {
    const a: Vec3 = [e, liftM, -bounds.minNorthM];
    const b: Vec3 = [e, liftM, -bounds.maxNorthM];
    eastLines.push(...(flip ? [b, a] : [a, b]));
    flip = !flip;
  }
  const northLines: Vec3[] = [];
  const startN = Math.ceil(bounds.minNorthM / spacingM) * spacingM;
  flip = false;
  for (let n = startN; n <= bounds.maxNorthM; n += spacingM) {
    const a: Vec3 = [bounds.minEastM, liftM, -n];
    const b: Vec3 = [bounds.maxEastM, liftM, -n];
    northLines.push(...(flip ? [b, a] : [a, b]));
    flip = !flip;
  }
  return [eastLines, northLines];
}
