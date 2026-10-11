// @acme/payload/server — published-content readers for server code only
// (React Server Components, route handlers). The `server-only` marker turns
// an import from a client bundle into a build error.
import 'server-only';
import { fetchPublicPhotoResource } from './src/artist-photo-fetch.ts';
import { isFreeArtistPhotoLicense, isCommonsArtistPhotoUrl } from '@acme/app/features/music/artist-photo-rights.ts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createContentReaders, type ContentDocs, type ContentQuery, type ContentSource } from '@acme/app/content';
import { getPayload, type Where } from 'payload';
import config from './src/payload.config';
import type { Event, Media, MusicArtist, Place, Story, Walk } from './src/payload-types';

// Compile-time drift check: the generated CMS documents must satisfy the
// reader contract in packages/app/content/docs.ts.
type GeneratedDocs = { walks: Walk; stories: Story; events: Event; places: Place; 'music-artists': MusicArtist };
type AssertDocsMatch<T extends ContentDocs> = T;
export type CheckedContentDocs = AssertDocsMatch<GeneratedDocs>;

/**
 * Whether this process has a content database. Without one the readers return
 * `{ status: 'unavailable', reason: 'not-configured' }` instead of trying to
 * connect.
 */
export const isContentDatabaseConfigured = (): boolean => Boolean(process.env.DATABASE_URL);

const TRANSIENT = /ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|timeout|terminated|Connection/i;

const payloadSource: ContentSource = {
  isConfigured: isContentDatabaseConfigured,
  // Retries for transient connection failures only: the Neon pooler stalls
  // after an idle suspend, and the local resolver has dropped its hostname
  // (getaddrinfo ENOTFOUND) for a second at a time. Up to ~2 s of backoff;
  // a query error or a third failure goes to the reader as `query-failed`.
  async find(query) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await findOnce(query);
      } catch (error) {
        const cause = String((error as Error).cause ?? error);
        if (attempt === 2 || !TRANSIENT.test(cause)) throw error;
        console.warn(`payload ${query.collection} read failed (${cause.slice(0, 80)}), retry ${attempt + 1}`);
        await new Promise((resolve) => setTimeout(resolve, 400 * 3 ** attempt));
      }
    }
  },
};

async function findOnce<TSlug extends keyof ContentDocs>(
  query: ContentQuery<TSlug>,
): Promise<ContentDocs[TSlug][]> {
  // getPayload caches the instance on module scope
  // (node_modules/payload/dist/index.d.ts: getPayload).
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: query.collection,
    // The reader builds the clause from Payload operators; packages/app
    // cannot name Payload's `Where` type, so it is narrowed here.
    where: query.where as Where,
    depth: query.depth,
    limit: query.limit,
    sort: query.sort,
    // Readers never use totalDocs; skip the count(*) round trip.
    pagination: false,
    ...(query.select ? { select: Object.fromEntries(query.select.map((field) => [field, true])) } : {}),
    draft: false,
    // Run as an anonymous visitor so the collection read rule
    // (publishedOrCurator) applies on top of the reader's own filter.
    overrideAccess: false,
  });
  // CheckedContentDocs above proves the generated documents satisfy the
  // reader contract; the Payload overloads just can't express the
  // collection-keyed correlation, so it is asserted here.
  return docs as ContentDocs[TSlug][];
}

export type RightsClearedArtistPhoto = {
  name: string;
  url: string;
  sourceUrl: string;
  credit: string;
  license: string;
  licenseUrl?: string;
  width?: number;
  height?: number;
};

const imageExtension = (mime: string): 'jpg' | 'png' | 'webp' | undefined => {
  if (/^image\/jpe?g$/i.test(mime)) return 'jpg';
  if (/^image\/png$/i.test(mime)) return 'png';
  if (/^image\/webp$/i.test(mime)) return 'webp';
  return undefined;
};

/**
 * Persist a verified Commons artist photo into Payload Media and attach it to
 * the artist. This is deliberately stricter than the runtime display resolver:
 * provider-reference images (Deezer/editorial pages) are never copied into CMS.
 */
export async function persistRightsClearedMusicArtistHeadshot(
  artistId: number | string,
  photo: RightsClearedArtistPhoto,
): Promise<boolean> {
  if (!isContentDatabaseConfigured()) return false;

  let imageUrl: URL;
  let sourceUrl: URL;
  try {
    imageUrl = new URL(photo.url);
    sourceUrl = new URL(photo.sourceUrl);
  } catch {
    return false;
  }
  if (
    !isCommonsArtistPhotoUrl(imageUrl.href) ||
    sourceUrl.protocol !== 'https:' ||
    sourceUrl.hostname !== 'commons.wikimedia.org' ||
    !isFreeArtistPhotoLicense(photo.license)
  ) {
    return false;
  }

  const payload = await getPayload({ config });
  const artist = await payload.findByID({
    collection: 'music-artists',
    id: artistId,
    depth: 0,
    draft: false,
    overrideAccess: true,
  });
  if (artist.headshot) return true;

  const existing = await payload.find({
    collection: 'media',
    where: { sourceUrl: { equals: photo.sourceUrl } },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
  });

  let mediaId: Media['id'] | undefined = existing.docs[0]?.id;
  if (!mediaId) {
    const response = await fetchPublicPhotoResource(photo.url, { kind: 'image' });
    if (!response.ok) return false;

    const mime = response.contentType;
    const extension = imageExtension(mime);
    if (!extension) return false;
    const bytes = Buffer.from(response.bytes);
    if (bytes.length === 0 || bytes.length > 20 * 1024 * 1024) return false;

    const dir = await mkdtemp(path.join(tmpdir(), 'harlem-music-headshot-'));
    const filePath = path.join(dir, `artist-${String(artistId)}.${extension}`);
    try {
      await writeFile(filePath, bytes);
      const created = await payload.create({
        collection: 'media',
        overrideAccess: true,
        data: {
          alt: `${photo.name} artist portrait`,
          role: 'thumbnail',
          source: 'wikimedia_commons',
          sourceUrl: photo.sourceUrl,
          license: photo.license,
          licenseUrl: photo.licenseUrl,
          creator: photo.credit,
          credit: photo.credit,
          attributionText: `${photo.name} — ${photo.credit}, ${photo.license}, via Wikimedia Commons`,
          ingestedAt: new Date().toISOString(),
          shareAlike: /by-sa/i.test(photo.license),
          noDerivatives: false,
        },
        filePath,
      });
      mediaId = created.id;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  if (!mediaId) return false;
  await payload.update({
    collection: 'music-artists',
    id: artistId,
    overrideAccess: true,
    draft: false,
    data: { headshot: mediaId },
  });
  return true;
}

export const {
  listWalks,
  getWalk,
  getPlace,
  getPlaceByLegacySlug,
  listPlaces,
  listExploreCatalogue,
  listExplorePoints,
  listStories,
  getStory,
  listMusicArtists,
  getMusicArtist,
  listEventsForDate,
} = createContentReaders(payloadSource);

export { harlemToday, isHarlemDate } from '@acme/app/content';
export type {
  ContentResult,
  DetailResult,
  EventRecord,
  MusicArtistRecord,
  PlaceRecord,
  PlaceRef,
  StoryRecord,
  WalkRecord,
} from '@acme/app/content';
