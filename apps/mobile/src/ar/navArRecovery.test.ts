import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { HeadingEstimate } from '@acme/app/features/navigation/model/location.ts';
import type { PositioningState } from '@acme/app/features/navigation/model/progress.ts';
import { navigationArrow, navigationArRecovery } from './navArRecovery.ts';

const nowMs = 10_000;
const heading: HeadingEstimate = {
  headingDeg: 0, confidence: 'high', source: 'compass', consistency: 1, timestampMs: nowMs,
};
const positioning: PositioningState = { kind: 'tracking', confidence: 'high', horizontalRadius68M: 3, isMovingTooFast: false };
const arrow = { bearingDeg: 90, heading, positioning, isMatched: true, matchTimestampMs: nowMs, nowMs };

describe('phone AR fallback direction', () => {
  it('pairs a usable arrow with a spoken direction', () => {
    assert.deepEqual(navigationArrow(arrow), { rotationDeg: 90, instruction: 'The route continues to your right.' });
    assert.equal(navigationArrow({ ...arrow, bearingDeg: 270 })?.instruction, 'The route continues to your left.');
    assert.equal(navigationArrow({ ...arrow, bearingDeg: 0 })?.instruction, 'The route continues ahead.');
    assert.match(navigationArrow({ ...arrow, bearingDeg: 180 })!.instruction, /behind you/);
  });
  it('never draws a precise-looking arrow with absent, stale, low-confidence or invalid heading', () => {
    for (const sample of [undefined, { ...heading, timestampMs: 0 }, { ...heading, confidence: 'low' as const },
      { ...heading, headingDeg: NaN }, { ...heading, timestampMs: nowMs + 10_000 }]) {
      assert.equal(navigationArrow({ ...arrow, heading: sample }), undefined);
    }
  });
  it('does not mistake walking direction for the direction the phone points', () => {
    assert.equal(navigationArrow({ ...arrow, heading: { ...heading, source: 'course-over-ground' } }), undefined);
  });
  it('expires direction at the same age boundary as scene calibration', () => {
    assert.ok(navigationArrow({ ...arrow, heading: { ...heading, timestampMs: nowMs - 1_500 } }));
    assert.equal(navigationArrow({ ...arrow, heading: { ...heading, timestampMs: nowMs - 1_501 } }), undefined);
  });
  it('expires with the observation clock even when the same heading and match are retained', () => {
    assert.ok(navigationArrow(arrow));
    assert.equal(navigationArrow({ ...arrow, nowMs: nowMs + 1501 }), undefined);
    assert.equal(navigationArrow({ ...arrow, heading: { ...heading, timestampMs: nowMs + 5001 }, nowMs: nowMs + 5001 }), undefined,
      'fresh heading does not revive an expired route match');
  });
  it('preserves fresh 2D direction when camera/world alignment alone is unavailable', () => {
    const direction = navigationArrow(arrow);
    assert.ok(direction);
    assert.equal(navigationArRecovery({ positioning, arTracking: { kind: 'limited', reason: 'relocalizing' },
      hasDirection: direction !== undefined })?.title, 'Realign the camera');
    assert.equal(direction.rotationDeg, 90);
  });
  it('withholds arrows when the matched route or location is no longer trustworthy', () => {
    assert.equal(navigationArrow({ ...arrow, matchTimestampMs: 0 }), undefined);
    assert.equal(navigationArrow({ ...arrow, isMatched: false }), undefined);
    assert.equal(navigationArrow({ ...arrow, positioning: { kind: 'lost', sinceMs: nowMs } }), undefined);
    assert.equal(navigationArrow({ ...arrow, positioning: { ...positioning, confidence: 'low' } }), undefined);
    assert.equal(navigationArrow({ ...arrow, positioning: { ...positioning, isMovingTooFast: true } }), undefined);
  });
});

describe('AR recovery instructions', () => {
  it('explains absent direction without telling the walker to follow a missing arrow', () => {
    const result = navigationArRecovery({ positioning, arTracking: { kind: 'normal' }, hasDirection: false });
    assert.equal(result?.title, 'Direction is uncertain');
    assert.match(result!.body, /map/);
    assert.doesNotMatch(result!.body, /follow the arrow/i);
  });
  it('makes location loss and camera interruption actionable', () => {
    assert.equal(navigationArRecovery({ positioning: { kind: 'lost', sinceMs: nowMs }, arTracking: { kind: 'normal' }, hasDirection: true })?.title, 'Location lost');
    assert.equal(navigationArRecovery({ positioning, arTracking: { kind: 'limited', reason: 'relocalizing' }, hasDirection: true })?.title, 'Realign the camera');
    assert.equal(navigationArRecovery({ positioning, arTracking: { kind: 'unavailable', reason: 'permission-denied' }, hasDirection: true })?.title, 'Camera access is off');
  });
  it('clears recovery once location, camera and direction are usable', () => {
    assert.equal(navigationArRecovery({ positioning, arTracking: { kind: 'normal' }, hasDirection: true }), undefined);
  });
});
