import {
  isArtistPhotoResult,
  type ArtistPhotoResult,
} from './artist-photo.ts';

const PHOTO_RESOLVER_VERSION = '3';

const photoServiceBase = (): string | undefined => {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;

  const payloadBase = process.env.EXPO_PUBLIC_PAYLOAD_API_BASE;
  if (payloadBase) {
    try {
      return new URL(payloadBase).origin;
    } catch {
      // Fall through to the explicit app URL only if it is itself an HTTP origin.
    }
  }

  const appUrl = process.env.EXPO_PUBLIC_APP_URL;
  return appUrl && /^https?:\/\//i.test(appUrl) ? appUrl : undefined;
};

export const artistPhotoEndpoint = (names: readonly string[]): string => {
  const query = new URLSearchParams({
    v: PHOTO_RESOLVER_VERSION,
    names: names.join('|'),
  });
  const path = `/api/music/artist-photo?${query.toString()}`;
  const base = photoServiceBase();
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
