import { NextResponse, type NextRequest } from 'next/server';
import {
  resolveArtistPhotos,
  type ArtistPhotoFetch,
} from '@acme/app/features/music/artist-photo.ts';

const PHOTO_CACHE_SECONDS = 60 * 60 * 24 * 7;

const cachedFetch: ArtistPhotoFetch = async (url, init) =>
  fetch(url, {
    ...init,
    next: { revalidate: PHOTO_CACHE_SECONDS },
  });

export async function GET(request: NextRequest) {
  const rawNames = request.nextUrl.searchParams.get('names') ?? '';
  const names = rawNames
    .split('|')
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 120);

  if (names.length === 0) {
    return NextResponse.json({ photos: {} }, { status: 400 });
  }

  const photos = await resolveArtistPhotos(names, cachedFetch, 12);
  return NextResponse.json(
    { photos },
    {
      headers: {
        'Cache-Control': `public, s-maxage=${PHOTO_CACHE_SECONDS}, stale-while-revalidate=86400`,
      },
    },
  );
}
