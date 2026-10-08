import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { exploreHref, focusId, focusReturnOrder, isFocusFor, parseExploreParams } from './explore-url.ts';

const CATS = ['All', 'Food', 'Culture'] as const;
const read = (s: string) => new URLSearchParams(s);

describe('parseExploreParams', () => {
  it('reads every key', () => {
    assert.deepEqual(parseExploreParams(read('view=list&q=apollo&category=Culture&place=apollo-theater'), CATS, 'All'), {
      view: 'list',
      q: 'apollo',
      category: 'Culture',
      placeId: 'apollo-theater',
    });
  });

  it('falls back on unknown values', () => {
    assert.deepEqual(parseExploreParams(read('view=grid&category=Bars'), CATS, 'All'), {
      view: 'map',
      q: '',
      category: 'All',
      placeId: null,
    });
  });
});

describe('exploreHref', () => {
  it('sets, replaces and removes keys', () => {
    assert.equal(exploreHref('/explore', 'q=apollo', { place: 'apollo-theater' }), '/explore?q=apollo&place=apollo-theater');
    assert.equal(exploreHref('/explore', 'q=apollo&place=x', { place: null }), '/explore?q=apollo');
    assert.equal(exploreHref('/explore', 'q=a', { q: '' }), '/explore');
  });
});

describe('focusReturnOrder', () => {
  it('prefers the opener, then the row, then the marker, without repeats', () => {
    assert.deepEqual(focusReturnOrder(focusId.marker('a'), 'a'), ['marker:a', 'row:a']);
    assert.deepEqual(focusReturnOrder(focusId.row('a'), 'a'), ['row:a', 'marker:a']);
    assert.deepEqual(focusReturnOrder(null, 'a'), ['row:a', 'marker:a']);
    assert.deepEqual(focusReturnOrder(null, null), []);
  });
});

describe('isFocusFor', () => {
  it('matches only the place\'s own row and marker', () => {
    assert.equal(isFocusFor(focusId.row('apollo-theater'), 'apollo-theater'), true);
    assert.equal(isFocusFor(focusId.marker('apollo-theater'), 'apollo-theater'), true);
    assert.equal(isFocusFor(focusId.row('sylvias'), 'apollo-theater'), false);
    assert.equal(isFocusFor('search', 'apollo-theater'), false);
  });
});
