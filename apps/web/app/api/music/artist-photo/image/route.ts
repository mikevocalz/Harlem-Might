import { NextResponse, type NextRequest } from 'next/server';
import {
  hasVerifiedArtistPhotoSource,
  resolveVerifiedArtistPhoto,
  type VerifiedArtistPhotoFetch,
} from '@acme/app/features/music/verified-artist-photo.ts';
import { listMusicArtists } from '@acme/payload/server';

const PHOTO_CACHE_SECONDS = 60 * 60 * 24 * 7;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const cachedFetch: VerifiedArtistPhotoFetch = async (url, init) =>
  fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      'user-agent': 'HarlemMight/1.0 (+https://harlemmight.com)',
    },
    next: { revalidate: PHOTO_CACHE_SECONDS },
  });

const isPublicHttpsUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host === '0.0.0.0' ||
      host === '::1' ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host)
    ) {
      return false;
    }
    const match = host.match(/^172\.(\d+)\./);
    return !match || Number(match[1]) < 16 || Number(match[1]) > 31;
  } catch {
    return false;
  }
};

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

  const photo = await resolveVerifiedArtistPhoto(name, cachedFetch);
  if (
    !photo ||
    photo.provider !== 'curated_web' ||
    !isPublicHttpsUrl(photo.url)
  ) {
    return new NextResponse('Not found', { status: 404 });
  }

  const upstream = await fetch(photo.url, {
    headers: {
      accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1',
      'user-agent': 'HarlemMight/1.0 (+https://harlemmight.com)',
      referer: photo.sourceUrl,
    },
    next: { revalidate: PHOTO_CACHE_SECONDS },
    signal: AbortSignal.timeout(30_000),
  });
  if (!upstream.ok) {
    return new NextResponse('Image unavailable', { status: 502 });
  }

  const contentType = upstream.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (!/^image\/(jpeg|png|webp|gif|avif)$/i.test(contentType)) {
    return new NextResponse('Unsupported image', { status: 415 });
  }

  const declaredLength = Number(upstream.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_IMAGE_BYTES) {
    return new NextResponse('Image too large', { status: 413 });
  }

  const bytes = await upstream.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    return new NextResponse('Image too large', { status: 413 });
  }

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': `public, s-maxage=${PHOTO_CACHE_SECONDS}, stale-while-revalidate=86400`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
}
