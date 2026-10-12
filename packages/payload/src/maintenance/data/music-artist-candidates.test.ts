import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { musicArtistCandidates } from './music-artist-candidates.ts';

describe('Harlem Music seed catalogue', () => {
  it('keeps the complete 105-record catalogue', () => {
    assert.equal(musicArtistCandidates.length, 105);
  });

  it('never ships cloned biographies or featured videos', () => {
    const shortBios = musicArtistCandidates.map((artist) => artist.shortBio);
    const biographies = musicArtistCandidates.map((artist) => artist.biography);
    const videos = musicArtistCandidates.map((artist) => artist.featuredSong.youtubeUrl);

    assert.equal(new Set(shortBios).size, musicArtistCandidates.length);
    assert.equal(new Set(biographies).size, musicArtistCandidates.length);
    assert.equal(new Set(videos).size, musicArtistCandidates.length);
  });

  it('has the data needed for artist-specific presentation media', () => {
    for (const artist of musicArtistCandidates) {
      assert.ok(artist.name.trim(), 'artist name must not be blank');
      assert.ok(artist.slug.trim(), `${artist.name} needs a slug`);
      assert.ok(artist.era.trim(), `${artist.name} needs an era`);
      assert.ok(artist.shortBio.trim(), `${artist.name} needs a short bio`);
      assert.ok(artist.biography.trim(), `${artist.name} needs a biography`);
      assert.match(
        artist.featuredSong.youtubeUrl,
        /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}(?:[&#].*)?$/,
        `${artist.name} needs a valid featured YouTube watch URL`,
      );
    }
  });

  it('does not reintroduce the old editorial placeholder', () => {
    const oldPlaceholder = 'Editorial candidate pending verification';
    assert.equal(
      musicArtistCandidates.some(
        (artist) =>
          artist.shortBio.includes(oldPlaceholder) ||
          artist.biography.includes(oldPlaceholder),
      ),
      false,
    );
  });
});
