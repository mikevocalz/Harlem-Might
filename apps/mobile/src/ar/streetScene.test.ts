import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAPPED_PLACES } from '@acme/app/features/explore/explore.store.ts';
import { tabletopOrigin } from './arTabletop.ts';
import {
  SNAP_TURN_DEG,
  clampToBounds,
  groundGrid,
  labelScaleForDistance,
  sceneToEnu,
  snapTurn,
  streetBounds,
  streetPillars,
  teleportTarget,
  worldRootTransform,
} from './streetScene.ts';

const apollo = MAPPED_PLACES.find((place) => place.id === 'apollo-theater')!;
const origin = tabletopOrigin(apollo);
const close = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

describe('streetPillars', () => {
  const pillars = streetPillars(origin, MAPPED_PLACES);

  it('places one pillar per mapped place, the origin place at 0,0', () => {
    assert.equal(pillars.length, MAPPED_PLACES.length);
    const home = pillars.find((p) => p.id === 'apollo-theater')!;
    close(home.eastM, 0, 1e-6);
    close(home.northM, 0, 1e-6);
    assert.deepEqual(home.position.map((v) => Math.round(v * 1e6) / 1e6), [0, 0, -0]);
  });

  it('uses WGS84 ENU metres at 1:1, north mapped to -z', () => {
    // Schomburg Center: 760 m east, 506 m north of Apollo (nitro-mapbox-ar
    // ENU fixtures, the same numbers arTabletop.test.ts checks).
    const schomburg = pillars.reduce((a, b) => (b.eastM > a.eastM ? b : a));
    close(schomburg.eastM, 759.958, 0.5);
    close(schomburg.northM, 506.217, 0.5);
    assert.equal(schomburg.position[0], schomburg.eastM);
    assert.equal(schomburg.position[1], 0);
    assert.equal(schomburg.position[2], -schomburg.northM);
  });

  it('skips places without coordinates', () => {
    const only = streetPillars(origin, [{ id: 'x', name: 'X', category: 'Food' }, apollo]);
    assert.deepEqual(only.map((p) => p.id), ['apollo-theater']);
  });
});

describe('streetBounds / clampToBounds', () => {
  const bounds = streetBounds(streetPillars(origin, MAPPED_PLACES), 50);

  it('wraps every pillar with the margin', () => {
    close(bounds.minEastM, -50, 0.5);
    close(bounds.maxEastM, 759.958 + 50, 0.5);
    close(bounds.minNorthM, -622.295 - 50, 0.5);
    close(bounds.maxNorthM, 506.217 + 50, 0.5);
  });

  it('leaves points inside unchanged and pulls outside points to the edge', () => {
    assert.deepEqual(clampToBounds({ eastM: 10, northM: -20 }, bounds), { eastM: 10, northM: -20 });
    const out = clampToBounds({ eastM: 5000, northM: -5000 }, bounds);
    assert.equal(out.eastM, bounds.maxEastM);
    assert.equal(out.northM, bounds.minNorthM);
  });

  it('rejects a negative margin', () => {
    assert.throws(() => streetBounds([], -1), RangeError);
  });
});

describe('snapTurn', () => {
  it('turns 45 degrees by default and wraps to [0, 360)', () => {
    assert.equal(SNAP_TURN_DEG, 45);
    assert.equal(snapTurn(0, 'right'), 45);
    assert.equal(snapTurn(0, 'left'), 315);
    assert.equal(snapTurn(315, 'right'), 0);
    assert.equal(snapTurn(90, 'left', 30), 60);
  });

  it('eight right turns come back to the start', () => {
    let heading = 0;
    for (let i = 0; i < 8; i += 1) heading = snapTurn(heading, 'right');
    assert.equal(heading, 0);
  });

  it('rejects non-finite input', () => {
    assert.throws(() => snapTurn(Number.NaN, 'right'), RangeError);
    assert.throws(() => snapTurn(0, 'right', 0), RangeError);
  });
});

