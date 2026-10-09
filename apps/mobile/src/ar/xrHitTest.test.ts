import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STREET_PANEL } from './streetPanel.ts';
import { firstHit, rayEntersAabb, tiltedQuadAabb, type HitCandidate, type Vec3 } from './xrHitTest.ts';

const P = STREET_PANEL;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Where a point on the panel (node-local x, y, z) lands in the world. */
function panelPoint(x: number, y: number, z: number): Vec3 {
  const c = Math.cos(toRad(P.tiltXDeg));
  const s = Math.sin(toRad(P.tiltXDeg));
  return [P.position[0] + x, P.position[1] + y * c - z * s, P.position[2] + y * s + z * c];
}

function rayTo(from: Vec3, to: Vec3): { dir: Vec3; distance: number } {
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const len = Math.hypot(d[0]!, d[1]!, d[2]!);
  return { dir: [d[0]! / len, d[1]! / len, d[2]! / len], distance: len };
}

/** The panel's hit nodes as Viro sees them, with or without the street scene's hit props. */
function panelNodes(hand: Vec3, target: { col: number; row: number }, fixed: boolean): HitCandidate[] {
  const nodes: HitCandidate[] = [];
  const backplateCentre = panelPoint(P.columns[target.col]!, P.rows[target.row]!, P.backplateZ);
  nodes.push({
    id: 'backplate',
    box: tiltedQuadAabb(P.position, P.tiltXDeg, { widthM: P.widthM, heightM: P.heightM, offset: [0, 0, P.backplateZ] }),
    surfaceDistance: rayTo(hand, backplateCentre).distance,
    highAccuracy: fixed,
    ignoreEvents: false,
  });
  P.rows.forEach((y, row) =>
    P.columns.forEach((x, col) => {
      const centre = panelPoint(x, y, P.button.z);
      nodes.push({
        id: `button-${col}-${row}`,
        box: tiltedQuadAabb(P.position, P.tiltXDeg, {
          widthM: P.button.widthM,
          heightM: P.button.heightM,
          offset: [x, y, P.button.z],
        }),
        surfaceDistance: col === target.col && row === target.row ? rayTo(hand, centre).distance : null,
        highAccuracy: fixed,
        ignoreEvents: false,
      });
    }),
  );
  return nodes;
}

const HANDS: Record<string, Vec3> = {
  'standing, right hand': [0.2, 1.1, -0.25],
  'seated, right hand': [0.2, 0.8, -0.3],
  'left hand': [-0.2, 1.0, -0.25],
};

describe('rayEntersAabb', () => {
  it('measures the entry distance and misses boxes off the ray', () => {
    const box = { min: [-1, -1, -3] as Vec3, max: [1, 1, -2] as Vec3 };
    assert.equal(rayEntersAabb([0, 0, 0], [0, 0, -1], box), 2);
    assert.equal(rayEntersAabb([0, 0, 0], [0, 0, 1], box), null);
  });
});

describe('street panel buttons under Viro picking', () => {
  it('the tilted backplate box reaches in front of the buttons', () => {
    const plate = tiltedQuadAabb(P.position, P.tiltXDeg, { widthM: P.widthM, heightM: P.heightM, offset: [0, 0, P.backplateZ] });
    // 0.58 m * sin 20 / 2: the box's near face is ~10 cm closer than the panel centre.
    assert.ok(plate.max[2] - P.position[2] > 0.09);
  });

  for (const [name, hand] of Object.entries(HANDS)) {
    it(`bounds-only: the backplate swallows every button (${name})`, () => {
      P.rows.forEach((y, row) =>
        P.columns.forEach((x, col) => {
          const { dir } = rayTo(hand, panelPoint(x, y, P.button.z));
          assert.equal(firstHit(hand, dir, panelNodes(hand, { col, row }, false)), 'backplate');
        }),
      );
    });

    it(`highAccuracyEvents on the panel quads: each ray reaches its button (${name})`, () => {
      P.rows.forEach((y, row) =>
        P.columns.forEach((x, col) => {
          const { dir } = rayTo(hand, panelPoint(x, y, P.button.z));
          assert.equal(firstHit(hand, dir, panelNodes(hand, { col, row }, true)), `button-${col}-${row}`);
        }),
      );
    });
  }
});

describe('ground clicks under Viro picking', () => {
  // A decorative polyline over the ground (grid, route ribbon) is one node
  // whose box covers every point it passes, a few centimetres above the quad.
  const ground: HitCandidate = {
    id: 'ground',
    box: { min: [-500, 0, -500], max: [500, 0, 500] },
    surfaceDistance: null,
    highAccuracy: false,
    ignoreEvents: false,
  };
  const overlay = (ignoreEvents: boolean): HitCandidate => ({
    id: 'overlay',
    box: { min: [-400, -0.01, -400], max: [400, 0.05, 20] },
    surfaceDistance: null,
    highAccuracy: false,
    ignoreEvents,
  });
  const eye: Vec3 = [0, 1.1, -0.2];
  const { dir } = rayTo(eye, [3, 0, -12]);

  it('a ground overlay without ignoreEventHandling swallows the teleport click', () => {
    assert.equal(firstHit(eye, dir, [ground, overlay(false)]), 'overlay');
  });

  it('with ignoreEventHandling the click reaches the ground', () => {
    assert.equal(firstHit(eye, dir, [ground, overlay(true)]), 'ground');
  });
});
