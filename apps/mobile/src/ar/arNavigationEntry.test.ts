import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canUseArNavigation } from './arNavigationEntry.ts';

const phone = { isHorizonBuild: false, isMetaHorizonXR: false, isPico: false, isVisionOS: false, platform: 'android' };

describe('canUseArNavigation', () => {
  it('allows iOS and Android phones', () => {
    assert.equal(canUseArNavigation(phone), true);
    assert.equal(canUseArNavigation({ ...phone, platform: 'ios' }), true);
  });

  it('never runs on headsets or the quest/pico builds, which have no GPS', () => {
    assert.equal(canUseArNavigation({ ...phone, isHorizonBuild: true }), false, 'quest flavor on a phone');
    assert.equal(canUseArNavigation({ ...phone, isMetaHorizonXR: true }), false);
    assert.equal(canUseArNavigation({ ...phone, isPico: true }), false);
    assert.equal(canUseArNavigation({ ...phone, isVisionOS: true, platform: 'ios' }), false);
  });

  it('never runs on web', () => {
    assert.equal(canUseArNavigation({ ...phone, platform: 'web' }), false);
  });
});
