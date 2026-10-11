import {
  isArtistPhotoResult,
  type ArtistPhotoResult,
} from './artist-photo.ts';

export const artistPhotoEndpoint = (names: readonly string[]): string => {
  const path = `/api/music/artist-photo?names=${encodeURIComponent(names.join('|'))}`;
  const base =
    process.env.EXPO_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) return path;
  try {
    return new URL(path, base).href;
  } catch {
    return path;
  }
};

export async function fetchArtistPhotos(
  names: readonly string[],
): Promise<Record<string, ArtistPhotoResult | null>> {
  const response = await fetch(artistPhotoEndpoint(names), {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Artist photo service answered ${response.status}`);
  const body = (await response.json()) as { photos?: Record<string, unknown> };
  const photos: Record<string, ArtistPhotoResult | null> = {};
  for (const name of names) {
    const value = body.photos?.[name];
    photos[name] = isArtistPhotoResult(value) ? value : null;
  }
  return photos;
}
