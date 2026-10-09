import assert from 'node:assert/strict';
import test from 'node:test';
import { isGeneratedPlaceSlug, placeNameSlug, uniquePlaceSlug } from './place-slug.ts';

test('placeNameSlug makes the public path name-led', () => {
  assert.equal(placeNameSlug('The Edge'), 'the-edge');
  assert.equal(placeNameSlug('Rosa’s At Park'), 'rosas-at-park');
  assert.equal(placeNameSlug('St. Nicholas Historic District'), 'st-nicholas-historic-district');
  assert.equal(placeNameSlug('Café & Bar'), 'cafe-bar');
});

test('uniquePlaceSlug suffixes only real collisions', () => {
  const used = new Set(['the-edge', 'the-edge-2']);
  assert.equal(uniquePlaceSlug('The Edge', used), 'the-edge-3');
  assert.equal(uniquePlaceSlug('Apollo Theater', used), 'apollo-theater');
});

test('generated source ids are candidates for a name-led slug', () => {
  assert.equal(isGeneratedPlaceSlug('osm-node-2768136308'), true);
  assert.equal(isGeneratedPlaceSlug('osm-way-1005172029'), true);
  assert.equal(isGeneratedPlaceSlug('lpc-123'), true);
  assert.equal(isGeneratedPlaceSlug('apollo-theater'), false);
});
