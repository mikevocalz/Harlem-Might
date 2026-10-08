import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canViewInAr } from './arEntry.ts';

const apollo = { id: 'apollo-theater', lngLat: [-73.9499948, 40.8100895] as const };
const striversRow = { id: 'strivers-row' };

describe('canViewInAr', () => {
  it('shows the entry in the quest build on Meta Horizon for a mapped place', () => {
    assert.equal(canViewInAr({ isHorizonBuild: true, isMetaHorizonXR: true, place: apollo }), true);
  });

  it('hides it outside the quest build or off Meta Horizon', () => {
    assert.equal(canViewInAr({ isHorizonBuild: false, isMetaHorizonXR: true, place: apollo }), false);
    assert.equal(canViewInAr({ isHorizonBuild: true, isMetaHorizonXR: false, place: apollo }), false);
  });

  it('hides it for places without coordinates or no place', () => {
    assert.equal(canViewInAr({ isHorizonBuild: true, isMetaHorizonXR: true, place: striversRow }), false);
    assert.equal(canViewInAr({ isHorizonBuild: true, isMetaHorizonXR: true, place: undefined }), false);
  });
});
