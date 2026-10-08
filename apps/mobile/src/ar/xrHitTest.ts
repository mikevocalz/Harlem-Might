/**
 * A model of how Viro picks the node under a controller ray, so the street
 * scene's hit surfaces can be checked without a headset.
 *
 * Viro tests every node against its world-space axis-aligned bounding box
 * unless the node sets `highAccuracyEvents`, and the closest box wins
 * (~/virocore/ViroRenderer/VRONode.cpp `VRONode::hitTest`,
 * VROInputControllerBase.cpp `hitTest`). A node with `ignoreEventHandling` is
 * skipped. Whatever node wins, its click bubbles to the nearest ancestor with
 * a handler, and a node with no such ancestor swallows the click.
 *
 * The box of a tilted quad is deep: tilt a 58 cm panel back by 20 degrees and
 * its box reaches 10 cm toward the wearer, in front of every button on it.
 */

export type Vec3 = readonly [number, number, number];

export interface Aabb {
  readonly min: Vec3;
  readonly max: Vec3;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * World box of a quad in a node at `origin` rotated `tiltXDeg` about x (Viro's
 * rotation order for a pure x rotation). The quad sits at `offset` in the
 * node, facing +z.
 */
export function tiltedQuadAabb(
  origin: Vec3,
  tiltXDeg: number,
  quad: { readonly widthM: number; readonly heightM: number; readonly offset: Vec3 },
): Aabb {
  const c = Math.cos(toRad(tiltXDeg));
  const s = Math.sin(toRad(tiltXDeg));
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const dx of [-0.5, 0.5]) {
    for (const dy of [-0.5, 0.5]) {
      const x = quad.offset[0] + dx * quad.widthM;
      const y = quad.offset[1] + dy * quad.heightM;
      const z = quad.offset[2];
      const world = [origin[0] + x, origin[1] + y * c - z * s, origin[2] + y * s + z * c];
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i]!, world[i]!);
        max[i] = Math.max(max[i]!, world[i]!);
      }
    }
  }
  return { min: min as unknown as Vec3, max: max as unknown as Vec3 };
}

/** Distance along a unit ray to where it enters `box`, or null when it misses (slab test). */
export function rayEntersAabb(origin: Vec3, dir: Vec3, box: Aabb): number | null {
  let tMin = 0;
  let tMax = Infinity;
  for (let i = 0; i < 3; i++) {
    const o = origin[i]!;
    const d = dir[i]!;
    const lo = box.min[i]!;
    const hi = box.max[i]!;
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return null;
      continue;
    }
    const a = (lo - o) / d;
    const b = (hi - o) / d;
    tMin = Math.max(tMin, Math.min(a, b));
    tMax = Math.min(tMax, Math.max(a, b));
    if (tMin > tMax) return null;
  }
  return tMin;
}

export interface HitCandidate {
  readonly id: string;
  /** The box Viro tests when the node is bounds-only. */
  readonly box: Aabb;
  /** Distance to the real surface, used when the node sets `highAccuracyEvents`. */
  readonly surfaceDistance: number | null;
  readonly highAccuracy: boolean;
  readonly ignoreEvents: boolean;
}

/** The node Viro would hand the click to before bubbling, or null for the background. */
export function firstHit(origin: Vec3, dir: Vec3, nodes: readonly HitCandidate[]): string | null {
  let best: { id: string; d: number } | null = null;
  for (const node of nodes) {
    const entry = rayEntersAabb(origin, dir, node.box);
    if (entry === null) continue;
    const d = node.highAccuracy ? node.surfaceDistance : entry;
    if (d === null) continue;
    if (node.ignoreEvents) continue;
    if (!best || d < best.d) best = { id: node.id, d };
  }
  return best?.id ?? null;
}
