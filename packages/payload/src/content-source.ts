import type { ContentDocs, ContentDocument, ContentPage, ContentQuery, ContentSelect, ContentSource } from '@acme/app/content';
import type { Payload, Where } from 'payload';
import type { Event, MusicArtist, Place, Story, Walk } from './payload-types';

// Compile-time drift check: the generated CMS documents must satisfy the
// reader contract in packages/app/content/docs.ts.
type GeneratedDocs = { walks: Walk; stories: Story; events: Event; places: Place; 'music-artists': MusicArtist };
type AssertDocsMatch<T extends ContentDocs> = T;
export type CheckedContentDocs = AssertDocsMatch<GeneratedDocs>;

const TRANSIENT = /ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|timeout|terminated|Connection/i;

// Retries for transient connection failures only: the Neon pooler stalls
// after an idle suspend, and the local resolver has dropped its hostname
// (getaddrinfo ENOTFOUND) for a second at a time. Up to ~2 s of backoff;
// a query error or a third failure goes to the reader as `query-failed`.
async function withRetry<TSlug extends keyof ContentDocs, TSelect extends ContentSelect, T>(
  query: ContentQuery<TSlug, TSelect>,
  run: (query: ContentQuery<TSlug, TSelect>) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run(query);
    } catch (error) {
      const cause = String((error as Error).cause ?? error);
      if (attempt === 2 || !TRANSIENT.test(cause)) throw error;
      console.warn(`payload ${query.collection} read failed (${cause.slice(0, 80)}), retry ${attempt + 1}`);
      await new Promise((resolve) => setTimeout(resolve, 400 * 3 ** attempt));
    }
  }
}

/** The initialized SDK is injected so the production adapter can be tested offline. */
export function createPayloadContentSource({ getPayload, isConfigured }: {
  getPayload: () => Promise<Pick<Payload, 'find'>>;
  isConfigured: () => boolean;
}): ContentSource {
  async function findOnce<TSlug extends keyof ContentDocs, const TSelect extends ContentSelect = undefined>(
    query: ContentQuery<TSlug, TSelect>,
  ): Promise<ContentDocument<TSlug, TSelect>[]> {
    // getPayload caches the instance on module scope
    // (node_modules/payload/dist/index.d.ts: getPayload).
    const payload = await getPayload();
    // A computed select map makes the SDK claim complete documents. Widen
    // that claim to the one unconditional field before restoring our precise
    // selection contract below.
    const { docs }: ContentPage<{ id: number }> = await payload.find({
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
    // This boundary restores collection/selection correlation erased by
    // Object.fromEntries. CheckedContentDocs proves the unprojected schema;
    // Payload applies the include-list and always retains id. The assertion is
    // to the selected shape, never back to a complete document.
    return docs as ContentDocument<TSlug, TSelect>[];
  }

  async function findPageOnce<TSlug extends keyof ContentDocs, const TSelect extends ContentSelect = undefined>(
    query: ContentQuery<TSlug, TSelect>,
  ): Promise<ContentPage<ContentDocument<TSlug, TSelect>>> {
    const payload = await getPayload();
    const { docs, hasNextPage, totalDocs }: ContentPage<{ id: number }> = await payload.find({
      collection: query.collection,
      where: query.where as Where,
      depth: query.depth,
      limit: query.limit,
      page: query.page ?? 1,
      sort: query.sort,
      ...(query.select ? { select: Object.fromEntries(query.select.map((field) => [field, true])) } : {}),
      draft: false,
      overrideAccess: false,
    });
    return { docs: docs as ContentDocument<TSlug, TSelect>[], hasNextPage, totalDocs };
  }

  return {
    isConfigured,
    find: <TSlug extends keyof ContentDocs, const TSelect extends ContentSelect>(query: ContentQuery<TSlug, TSelect>) =>
      withRetry(query, findOnce),
    findPage: <TSlug extends keyof ContentDocs, const TSelect extends ContentSelect>(query: ContentQuery<TSlug, TSelect>) =>
      withRetry(query, findPageOnce),
  };
}
