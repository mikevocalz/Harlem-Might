import { NextResponse, type NextRequest } from 'next/server';
import { resolveReviewedArtistPhotos } from '@acme/app/features/music/reviewed-artist-photo.ts';
import { ARTIST_PHOTO_VERSION } from '@acme/app/features/music/artist-photo-policy.ts';
import { listMusicArtists } from '@acme/payload/server';

const PHOTO_CACHE_SECONDS = 60 * 60 * 24 * 7;

// This public GET is read-only. Durable media changes belong to an explicit,
// authenticated curation operation, never a visitor's page view or crawler.
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

  const photos = resolveReviewedArtistPhotos(names);

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
              `/api/music/artist-photo/image?name=${encodeURIComponent(name)}&v=${ARTIST_PHOTO_VERSION}`,
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