describe('worldRootTransform / sceneToEnu', () => {
  it('puts the user ENU point at the scene origin', () => {
    for (const heading of [0, 45, 90, 225]) {
      const user = { eastM: 120, northM: -40 };
      const t = worldRootTransform(user, heading);
      // world point of the user, transformed by the root, lands on 0,0,0
      const back = sceneToEnu([0, 0, 0], user, heading);
      close(back.eastM, 120, 1e-9);
      close(back.northM, -40, 1e-9);
      assert.deepEqual(t.rotation, [0, heading, 0]);
    }
  });

  it('with no turn, scene -z is north and +x is east', () => {
    const user = { eastM: 10, northM: 20 };
    const ahead = sceneToEnu([0, 0, -3], user, 0);
    close(ahead.eastM, 10);
    close(ahead.northM, 23);
    const right = sceneToEnu([2, 0, 0], user, 0);
    close(right.eastM, 12);
    close(right.northM, 20);
  });

  it('after a 90 degree right turn, straight ahead is east', () => {
    const user = { eastM: 0, northM: 0 };
    const ahead = sceneToEnu([0, 0, -5], user, 90);
    close(ahead.eastM, 5);
    close(ahead.northM, 0);
  });

  it('round-trips a world point through the root transform', () => {
    const user = { eastM: -33, northM: 71 };
    const heading = 135;
    const { position, rotation } = worldRootTransform(user, heading);
    const r = (rotation[1] * Math.PI) / 180;
    const local = [250, 0, -(-90)] as const; // ENU east 250, north -90
    const scene: [number, number, number] = [
      Math.cos(r) * local[0] + Math.sin(r) * local[2] + position[0],
      0,
      -Math.sin(r) * local[0] + Math.cos(r) * local[2] + position[2],
    ];
    const enu = sceneToEnu(scene, user, heading);
    close(enu.eastM, 250, 1e-9);
    close(enu.northM, -90, 1e-9);
  });
});

describe('teleportTarget', () => {
  const bounds = { minEastM: -100, maxEastM: 100, minNorthM: -100, maxNorthM: 100 };

  it('moves the user to the ground point that was clicked', () => {
    const to = teleportTarget([0, 0, -8], { eastM: 5, northM: 5 }, 0, bounds)!;
    close(to.eastM, 5);
    close(to.northM, 13);
  });

  it('clamps a far click to the scene bounds', () => {
    const to = teleportTarget([0, 0, -1000], { eastM: 0, northM: 0 }, 0, bounds)!;
    assert.equal(to.northM, 100);
  });

  it('ignores a malformed hit', () => {
    assert.equal(teleportTarget([Number.NaN, 0, 0], { eastM: 1, northM: 2 }, 0, bounds), null);
    assert.equal(teleportTarget([1, 0], { eastM: 1, northM: 2 }, 0, bounds), null);
  });
});

describe('labelScaleForDistance', () => {
  // 22 pt ViroText is ~1.2 cm per point at scale 1 (HarlemTabletopScene).
  const heightAt = (scale: number) => 22 * 0.012 * scale;

  it('keeps labels at least one degree tall out to 200 m', () => {
    for (const d of [2, 5, 10, 20, 50, 120, 200]) {
      const oneDegree = d * Math.tan(Math.PI / 180);
      assert.ok(heightAt(labelScaleForDistance(d)) >= oneDegree, `too small at ${d} m`);
    }
  });

  it('steps in bands so small moves do not change the scale', () => {
    assert.equal(labelScaleForDistance(11), labelScaleForDistance(14));
  });

  it('never goes below the near-panel scale', () => {
    assert.equal(labelScaleForDistance(0), 0.1);
  });
});

describe('groundGrid', () => {
  const bounds = { minEastM: -20, maxEastM: 20, minNorthM: -10, maxNorthM: 10 };

  it('draws one serpentine per axis with two points per line', () => {
    const [east, north] = groundGrid(bounds, 10, 0.01);
    assert.equal(east!.length, 5 * 2);
    assert.equal(north!.length, 3 * 2);
    // Consecutive lines alternate direction, so the joins run along the edge.
    assert.deepEqual(east![1], [-20, 0.01, -10]);
    assert.deepEqual(east![2], [-10, 0.01, -10]);
  });

  it('rejects a non-positive spacing', () => {
    assert.throws(() => groundGrid(bounds, 0, 0), RangeError);
  });
});
