// @acme/payload/server — published-content readers for server code only
// (React Server Components, route handlers). The `server-only` marker turns
// an import from a client bundle into a build error.
import 'server-only';
import { createContentReaders, type ContentDocs, type ContentQuery, type ContentSource } from '@acme/app/content';
import { getPayload, type Where } from 'payload';
import config from './src/payload.config';
import type { Event, Place, Story, Walk } from './src/payload-types';

// Compile-time drift check: the generated CMS documents must satisfy the
// reader contract in packages/app/content/docs.ts.
type GeneratedDocs = { walks: Walk; stories: Story; events: Event; places: Place };
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
  listEventsForDate,
} = createContentReaders(payloadSource);

export { harlemToday, isHarlemDate } from '@acme/app/content';
export type {
  ContentResult,
  DetailResult,
  EventRecord,
  PlaceRecord,
  PlaceRef,
  StoryRecord,
  WalkRecord,
} from '@acme/app/content';
