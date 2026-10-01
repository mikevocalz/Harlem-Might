import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  headerProgress,
  nextHeaderOffset,
  snapHeaderOffset,
  NEAR_TOP_THRESHOLD,
  SHOWN,
} from './sticky-header.ts';

const HEIGHT = 56;

describe('nextHeaderOffset', () => {
  it('hides as the list scrolls down and reveals as it scrolls up', () => {
    assert.equal(nextHeaderOffset(SHOWN, 10, HEIGHT), -10);
    assert.equal(nextHeaderOffset(-10, -4, HEIGHT), -6);
  });

  it('clamps at fully hidden, however fast the fling', () => {
    assert.equal(nextHeaderOffset(SHOWN, 5000, HEIGHT), -HEIGHT);
    assert.equal(nextHeaderOffset(-HEIGHT, 1, HEIGHT), -HEIGHT);
  });

  it('clamps at fully shown, so it never overshoots into the content', () => {
    assert.equal(nextHeaderOffset(SHOWN, -5000, HEIGHT), SHOWN);
    assert.equal(nextHeaderOffset(-2, -50, HEIGHT), SHOWN);
  });

  it('reverses immediately when the finger changes direction', () => {
    // The point of tracking deltas: one upward pixel moves it back one pixel,
    // no matter how far down the list already is.
    const hidden = nextHeaderOffset(SHOWN, 40, HEIGHT);
    assert.equal(nextHeaderOffset(hidden, -1, HEIGHT), -39);
  });
});

describe('headerProgress', () => {
  it('reports 0 shown, 1 hidden, and the midpoint between', () => {
    assert.equal(headerProgress(SHOWN, HEIGHT), 0);
    assert.equal(headerProgress(-HEIGHT, HEIGHT), 1);
    assert.equal(headerProgress(-HEIGHT / 2, HEIGHT), 0.5);
  });

  it('stays in range for out-of-bounds offsets', () => {
    assert.equal(headerProgress(-HEIGHT * 3, HEIGHT), 1);
    assert.equal(headerProgress(20, HEIGHT), 0);
  });

  it('does not divide by a zero height before first layout', () => {
    assert.equal(headerProgress(-10, 0), 0);
  });
});

describe('snapHeaderOffset', () => {
  const FAR = 400;

  it('commits to hidden past the halfway point', () => {
    assert.equal(snapHeaderOffset(-HEIGHT * 0.51, HEIGHT, FAR), -HEIGHT);
    assert.equal(snapHeaderOffset(-HEIGHT, HEIGHT, FAR), -HEIGHT);
  });

  it('returns to shown at or before halfway', () => {
    assert.equal(snapHeaderOffset(-HEIGHT * 0.5, HEIGHT, FAR), SHOWN);
    assert.equal(snapHeaderOffset(-HEIGHT * 0.2, HEIGHT, FAR), SHOWN);
  });

  it('never settles part-way', () => {
    for (let offset = 0; offset >= -HEIGHT; offset -= 1) {
      const settled = snapHeaderOffset(offset, HEIGHT, FAR);
      assert.ok(settled === SHOWN || settled === -HEIGHT, `offset ${offset}`);
    }
  });

  it('always reopens near the top, even when fully hidden', () => {
    assert.equal(snapHeaderOffset(-HEIGHT, HEIGHT, 0), SHOWN);
    assert.equal(snapHeaderOffset(-HEIGHT, HEIGHT, NEAR_TOP_THRESHOLD), SHOWN);
    // One pixel past the threshold it is free to stay hidden again.
    assert.equal(snapHeaderOffset(-HEIGHT, HEIGHT, NEAR_TOP_THRESHOLD + 1), -HEIGHT);
  });
});
