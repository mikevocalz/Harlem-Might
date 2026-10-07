import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MOTION_MARKER_SELECTOR, parseMotionMarker } from './motion-markers.ts';

describe('parseMotionMarker', () => {
  it('classifies each marker prefix', () => {
    assert.deepEqual(parseMotionMarker('mfx-hero-title'), { kind: 'fade', name: 'hero-title' });
    assert.deepEqual(parseMotionMarker('mpx-hero-map'), { kind: 'scrub', name: 'hero-map' });
    assert.deepEqual(parseMotionMarker('trg-hero'), { kind: 'trigger', name: 'hero' });
  });

  it('returns null for non-marker ids and bare prefixes', () => {
    assert.equal(parseMotionMarker('hero-title'), null);
    assert.equal(parseMotionMarker(''), null);
    assert.equal(parseMotionMarker('mfx-'), null);
    assert.equal(parseMotionMarker('mpx-'), null);
    assert.equal(parseMotionMarker('trg-'), null);
  });

  it('keeps the longest matching semantics — prefixes do not overlap', () => {
    assert.equal(parseMotionMarker('mfx-mpx-nested')?.kind, 'fade');
  });
});

describe('MOTION_MARKER_SELECTOR', () => {
  it('covers every marker prefix', () => {
    assert.match(MOTION_MARKER_SELECTOR, /mfx-/);
    assert.match(MOTION_MARKER_SELECTOR, /mpx-/);
    assert.match(MOTION_MARKER_SELECTOR, /trg-/);
  });
});
