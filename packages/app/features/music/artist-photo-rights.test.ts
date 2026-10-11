import assert from 'node:assert/strict';
import { it } from 'node:test';
import { isFreeArtistPhotoLicense, isCommonsArtistPhotoUrl } from './artist-photo-rights.ts';

it('requires an explicit compatible licence without inventing missing rights', () => {
  for (const license of ['Public domain', 'CC0 1.0', 'CC BY 4.0', 'CC BY 2.5', 'CC BY-SA 3.0', 'CC-BY-SA-4.0']) {
    assert.equal(isFreeArtistPhotoLicense(license), true, license);
  }
  for (const license of [undefined, '', 'Wikimedia Commons free media', 'CC-BY-NC 4.0', 'CC BY-ND 4.0', 'CC-BY-SA-NC 4.0', 'Public domain unless noted', 'All rights reserved']) {
    assert.equal(isFreeArtistPhotoLicense(license), false, String(license));
  }
});

it('only accepts Commons media from its HTTPS upload path', () => {
  assert.equal(isCommonsArtistPhotoUrl('https://upload.wikimedia.org/wikipedia/commons/a/ab/Portrait.jpg'), true);
  for (const url of ['http://upload.wikimedia.org/wikipedia/commons/a.jpg', 'https://upload.wikimedia.org.evil.example/wikipedia/commons/a.jpg', 'https://upload.wikimedia.org/elsewhere.jpg', 'https://x:secret@upload.wikimedia.org/wikipedia/commons/a.jpg', 'https://upload.wikimedia.org:8443/wikipedia/commons/a.jpg']) {
    assert.equal(isCommonsArtistPhotoUrl(url), false, url);
  }
});
