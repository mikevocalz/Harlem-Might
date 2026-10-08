import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SPATIAL_STATUS, STATUS_WORDS, statusLabel } from './ar-status.ts';

describe('SPATIAL_STATUS', () => {
  it('uses only the five status words', () => {
    for (const row of SPATIAL_STATUS) assert.ok(STATUS_WORDS.includes(row.status), row.id);
  });

  it('claims nothing verified while no target has a device record', () => {
    assert.equal(SPATIAL_STATUS.some((row) => row.status === 'verified'), false);
  });

  it('keeps phone place labels at concept', () => {
    assert.equal(SPATIAL_STATUS.find((row) => row.id === 'phone-ar')?.status, 'concept');
  });

  it('never says a target works or is supported', () => {
    for (const row of SPATIAL_STATUS) {
      assert.doesNotMatch(row.detail, /\b(works|supported|available now|runs on)\b/i, row.id);
    }
  });

  it('cites evidence for every row', () => {
    for (const row of SPATIAL_STATUS) assert.ok(row.evidence.length > 0, row.id);
  });
});

describe('statusLabel', () => {
  it('sentence-cases the word', () => {
    assert.equal(statusLabel('integration path'), 'Integration path');
  });
});
