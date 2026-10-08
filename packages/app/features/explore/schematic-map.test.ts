import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HARLEM_PLACE_PREVIEWS, MAPPED_PLACES, UNMAPPED_PLACES, type HarlemPlacePreview } from './explore.store.ts';
import { markerLabel, projectSchematic } from './schematic-map.ts';

describe('projectSchematic', () => {
  it('places only mapped places, inside 0–100%', () => {
    const points = projectSchematic(HARLEM_PLACE_PREVIEWS);
    assert.equal(points.length, MAPPED_PLACES.length);
    for (const unmapped of UNMAPPED_PLACES) {
      assert.ok(!points.some((p) => p.placeId === unmapped.id), unmapped.id);
    }
    for (const p of points) {
      assert.ok(p.xPercent >= 0 && p.xPercent <= 100 && p.yPercent >= 0 && p.yPercent <= 100, p.placeId);
    }
  });

  it('keeps north up and west left', () => {
    const points = new Map(projectSchematic(HARLEM_PLACE_PREVIEWS).map((p) => [p.placeId, p]));
    // Schomburg is the northernmost and easternmost seed; Marcus Garvey Park the southernmost.
    assert.equal(points.get('schomburg-center')?.yPercent, 0);
    assert.equal(points.get('marcus-garvey-park')?.yPercent, 100);
    assert.equal(points.get('apollo-theater')?.xPercent, 0);
    assert.equal(points.get('schomburg-center')?.xPercent, 100);
  });

  it('centres a single place instead of dividing by zero', () => {
    const first = MAPPED_PLACES[0] as HarlemPlacePreview;
    assert.deepEqual(projectSchematic([first]), [{ placeId: first.id, xPercent: 50, yPercent: 50 }]);
  });
});

describe('markerLabel', () => {
  it('keeps short names and truncates long ones at 18 characters', () => {
    assert.equal(markerLabel('Apollo Theater'), 'Apollo Theater');
    assert.equal(markerLabel('The Studio Museum in Harlem'), 'The Studio Museum…');
  });
});
