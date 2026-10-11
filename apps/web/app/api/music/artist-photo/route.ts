import { NextResponse, type NextRequest } from 'next/server';
import {
  resolveArtistPhotos,
  type ArtistPhotoFetch,
  type ArtistPhotoResult,
} from '@acme/app/features/music/artist-photo.ts';
import {
  hasVerifiedArtistPhotoSource,
  resolveVerifiedArtistPhotos,
  type VerifiedArtistPhotoFetch,
} from '@acme/app/features/music/verified-artist-photo.ts';
import {
  listMusicArtists,
  persistRightsClearedMusicArtistHeadshot,
  type MusicArtistRecord,
} from '@acme/payload/server';

const PHOTO_CACHE_SECONDS = 60 * 60 * 24 * 7;
const PERSIST_CONCURRENCY = 4;

const cachedFetch: ArtistPhotoFetch & VerifiedArtistPhotoFetch = async (url, init) =>
  fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      'user-agent': 'HarlemMight/1.0 (+https://harlemmight.com)',
    },
    next: { revalidate: PHOTO_CACHE_SECONDS },
  });

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

  const verifiedNames = names.filter((name) => hasVerifiedArtistPhotoSource(name));
  const legacyNames = names.filter((name) => !hasVerifiedArtistPhotoSource(name));
  const [verifiedPhotos, legacyPhotos] = await Promise.all([
    resolveVerifiedArtistPhotos(verifiedNames, cachedFetch, 8),
    resolveArtistPhotos(legacyNames, cachedFetch, 8),
  ]);
  const photos = { ...legacyPhotos, ...verifiedPhotos };
  await persistRightsClearedPhotos(catalogue.data, photos);

  // Provider-reference images stay external and are never ingested into
  // Payload. Serve them through a name-allowlisted same-origin proxy so web,
  // native and headset clients do not need a growing remote-host allowlist.
  const publicPhotos = Object.fromEntries(
    Object.entries(photos).map(([name, photo]) => [
      name,
      photo?.provider === 'curated_web'
        ? {
            ...photo,
            url: new URL(
              `/api/music/artist-photo/image?name=${encodeURIComponent(name)}&v=4`,
              request.nextUrl.origin,
            ).href,
          }
        : photo,
    ]),
  );

  return NextResponse.json(
    { photos: publicPhotos },
    {
      headers: {
        'Cache-Control': `public, s-maxage=${PHOTO_CACHE_SECONDS}, stale-while-revalidate=86400`,
      },
    },
  );
}
