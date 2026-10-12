import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';
import { isArtistPhotoResult } from './artist-photo.ts';
import { isFreeArtistPhotoLicense, isCommonsArtistPhotoUrl } from './artist-photo-rights.ts';
import { REVIEWED_ARTIST_PHOTOS } from './reviewed-artist-photo-data.ts';
import { resolveReviewedArtistPhoto, resolveReviewedArtistPhotos } from './reviewed-artist-photo.ts';
import { ARTIST_PHOTO_VERSION, artistPhotoFraming, shouldUseStoredArtistPhoto } from './artist-photo-policy.ts';
import { musicArtistOpenGraphPhoto } from './artist-photo-metadata.ts';
import { musicKeys } from './music.keys.ts';

const evidence = JSON.parse(readFileSync(new URL('./__fixtures__/reviewed-artist-catalogue.json', import.meta.url), 'utf8'));

it('covers the exact 102 published artists, with no draft records or shared photo URLs', () => {
  assert.equal(evidence.artists.length, 102);
  assert.equal(Object.keys(REVIEWED_ARTIST_PHOTOS).length, 102);
  const urls = new Set<string>();
  for (const artist of evidence.artists) {
    const photo = resolveReviewedArtistPhoto(artist.name);
    assert.ok(photo, artist.name);
    assert.ok(isArtistPhotoResult(photo), artist.name);
    assert.equal(photo.name, artist.name);
    assert.ok(!urls.has(photo.url), `duplicate image for ${artist.name}`);
    urls.add(photo.url);
    assert.ok(photo.width && photo.width > 0, artist.name);
    assert.ok(photo.height && photo.height > 0, artist.name);
    if (photo.rightsStatus === 'rights-cleared') {
      assert.equal(photo.provider, 'wikimedia_commons');
      assert.ok(isCommonsArtistPhotoUrl(photo.url), artist.name);
      assert.ok(isFreeArtistPhotoLicense(photo.license), artist.name);
      assert.ok(photo.licenseUrl, artist.name);
    }
  }
  for (const name of evidence.catalogue.draftsExcluded) assert.equal(resolveReviewedArtistPhoto(name), null);
});

it('returns no fuzzy substitute for unknown people and is independent of changing profile metadata', () => {
  assert.equal(resolveReviewedArtistPhoto('Unknown Artist'), null);
  assert.equal(resolveReviewedArtistPhoto('Charles Hamilton (politician)'), null);
  const results = resolveReviewedArtistPhotos(['A$AP Ant', 'Cameo', 'Unknown Artist']);
  assert.equal(results['Unknown Artist'], null);
  assert.equal(results.Cameo?.url, 'https://www.jjamsentertainment.com/images/cameo.jpg');
});

it('removes the observed logo, illustration and album-sleeve regressions', () => {
  assert.match(resolveReviewedArtistPhoto('T-Rex')!.url, /versetracker/);
  assert.match(resolveReviewedArtistPhoto('Johnny Kemp')!.url, /i\.scdn\.co/);
  assert.match(resolveReviewedArtistPhoto('Harlem Quartet')!.url, /Harlem\+2\.jpg/);
  const bloodshed = resolveReviewedArtistPhoto('Bloodshed')!;
  assert.match(bloodshed.url, /Bloodshed2\.jpg/);
  assert.equal(bloodshed.rightsStatus, 'provider-reference');
  assert.equal(bloodshed.license, undefined);
});

it('quarantines only the five bad stored assignments, preserving later curator corrections', () => {
  const rejected = evidence.artists.filter((artist: { storedAction: string }) => artist.storedAction === 'replace-known-defect');
  assert.equal(rejected.length, 5);
  for (const artist of rejected) {
    assert.equal(shouldUseStoredArtistPhoto({ name: artist.name, headshot: { sourceUrl: artist.storedSourceAtAudit } }), false);
    assert.equal(shouldUseStoredArtistPhoto({ name: artist.name, headshot: { sourceUrl: artist.sourceUrl } }), true);
  }
  assert.equal(shouldUseStoredArtistPhoto({ name: 'Big L' }), false);
  assert.equal(shouldUseStoredArtistPhoto({ name: 'Ella Fitzgerald', headshot: { sourceUrl: 'https://example.org/new.jpg' } }), true);
});

it('preserves the full reviewed group framing and busts both client cache layers', () => {
  assert.deepEqual(artistPhotoFraming({ width: 1200, height: 600 }), { aspectRatio: 2, contentFit: 'contain' });
  assert.deepEqual(artistPhotoFraming({}), { aspectRatio: 0.8, contentFit: 'contain' });
  assert.ok(musicKeys.artistPhoto('Cameo').includes(ARTIST_PHOTO_VERSION));
  assert.ok(musicKeys.artistPhotos(['Cameo']).includes(ARTIST_PHOTO_VERSION));
});

it('keeps both public GET routes read-only and restricted to reviewed, published artists', () => {
  const route = readFileSync(new URL('../../../../apps/web/app/api/music/artist-photo/route.ts', import.meta.url), 'utf8');
  const imageRoute = readFileSync(new URL('../../../../apps/web/app/api/music/artist-photo/image/route.ts', import.meta.url), 'utf8');
  for (const source of [route, imageRoute]) {
    assert.doesNotMatch(source, /persistRightsCleared|payload\.(?:create|update|delete)|resolveVerifiedArtistPhoto|resolveArtistPhotos/);
    assert.match(source, /listMusicArtists/);
    assert.match(source, /resolveReviewedArtistPhoto/);
  }
  assert.match(route, /allowedNames\.has\(name\)/);
  assert.match(imageRoute, /artistPhotoCatalogueStatus\(catalogue, name\)/);
  const catalogueGuard = readFileSync(new URL('../../../../apps/web/lib/artist-photo-catalogue.ts', import.meta.url), 'utf8');
  assert.match(catalogueGuard, /catalogue\.data\.some\(\(artist\) => artist\.name === name\)/);
  assert.match(catalogueGuard, /catalogue\.status !== 'ok'\) return 503/);
});


it('social previews replace all quarantined photos, retain later uploads, and cover missing headshots', () => {
  for (const artist of evidence.artists.filter((item: { storedAction: string }) => item.storedAction === 'replace-known-defect')) {
    const old = { name: artist.name, headshot: { url: 'https://cms.example/old.jpg', sourceUrl: artist.storedSourceAtAudit, altText: 'Old image' } };
    assert.equal(musicArtistOpenGraphPhoto(old)?.url, resolveReviewedArtistPhoto(artist.name)?.url);
    const corrected = { ...old, headshot: { ...old.headshot, url: 'https://cms.example/new.jpg', sourceUrl: 'https://example.org/new-upload' } };
    assert.equal(musicArtistOpenGraphPhoto(corrected)?.url, corrected.headshot.url);
  }
  assert.equal(musicArtistOpenGraphPhoto({ name: 'Vado' })?.url, resolveReviewedArtistPhoto('Vado')?.url);
  assert.equal(musicArtistOpenGraphPhoto({ name: 'Unknown' }), undefined);
});
