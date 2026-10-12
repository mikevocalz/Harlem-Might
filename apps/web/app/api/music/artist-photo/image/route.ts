import { NextResponse, type NextRequest } from 'next/server';
import {
  resolveReviewedArtistPhoto,
} from '@acme/app/features/music/reviewed-artist-photo.ts';
import { listMusicArtists } from '@acme/payload/server';
import { fetchPublicPhotoResource, PhotoFetchError } from '@acme/payload/artist-photo-fetch';

import { artistPhotoCatalogueStatus } from '@/lib/artist-photo-catalogue';

const PHOTO_CACHE_SECONDS = 60 * 60 * 24 * 7;

/** Only catalogue-selected references may reach the bounded, DNS-validated proxy. */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name')?.trim() ?? '';
  const photo = resolveReviewedArtistPhoto(name);
  if (!name || !photo || photo.provider !== 'curated_web') {
    return new NextResponse('Not found', { status: 404 });
  }

  const catalogue = await listMusicArtists();
  const catalogueStatus = artistPhotoCatalogueStatus(catalogue, name);
  if (catalogueStatus) {
    return new NextResponse(catalogueStatus === 503 ? 'Image unavailable' : 'Not found', { status: catalogueStatus });
  }

  try {
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
