import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { OUTWARD_FAR_EDGE_DP, RAIL_WINDOW, RAIL_WINDOW_DP, outwardWindowGapDp } from './railWindow.ts';
import { PLACE_DETAIL_WINDOW } from './exploreWorkspace.ts';

const require = createRequire(import.meta.url);
const { resolveAnchor } = require(join(dirname(require.resolve('@metavr/layout-window-compat')), 'SpatialAnchor.js'));

describe('outwardWindowGapDp (Horizon OS 207, measured on a Quest 3S; ADR 0005)', () => {
  it('leaves 20dp beside a 140dp window', () => {
    assert.equal(outwardWindowGapDp(140), 20);
  });

  it('reproduces the overlaps measured on the headset', () => {
    // dumpsys volumetric_window: far edge 0.152 m past the main edge, 1dp = 0.949 mm.
    assert.equal(outwardWindowGapDp(300), -140);
    assert.equal(outwardWindowGapDp(400), -240);
    assert.equal(outwardWindowGapDp(440), -280);
  });

  it('cannot clear a Place Detail window, so Detail stays a column in the main window', () => {
    const size = PLACE_DETAIL_WINDOW.size;
    assert.equal(size.unit, 'dp');
    assert.ok(outwardWindowGapDp(size.width) < 0);
  });

  it('puts the far edge 160dp out', () => {
    assert.equal(OUTWARD_FAR_EDGE_DP, 160);
  });
});

describe('RAIL_WINDOW', () => {
  it('sits outside the physical left edge, including RTL, at the same depth', () => {
    assert.deepEqual(RAIL_WINDOW.anchor, { parent: 'left', child: 'right' });
    assert.equal(RAIL_WINDOW.offset, undefined);
  });

  it('passes physical edges through the installed Meta SDK anchor adapter', () => {
    assert.deepEqual(resolveAnchor(RAIL_WINDOW.anchor), {
      parent: { horizontal: 'left', vertical: null },
      child: { horizontal: 'right', vertical: null },
    });
  });

  it('uses a compact spatial width while retaining the full touch-target minimum', () => {
    assert.equal(RAIL_WINDOW.windowWidth, 96);
    assert.equal(RAIL_WINDOW_DP.width - 2 * RAIL_WINDOW_DP.padding, 72);
    assert.ok(RAIL_WINDOW_DP.width - 2 * RAIL_WINDOW_DP.padding >= RAIL_WINDOW_DP.item);
  });

  it('fits five 60dp items (no More, DECISIONS S20) with 8dp between them and 12dp padding', () => {
    assert.equal(RAIL_WINDOW_DP.item, 60);
    assert.equal(RAIL_WINDOW.windowHeight, 5 * 60 + 4 * 8 + 2 * 12);
  });

  it('outranks content windows for a slot and never draws inline', () => {
    assert.equal(RAIL_WINDOW.priority, 20);
    assert.equal(RAIL_WINDOW.fallback, 'drop');
    assert.equal(RAIL_WINDOW.promotable, true);
  });
});
