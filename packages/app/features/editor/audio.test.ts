import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDuration } from './audio.store.ts';

describe('formatDuration', () => {
  it('pads the seconds so the clock does not jitter in width', () => {
    assert.equal(formatDuration(0), '0:00');
    assert.equal(formatDuration(5), '0:05');
    assert.equal(formatDuration(65), '1:05');
  });

  it('rolls over at the minute', () => {
    assert.equal(formatDuration(59), '0:59');
    assert.equal(formatDuration(60), '1:00');
    assert.equal(formatDuration(600), '10:00');
  });

  it('floors fractional seconds rather than rounding up to a time not yet reached', () => {
    assert.equal(formatDuration(1.9), '0:01');
  });

  it('never shows a negative clock', () => {
    assert.equal(formatDuration(-3), '0:00');
  });
});
