import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { directionsUrl, noResultsCopy, placeRowLine, resultsSummary } from './explore-copy.ts';

describe('resultsSummary', () => {
  it('names the filter and the map gap', () => {
    assert.equal(resultsSummary(8, 6, '', 'All', 'All'), '8 places, 6 on the map.');
    assert.equal(resultsSummary(1, 1, 'apollo', 'All', 'All'), '1 place matching “apollo”.');
    assert.equal(resultsSummary(3, 3, '', 'Culture', 'All'), '3 places in Culture.');
    assert.equal(resultsSummary(0, 0, 'zzzz', 'Food', 'All'), 'No places matching “zzzz” in Food.');
    assert.equal(resultsSummary(0, 0, '', 'All', 'All'), 'No places.');
  });
});

describe('placeRowLine', () => {
  it('prefers the street and flags a missing map point', () => {
    assert.equal(placeRowLine({ category: 'Music', street: '253 W 125th St', area: 'Central Harlem', lngLat: [-73.95, 40.81] }), 'Music, 253 W 125th St');
    assert.equal(placeRowLine({ category: 'Food', area: 'Central Harlem' }), 'Food, Central Harlem, location pending');
  });
});

describe('noResultsCopy', () => {
  it('quotes the query and names the category', () => {
    assert.equal(
      noResultsCopy(' zz ', 'Food', 'All'),
      'Nothing in the catalogue matches “zz” in Food. Search looks at names, areas, categories and tags.',
    );
    assert.equal(noResultsCopy('', 'All', 'All'), 'Nothing in the catalogue matches. Search looks at names, areas, categories and tags.');
  });
});

describe('directionsUrl', () => {
  it('puts latitude first', () => {
    assert.equal(directionsUrl([-73.95, 40.81]), 'https://www.google.com/maps/dir/?api=1&destination=40.81,-73.95');
  });
});
