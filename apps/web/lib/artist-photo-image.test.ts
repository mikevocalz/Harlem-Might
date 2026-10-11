import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { it } from 'node:test';
import { artistPhotoImageProps, type ArtistPhotoResult } from '@acme/app/features/music/artist-photo.ts';

const require = createRequire(import.meta.url);
const { getImageProps } = require('next/image') as typeof import('next/image');
const photo: ArtistPhotoResult = {
  name: 'Big L',
  url: 'https://harlemmight.com/api/music/artist-photo/image?name=Big%20L&v=5',
  sourceUrl: 'https://www.last.fm/music/Big%2BL',
  provider: 'curated_web', rightsStatus: 'provider-reference', credit: 'Last.fm',
};

it('renders the same absolute proxy URL on web without a second optimizer request', () => {
  const image = artistPhotoImageProps(photo);
  assert.equal(image.src, photo.url); // Native/headset clients retain an absolute source.
  assert.equal(image.unoptimized, true);
  const { props } = getImageProps({ ...image, alt: 'Big L', width: 400, height: 500 });
  assert.equal(props.src, photo.url);
  assert.equal(props.srcSet, undefined);
});

it('keeps the normal optimization path for licensed Commons images', () => {
  assert.equal(artistPhotoImageProps({ ...photo, provider: 'wikimedia_commons' }).unoptimized, false);
});
