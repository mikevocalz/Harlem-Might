import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CORNER_CUT, NOTCH, cornerCut, cornerCutPath, notchPath } from './geometry.native.ts';

describe('cornerCutPath', () => {
  it('cuts the bottom-right corner of the box', () => {
    assert.equal(
      cornerCutPath({ width: 160, height: 52 }, CORNER_CUT.md),
      'M0 0 L160 0 L160 32 L140 52 L0 52 Z',
    );
  });

  it('insets every edge and keeps the same cut, like the web 1px rail', () => {
    assert.equal(
      cornerCutPath({ width: 160, height: 52 }, CORNER_CUT.md, 1),
      'M1 1 L159 1 L159 31 L139 51 L1 51 Z',
    );
  });

  it('clamps the cut to a box smaller than the cut', () => {
    assert.equal(cornerCutPath({ width: 10, height: 6 }, CORNER_CUT.sm), 'M0 0 L10 0 L10 0 L4 6 L0 6 Z');
  });

  it('rounds fractional layout sizes to two decimals', () => {
    assert.equal(
      cornerCutPath({ width: 100.333333, height: 40 }, CORNER_CUT.sm),
      'M0 0 L100.33 0 L100.33 28 L88.33 40 L0 40 Z',
    );
  });

  it('returns an empty path when the inset leaves nothing', () => {
    assert.equal(cornerCutPath({ width: 0, height: 0 }, CORNER_CUT.md), '');
    assert.equal(cornerCutPath({ width: 2, height: 40 }, CORNER_CUT.md, 1), '');
  });
});

describe('notchPath', () => {
  it('matches the web notch polygon on a 400 × 240 card', () => {
    assert.equal(
      notchPath({ width: 400, height: 240 }),
      'M0 0 L122 0 L130 8 L270 8 L278 0 L400 0 L400 220 L380 240 L278 240 L270 232 L130 232 L122 240 L0 240 Z',
    );
  });

  it('keeps the notches centred on the card when inset for the rail fill', () => {
    assert.equal(
      notchPath({ width: 400, height: 240 }, 2),
      'M2 2 L122 2 L130 10 L270 10 L278 2 L398 2 L398 218 L378 238 L278 238 L270 230 L130 230 L122 238 L2 238 Z',
    );
  });

  it('falls back to the corner cut below the minimum width, for every layer', () => {
    const size = { width: NOTCH.minWidth - 1, height: 120 };
    assert.equal(notchPath(size), cornerCutPath(size, NOTCH.cornerCut));
    assert.equal(notchPath(size, 2), cornerCutPath(size, NOTCH.cornerCut, 2));
  });

  it('keeps the bottom notch clear of the corner cut at the minimum width', () => {
    const path = notchPath({ width: NOTCH.minWidth, height: 120 }, 2);
    // Inner right edge 198, corner cut ends at 178, notch starts at 100 + 78.
    assert.match(path, /L178 118 L178 118 /);
  });
});

it('re-exports the web class strings so index.ts has one surface', () => {
  assert.match(cornerCut, /clip-path/);
});
