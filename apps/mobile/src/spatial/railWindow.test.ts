import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OUTWARD_FAR_EDGE_DP, RAIL_WINDOW, RAIL_WINDOW_DP, outwardWindowGapDp } from './railWindow.ts';
import { PLACE_DETAIL_WINDOW } from './exploreWorkspace.ts';

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
  it('sits outside the main window start edge at the same depth', () => {
    assert.deepEqual(RAIL_WINDOW.anchor, { parent: 'start', child: 'end' });
    assert.equal(RAIL_WINDOW.offset, undefined);
  });

  it('is sized from tokens so the gap is 20dp', () => {
    assert.equal(RAIL_WINDOW.windowWidth, 140);
    assert.equal(outwardWindowGapDp(RAIL_WINDOW_DP.width), 20);
  });

  it('fits four 60dp items (no More, DECISIONS S20) with 8dp between them and 12dp padding', () => {
    assert.equal(RAIL_WINDOW_DP.item, 60);
    assert.equal(RAIL_WINDOW.windowHeight, 4 * 60 + 3 * 8 + 2 * 12);
  });

  it('outranks content windows for a slot and never draws inline', () => {
    assert.equal(RAIL_WINDOW.priority, 20);
    assert.equal(RAIL_WINDOW.fallback, 'drop');
    assert.equal(RAIL_WINDOW.promotable, true);
  });
});
