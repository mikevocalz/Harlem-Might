import { cachedArtistPhotoFetch } from '../../../../../lib/artist-photo-fetch.ts';
import { NextResponse, type NextRequest } from 'next/server';
import {
  hasVerifiedArtistPhotoSource,
  resolveVerifiedArtistPhoto,
} from '@acme/app/features/music/verified-artist-photo.ts';
import { listMusicArtists } from '@acme/payload/server';
import { fetchPublicPhotoResource, PhotoFetchError } from '@acme/payload/artist-photo-fetch';

const PHOTO_CACHE_SECONDS = 60 * 60 * 24 * 7;

/** Only catalogue-selected references may reach the bounded, DNS-validated proxy. */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name')?.trim() ?? '';
  if (!name || !hasVerifiedArtistPhotoSource(name)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const catalogue = await listMusicArtists();
  if (
    catalogue.status !== 'ok' ||
    !catalogue.data.some((artist) => artist.name === name)
  ) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const photo = await resolveVerifiedArtistPhoto(name, cachedArtistPhotoFetch);
    if (!photo || photo.provider !== 'curated_web') {
      return new NextResponse('Not found', { status: 404 });
    }
    const upstream = await fetchPublicPhotoResource(photo.url, {
      kind: 'image',
      headers: {
        accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif',
        referer: photo.sourceUrl,
      },
    });
    return new NextResponse(upstream.bytes, {
      headers: {
        'Content-Type': upstream.contentType,
        'Cache-Control': `public, s-maxage=${PHOTO_CACHE_SECONDS}, stale-while-revalidate=86400`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    });
  } catch (error) {
    const status = error instanceof PhotoFetchError && error.reason === 'too-large'
      ? 413
      : error instanceof PhotoFetchError && error.reason === 'unsupported' ? 415 : 502;
    return new NextResponse('Image unavailable', { status });
  }
}
