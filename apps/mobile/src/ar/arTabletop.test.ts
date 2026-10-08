import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAPPED_PLACES } from '@acme/app/features/explore/explore.store.ts';
import {
  MAX_WORLD_TO_TABLE_SCALE,
  MIN_WORLD_TO_TABLE_SCALE,
  fitTabletopScale,
  placeEnuExtent,
  planeLocalFromWorld,
  tabletopOrigin,
} from './arTabletop.ts';

const apollo = MAPPED_PLACES.find((place) => place.id === 'apollo-theater')!;

describe('tabletopOrigin', () => {
  it('is the place itself, as WGS84 lat/lng', () => {
    const origin = tabletopOrigin(apollo);
    assert.deepEqual(origin.frame, { kind: 'place', placeId: 'apollo-theater' });
    assert.equal(origin.latitude, 40.8100895);
    assert.equal(origin.longitude, -73.9499948);
  });

  it('returns the same object for the same place', () => {
    assert.equal(tabletopOrigin(apollo), tabletopOrigin(apollo));
  });

  it('throws for a place without coordinates', () => {
    assert.throws(() => tabletopOrigin({ id: 'strivers-row' }), /no coordinates/);
  });
});

describe('placeEnuExtent', () => {
  it('measures the six mapped places on WGS84 from Apollo', () => {
    const extent = placeEnuExtent(tabletopOrigin(apollo), MAPPED_PLACES);
    // Apollo is the westmost place; the Schomburg is 760 m east and 506 m
    // north, Marcus Garvey Park 622 m south (nitro-mapbox-ar ENU fixtures).
    assert.ok(Math.abs(extent.minEastM - 0) < 0.5);
    assert.ok(Math.abs(extent.maxEastM - 759.958) < 0.5);
    assert.ok(Math.abs(extent.maxNorthM - 506.217) < 0.5);
    assert.ok(Math.abs(extent.minNorthM - -622.295) < 0.5);
  });
});

describe('fitTabletopScale', () => {
  const extent = placeEnuExtent(tabletopOrigin(apollo), MAPPED_PLACES);
  const widthM = extent.maxEastM - extent.minEastM;
  const depthM = extent.maxNorthM - extent.minNorthM;

  it('fits all six places on a 0.65 x 0.45 m plane', () => {
    const scale = fitTabletopScale(extent, { widthM: 0.65, depthM: 0.45 });
    assert.ok(widthM / scale <= 0.65 * 0.85 + 1e-9);
    assert.ok(depthM / scale <= 0.45 * 0.85 + 1e-9);
  });

  it('fills the limiting axis of the plane', () => {
    const scale = fitTabletopScale(extent, { widthM: 0.65, depthM: 0.45 });
    assert.ok(Math.abs(depthM / scale - 0.45 * 0.85) < 1e-6);
  });

  it('clamps to 1:1500 on a large table and 1:4000 on a small one', () => {
    assert.equal(fitTabletopScale(extent, { widthM: 3, depthM: 3 }), MIN_WORLD_TO_TABLE_SCALE);
    assert.equal(fitTabletopScale(extent, { widthM: 0.1, depthM: 0.1 }), MAX_WORLD_TO_TABLE_SCALE);
  });

  it('rejects non-positive plane sizes and margins', () => {
    assert.throws(() => fitTabletopScale(extent, { widthM: 0, depthM: 0.4 }), RangeError);
    assert.throws(() => fitTabletopScale(extent, { widthM: 0.6, depthM: 0.4 }, 0), RangeError);
    assert.throws(() => fitTabletopScale(extent, { widthM: 0.6, depthM: 0.4 }, 1.2), RangeError);
  });
});

describe('planeLocalFromWorld', () => {
  const near = (a: readonly number[], b: readonly number[]) =>
    a.forEach((v, i) => assert.ok(Math.abs(v - b[i]!) < 1e-9, `${a} vs ${b}`));

  it('subtracts the anchor position with no rotation', () => {
    near(planeLocalFromWorld([1, 2, 3], { position: [1, 1, 1], rotation: [0, 0, 0] }), [0, 1, 2]);
  });

  it('undoes a 90 degree yaw', () => {
    // A plane yawed +90° about Y: its local +x points along world -z.
    near(planeLocalFromWorld([0, 0, -1], { position: [0, 0, 0], rotation: [0, 90, 0] }), [1, 0, 0]);
  });
});
