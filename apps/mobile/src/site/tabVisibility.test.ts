import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HORIZON_STRUCK_TABS, HORIZON_TAB_COUNT, isTabShown } from './tabVisibility.ts';

describe('tab visibility (DECISIONS S20)', () => {
  it('strikes More on Horizon builds only', () => {
    assert.equal(isTabShown('more', true), false);
    assert.equal(isTabShown('more', false), true);
    assert.deepEqual([...HORIZON_STRUCK_TABS], ['more']);
  });

  it('keeps Explore, Walks, Stories and Today on every build', () => {
    for (const route of ['explore', 'walks', 'stories', 'today'] as const) {
      assert.equal(isTabShown(route, true), true, route);
      assert.equal(isTabShown(route, false), true, route);
    }
  });

  it('gives the Horizon rail four items', () => {
    assert.equal(HORIZON_TAB_COUNT, 4);
  });
});
