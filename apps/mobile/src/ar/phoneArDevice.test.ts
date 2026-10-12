import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { supportsPhoneArLayout } from './phoneArDevice.ts';

const phone = { platform: 'android', hasHardwareColumn: false, androidCapabilities: { isFoldable: false, isTablet: false } };

describe('bounded ordinary-phone AR layout support', () => {
  it('accepts ordinary phones only with native capability evidence', () => {
    assert.equal(supportsPhoneArLayout(phone), true);
  });
  it('does not infer ordinary iOS hardware from phone idiom or absent geometry', () => {
    assert.equal(supportsPhoneArLayout({ platform: 'ios', isPad: false, hasHardwareColumn: false }), false);
  });
  it('keeps foldables on their map even on a cover with no active hinge', () => {
    assert.equal(supportsPhoneArLayout({ ...phone, androidCapabilities: { isFoldable: true, isTablet: false } }), false);
    assert.equal(supportsPhoneArLayout({ platform: 'ios', isPad: false, hasHardwareColumn: true }), false);
  });
  it('keeps narrow tablets on their existing rail and map', () => {
    assert.equal(supportsPhoneArLayout({ ...phone, androidCapabilities: { isFoldable: false, isTablet: true } }), false);
    assert.equal(supportsPhoneArLayout({ platform: 'ios', isPad: true, hasHardwareColumn: false }), false);
  });
  it('does not treat unavailable capability or an unsupported platform as a phone', () => {
    assert.equal(supportsPhoneArLayout({ ...phone, androidCapabilities: undefined }), false);
    assert.equal(supportsPhoneArLayout({ platform: 'ios', hasHardwareColumn: false }), false);
    assert.equal(supportsPhoneArLayout({ ...phone, platform: 'web' }), false);
    assert.equal(supportsPhoneArLayout({ ...phone, platform: 'visionos' }), false);
  });
});
