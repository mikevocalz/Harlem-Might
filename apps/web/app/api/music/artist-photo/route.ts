import { cachedArtistPhotoFetch } from '../../../../lib/artist-photo-fetch.ts';
import { NextResponse, type NextRequest } from 'next/server';
import {
  resolveArtistPhotos,
  type ArtistPhotoResult,
} from '@acme/app/features/music/artist-photo.ts';
import {
  listMusicArtists,
  persistRightsClearedMusicArtistHeadshot,
  type MusicArtistRecord,
} from '@acme/payload/server';

const PHOTO_CACHE_SECONDS = 60 * 60 * 24 * 7;
const PERSIST_CONCURRENCY = 4;

const cachedFetch = cachedArtistPhotoFetch;

async function persistRightsClearedPhotos(
  catalogue: readonly MusicArtistRecord[],
  photos: Record<string, ArtistPhotoResult | null>,
): Promise<void> {
  const byName = new Map(catalogue.map((artist) => [artist.name, artist]));
  const queue = Object.entries(photos).filter(
    ([name, photo]) =>
      Boolean(photo) &&
      photo?.provider === 'wikimedia_commons' &&
      photo.rightsStatus === 'rights-cleared' &&
      Boolean(photo.license) &&
      !byName.get(name)?.headshot,
  );
  let cursor = 0;

  const workers = Array.from(
    { length: Math.min(PERSIST_CONCURRENCY, queue.length) },
    async () => {
      while (cursor < queue.length) {
        const item = queue[cursor++];
        if (!item) continue;
        const [name, photo] = item;
        const artist = byName.get(name);
        if (!artist || !photo?.license) continue;
        try {
          await persistRightsClearedMusicArtistHeadshot(artist.id, {
            name,
            url: photo.url,
            sourceUrl: photo.sourceUrl,
            credit: photo.credit,
            license: photo.license,
            licenseUrl: photo.licenseUrl,
            width: photo.width,
            height: photo.height,
          });
        } catch (error) {
          // Photo display must still succeed if durable CMS caching fails.
          console.warn(
            `artist headshot persistence failed for ${name}: ${String(error).slice(0, 180)}`,
          );
        }
      }
    },
  );

  await Promise.all(workers);
}

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
  await persistRightsClearedPhotos(catalogue.data, photos);

  return NextResponse.json(
    { photos },
    {
      headers: {
        'Cache-Control': `public, s-maxage=${PHOTO_CACHE_SECONDS}, stale-while-revalidate=86400`,
      },
    },
  );
}
