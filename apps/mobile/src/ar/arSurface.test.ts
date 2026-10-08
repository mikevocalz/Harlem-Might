import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { acceptsGameSurface } from '@acme/spatial/arSurface';

const plane = (classification: string, alignment = 'HorizontalUpward') => ({
  type: 'plane',
  alignment,
  classification,
});

describe('acceptsGameSurface', () => {
  it('accepts room-model tables and floors on Quest', () => {
    assert.equal(acceptsGameSurface(plane('Table'), true), true);
    assert.equal(acceptsGameSurface(plane('Floor'), true), true);
  });

  it('rejects unlabelled and other labelled planes on Quest', () => {
    assert.equal(acceptsGameSurface(plane('Unknown'), true), false);
    assert.equal(acceptsGameSurface(plane('Seat'), true), false);
  });

  it('accepts unlabelled phone planes', () => {
    assert.equal(acceptsGameSurface(plane('Unknown'), false), true);
    assert.equal(acceptsGameSurface(plane('None'), false), true);
  });

  it('rejects vertical planes and non-plane anchors', () => {
    assert.equal(acceptsGameSurface(plane('Table', 'Vertical'), false), false);
    assert.equal(acceptsGameSurface({ type: 'image', classification: 'Table' }, false), false);
    assert.equal(acceptsGameSurface(undefined, false), false);
  });
});
