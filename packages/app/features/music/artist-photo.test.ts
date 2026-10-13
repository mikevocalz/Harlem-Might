import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  artistPhotoImageProps,
  artistPhotoProviderLabel,
  isArtistPhotoResult,
  normalizeArtistName,
  type ArtistPhotoResult,
} from './artist-photo.ts';

describe('normalizeArtistName', () => {
  it('matches punctuation-heavy stage names safely', () => {
    assert.equal(normalizeArtistName('A$AP Rocky'), 'asap rocky');
    assert.equal(normalizeArtistName('Ma$e'), 'mase');
    assert.equal(normalizeArtistName('T-Rex'), 't rex');
  });
});

describe('artistPhotoProviderLabel', () => {
  it('labels every supported provider', () => {
    assert.equal(
      artistPhotoProviderLabel('wikimedia_commons'),
      'Wikimedia Commons',
    );
    assert.equal(
      artistPhotoProviderLabel('curated_web'),
      'Verified artist source',
    );
  });
});

it('normalizes reviewed stage names, accents, separators and compatibility characters consistently', () => {
  for (const [name, expected] of [
    ['A$AP Twelvyy', 'asap twelvyy'],
    ['Frankie Lymon & the Teenagers', 'frankie lymon and the teenagers'],
    ['  José\tFeliciano  ', 'jose feliciano'],
    ['Ｊ.Ｒ. Writer', 'j r writer'],
    ['\t &  ', 'and'],
    ['', ''],
  ] as const) {
    assert.equal(normalizeArtistName(name), expected, name);
  }
});

const commonsPhoto: ArtistPhotoResult = {
  name: 'Example Artist',
  url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Example.jpg',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
  provider: 'wikimedia_commons',
  rightsStatus: 'rights-cleared',
  credit: 'Example Photographer',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  width: 800,
  height: 1200,
};
const referencePhoto: ArtistPhotoResult = {
  name: 'Example Artist',
  url: 'https://harlem.example/api/music/artist-photo/image?name=Example%20Artist&v=6',
  sourceUrl: 'https://artist.example/profile',
  provider: 'curated_web',
  rightsStatus: 'provider-reference',
  credit: 'Official artist profile',
};

it('recognizes both supported photo result shapes without changing their provenance', () => {
  for (const photo of [commonsPhoto, referencePhoto]) {
    const frozen = Object.freeze({ ...photo });
    assert.equal(isArtistPhotoResult(frozen), true);
    assert.deepEqual(frozen, photo);
  }
});

it('rejects absent, array and primitive photo responses', () => {
  for (const value of [undefined, null, [], [commonsPhoto], '', 'photo', 0, 42, true]) {
    assert.equal(isArtistPhotoResult(value), false);
  }
});

it('requires nonempty string identity, image, source and attribution fields', () => {
  for (const field of ['name', 'url', 'sourceUrl', 'credit']) {
    for (const value of [undefined, null, '', ' \t ', 42, {}, []]) {
      assert.equal(isArtistPhotoResult({ ...commonsPhoto, [field]: value }), false, field);
    }
  }
});

it('rejects unknown or absent provider and rights-status values', () => {
  for (const provider of [undefined, null, '', 'spotify', 42]) {
    assert.equal(isArtistPhotoResult({ ...commonsPhoto, provider }), false);
  }
  for (const rightsStatus of [undefined, null, '', 'public-domain', 'licensed', 42]) {
    assert.equal(isArtistPhotoResult({ ...commonsPhoto, rightsStatus }), false);
  }
});

it('preserves exact image URLs and selects optimizer behavior for each supported provider', () => {
  for (const photo of [commonsPhoto, referencePhoto]) {
    const frozen = Object.freeze({ ...photo });
    assert.deepEqual(artistPhotoImageProps(frozen), {
      src: photo.url,
      unoptimized: photo.provider === 'curated_web',
    });
    assert.deepEqual(frozen, photo);
  }
});
