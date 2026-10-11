import assert from 'node:assert/strict';
import { test } from 'node:test';
import { navigationPresentation } from './navigationPresentation.ts';

const phone = { isHorizon: false, isFoldable: false, isTablet: false, hardwareColumnWidth: 0 };
test('ordinary phones keep bottom tabs; window width cannot turn them into tablets', () => {
  assert.deepEqual(navigationPresentation(phone), { rail: false, position: 'bottom' });
});
test('foldables keep the right rail even on the compact cover display', () => {
  assert.deepEqual(navigationPresentation({ ...phone, isFoldable: true }), { rail: true, position: 'right' });
  assert.deepEqual(navigationPresentation({ ...phone, hardwareColumnWidth: 90 }), { rail: true, position: 'right' });
});
test('tablets and Horizon always use the right rail', () => {
  for (const patch of [{ isTablet: true }, { isHorizon: true }]) {
    assert.deepEqual(navigationPresentation({ ...phone, ...patch }), { rail: true, position: 'right' });
  }
});
