import { normalizeArtistName, type ArtistPhotoResult } from './artist-photo.ts';
import { REVIEWED_ARTIST_PHOTOS } from './reviewed-artist-photo-data.ts';

/** Deterministic reviewed photos. Never substitute fuzzy search or changing page metadata. */
export function resolveReviewedArtistPhoto(name: string): ArtistPhotoResult | null {
  const photo = REVIEWED_ARTIST_PHOTOS[normalizeArtistName(name)];
  return photo ? { ...photo, name } : null;
}

export function resolveReviewedArtistPhotos(names: readonly string[]): Record<string, ArtistPhotoResult | null> {
  return Object.fromEntries(names.map((name) => [name, resolveReviewedArtistPhoto(name)]));
}
