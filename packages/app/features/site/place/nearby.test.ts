import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HARLEM_PLACE_PREVIEWS, getHarlemPlacePreview } from '@acme/app/features/explore/explore.store.ts';
import { NEARBY_MAX, formatDistance, nearbyLayout, nearbyPlaces } from './nearby.ts';

// Points about 111 m apart per 0.001° of latitude.
type Point = { id: string; lngLat?: readonly [number, number] };
const at = (id: string, lat: number): Point => ({ id, lngLat: [-73.95, lat] });
const origin = at('origin', 40.81);
const ring = [at('a', 40.811), at('b', 40.812), at('c', 40.813), at('d', 40.814), at('e', 40.815)];

describe('nearbyPlaces', () => {
  it('caps at four, nearest first, never the origin itself', () => {
    const got = nearbyPlaces(origin, [origin, ...ring]);
    assert.equal(got.length, NEARBY_MAX);
    assert.deepEqual(got.map((n) => n.place.id), ['a', 'b', 'c', 'd']);
  });

  for (const count of [4, 3, 2, 1] as const) {
    it(`returns ${count} when ${count} mapped candidates exist`, () => {
      assert.equal(nearbyPlaces(origin, ring.slice(0, count)).length, count);
    });
  }

  it('skips candidates without a map point', () => {
    const got = nearbyPlaces(origin, [{ id: 'pending' }, ring[0]!]);
    assert.deepEqual(got.map((n) => n.place.id), ['a']);
  });

  it('returns nothing for an origin without a map point', () => {
    assert.deepEqual(nearbyPlaces({ id: 'pending' }, ring), []);
  });

  it('drops candidates beyond the radius', () => {
    assert.deepEqual(nearbyPlaces(origin, [at('far', 40.83)]), []);
  });
});

describe('nearbyLayout', () => {
  it('bento from two, a single card for one, nothing for none', () => {
    assert.equal(nearbyLayout(4), 'bento');
    assert.equal(nearbyLayout(3), 'bento');
    assert.equal(nearbyLayout(2), 'bento');
    assert.equal(nearbyLayout(1), 'single');
    assert.equal(nearbyLayout(0), 'none');
  });
});

describe('formatDistance', () => {
  it('rounds metres to 10 and switches to km at a kilometre', () => {
    assert.equal(formatDistance(3), '10 m');
    assert.equal(formatDistance(354), '350 m');
    assert.equal(formatDistance(994), '990 m');
    assert.equal(formatDistance(995), '1.0 km');
    assert.equal(formatDistance(1234), '1.2 km');
  });
});

describe('catalogue cases', () => {
  const near = (id: string) => nearbyPlaces(getHarlemPlacePreview(id)!, HARLEM_PLACE_PREVIEWS);

  it('Apollo, Studio Museum and Sylvia’s each get a four-module bento', () => {
    for (const id of ['apollo-theater', 'studio-museum-harlem', 'sylvias-restaurant']) {
      assert.equal(nearbyLayout(near(id).length), 'bento', id);
    }
  });

  it('places without coordinates get no nearby section', () => {
    for (const id of ['national-black-theatre', 'strivers-row']) {
      assert.equal(getHarlemPlacePreview(id)!.lngLat, undefined);
      assert.equal(nearbyLayout(near(id).length), 'none', id);
    }
  });
});
