import { normalizeArtistName, type ArtistPhotoResult } from './artist-photo.ts';
import { REVIEWED_ARTIST_PHOTOS } from './reviewed-artist-photo-data.ts';

/** Deterministic reviewed photos. Never substitute fuzzy search or changing page metadata. */
export function resolveReviewedArtistPhoto(name: string): ArtistPhotoResult | null {
  const key = normalizeArtistName(name);
  const photo = Object.hasOwn(REVIEWED_ARTIST_PHOTOS, key) ? REVIEWED_ARTIST_PHOTOS[key] : undefined;
  return photo ? { ...photo, name } : null;
}

export function resolveReviewedArtistPhotos(names: readonly string[]): Record<string, ArtistPhotoResult | null> {
  return Object.fromEntries(names.map((name) => [name, resolveReviewedArtistPhoto(name)]));
}
