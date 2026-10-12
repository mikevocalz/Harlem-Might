import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HARLEM_CATEGORIES } from './place-model.ts';
import {
  HARLEM_PLACE_PREVIEWS,
  MAPPED_PLACES,
  UNMAPPED_PLACES,
  filterHarlemPlacePreviews,
  getHarlemPlacePreview,
  nearbyPlaces,
  placesNear,
} from './place-previews.ts';

describe('preview catalogue', () => {
  it('keeps lookups and filtered lists in the original catalogue identity space', () => {
    const first = HARLEM_PLACE_PREVIEWS[0]!;
    assert.equal(getHarlemPlacePreview(first.id), first);
    assert.equal(filterHarlemPlacePreviews(first.name, 'All')[0], first);
    assert.deepEqual(filterHarlemPlacePreviews('', 'All'), HARLEM_PLACE_PREVIEWS);
    for (const category of HARLEM_CATEGORIES.slice(1)) {
      assert.deepEqual(
        filterHarlemPlacePreviews('', category),
        HARLEM_PLACE_PREVIEWS.filter((place) => place.category === category),
      );
    }
  });

  it('returns null for missing, null or omitted place ids', () => {
    assert.equal(getHarlemPlacePreview('missing'), null);
    assert.equal(getHarlemPlacePreview(null), null);
    assert.equal(getHarlemPlacePreview(), null);
  });

  it('partitions mapped and unmapped places without changing records or order', () => {
    assert.deepEqual(MAPPED_PLACES, HARLEM_PLACE_PREVIEWS.filter((place) => place.lngLat));
    assert.deepEqual(UNMAPPED_PLACES, HARLEM_PLACE_PREVIEWS.filter((place) => !place.lngLat));
    assert.equal(MAPPED_PLACES.length + UNMAPPED_PLACES.length, HARLEM_PLACE_PREVIEWS.length);
    for (const place of [...MAPPED_PLACES, ...UNMAPPED_PLACES]) {
      assert.equal(getHarlemPlacePreview(place.id), place);
    }
  });
});

describe('preview proximity', () => {
  it('lists the closest mapped places with distances, nearest first', () => {
    const near = nearbyPlaces('sylvias-restaurant', 3);
    assert.equal(near.length, 3);
    const [first, second, third] = near.map((n) => n.meters);
    assert.equal(near[0]?.place.id, 'red-rooster-harlem');
    assert.ok(first! < second! && second! <= third!);
    assert.deepEqual(placesNear('sylvias-restaurant', 3), near.map((n) => n.place));
    assert.ok(near.every((n) => n.place.id !== 'sylvias-restaurant'));
  });

  it('gives no distances from a place without coordinates or an unknown id', () => {
    assert.deepEqual(nearbyPlaces('strivers-row'), []);
    assert.deepEqual(nearbyPlaces('missing'), []);
    assert.deepEqual(placesNear('strivers-row', 2), MAPPED_PLACES.slice(0, 2));
    assert.deepEqual(placesNear('missing', 2), MAPPED_PLACES.slice(0, 2));
  });
});
