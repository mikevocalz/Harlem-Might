import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_DURATION, ERROR_DURATION, dismissibleFor, durationFor } from './notify.shared.ts';

test('loading remains visible until resolved or dismissed, regardless of duration overrides', () => {
  for (const requested of [undefined, 0, 1, 4000, Infinity]) {
    assert.equal(durationFor('loading', requested), Infinity);
  }
});

test('non-loading notifications retain their documented default and custom durations', () => {
  for (const variant of ['info', 'success', 'warning'] as const) {
    assert.equal(durationFor(variant), DEFAULT_DURATION);
    assert.equal(durationFor(variant, 1500), 1500);
  }
  assert.equal(durationFor('error'), ERROR_DURATION);
  assert.equal(durationFor('error', 8000), 8000);
});

test('loading and error notices remain dismissible by default with explicit overrides respected', () => {
  assert.equal(dismissibleFor('loading'), true);
  assert.equal(dismissibleFor('error'), true);
  assert.equal(dismissibleFor('info'), false);
  assert.equal(dismissibleFor('loading', false), false);
  assert.equal(dismissibleFor('info', true), true);
});
