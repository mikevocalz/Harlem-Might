import { NextResponse, type NextRequest } from 'next/server';
import {
  resolveArtistPhotos,
  type ArtistPhotoFetch,
} from '@acme/app/features/music/artist-photo.ts';
import { listMusicArtists } from '@acme/payload/server';

const PHOTO_CACHE_SECONDS = 60 * 60 * 24 * 7;

const cachedFetch: ArtistPhotoFetch = async (url, init) =>
  fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      'user-agent': 'HarlemMight/1.0 (+https://harlemmight.com)',
    },
    next: { revalidate: PHOTO_CACHE_SECONDS },
  });

export async function GET(request: NextRequest) {
  const catalogue = await listMusicArtists();
  if (catalogue.status !== 'ok') {
    return NextResponse.json(
      { photos: {}, error: 'catalogue-unavailable' },
      { status: 503 },
    );
  }

  const allowedNames = new Set(catalogue.data.map((artist) => artist.name));
  const rawNames = request.nextUrl.searchParams.get('names') ?? '';
  const requested = rawNames
    .split('|')
    .map((name) => name.trim())
    .filter(Boolean);

  const names = [...new Set(requested.filter((name) => allowedNames.has(name)))]
    .sort()
    .slice(0, catalogue.data.length);

  if (names.length === 0) {
    return NextResponse.json({ photos: {} }, { status: 400 });
  }

  const photos = await resolveArtistPhotos(names, cachedFetch, 10);
  return NextResponse.json(
    { photos },
    {
      headers: {
        'Cache-Control': `public, s-maxage=${PHOTO_CACHE_SECONDS}, stale-while-revalidate=86400`,
      },
    },
  );
}
