import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COMMIT_THRESHOLD,
  OPEN_THRESHOLD,
  resolveSwipe,
  restingTranslation,
  swipeTranslation,
} from './swipe-actions.ts';

const ACTION = 88;
const ROW = 400;

describe('swipeTranslation', () => {
  it('tracks the finger one-to-one up to the action width', () => {
    assert.equal(swipeTranslation(-40, ACTION, ROW, 'trailing'), -40);
    assert.equal(swipeTranslation(-ACTION, ACTION, ROW, 'trailing'), -ACTION);
    assert.equal(swipeTranslation(40, ACTION, ROW, 'leading'), 40);
  });

  it('resists past the action width instead of stopping dead', () => {
    const past = swipeTranslation(-ACTION - 100, ACTION, ROW, 'trailing');
    assert.ok(past < -ACTION, 'should keep moving');
    assert.ok(past > -ACTION - 100, 'but not one-to-one');
  });

  it('never travels further than the row is wide', () => {
    assert.ok(Math.abs(swipeTranslation(-5000, ACTION, ROW, 'trailing')) <= ROW);
    assert.ok(Math.abs(swipeTranslation(5000, ACTION, ROW, 'leading')) <= ROW);
  });

  it('ignores drags against the action side', () => {
    // Trailing actions live on the right, so a rightward pull does nothing.
    assert.equal(swipeTranslation(120, ACTION, ROW, 'trailing'), 0);
    assert.equal(swipeTranslation(-120, ACTION, ROW, 'leading'), 0);
  });
});

describe('resolveSwipe', () => {
  const base = { actionWidth: ACTION, rowWidth: ROW, velocity: 0 };

  it('closes below half the action width', () => {
    assert.deepEqual(resolveSwipe({ ...base, translation: -ACTION * 0.4 }), { kind: 'close' });
  });

  it('opens once past half the action width', () => {
    assert.deepEqual(resolveSwipe({ ...base, translation: -ACTION * OPEN_THRESHOLD }), {
      kind: 'open',
    });
    assert.deepEqual(resolveSwipe({ ...base, translation: -ACTION }), { kind: 'open' });
  });

  it('commits on a full swipe', () => {
    assert.deepEqual(resolveSwipe({ ...base, translation: -ROW * COMMIT_THRESHOLD }), {
      kind: 'commit',
    });
  });

  it('keeps commit well past open, so peeking cannot fire the action', () => {
    // The gap between the two is the whole safety margin; assert it exists.
    assert.ok(ROW * COMMIT_THRESHOLD > ACTION * OPEN_THRESHOLD * 3);
  });

  it('commits on a hard flick that has barely moved', () => {
    assert.deepEqual(resolveSwipe({ ...base, translation: -30, velocity: -1500 }), {
      kind: 'commit',
    });
  });

  it('closes on a flick back, even from fully open', () => {
    assert.deepEqual(resolveSwipe({ ...base, translation: -ACTION, velocity: 900 }), {
      kind: 'close',
    });
  });

  it('ignores a slow drift that reverses direction', () => {
    // Below the velocity gate, distance decides — still open at the action width.
    assert.deepEqual(resolveSwipe({ ...base, translation: -ACTION, velocity: 100 }), {
      kind: 'open',
    });
  });

  it('closes an untouched row', () => {
    assert.deepEqual(resolveSwipe({ ...base, translation: 0 }), { kind: 'close' });
  });
});

describe('restingTranslation', () => {
  it('parks open at exactly the action width', () => {
    assert.equal(restingTranslation({ kind: 'open' }, ACTION, ROW, 'trailing'), -ACTION);
    assert.equal(restingTranslation({ kind: 'open' }, ACTION, ROW, 'leading'), ACTION);
  });

  it('sends a committed row all the way off', () => {
    assert.equal(restingTranslation({ kind: 'commit' }, ACTION, ROW, 'trailing'), -ROW);
  });

  it('returns to zero when closing', () => {
    assert.equal(restingTranslation({ kind: 'close' }, ACTION, ROW, 'trailing'), 0);
  });
});
