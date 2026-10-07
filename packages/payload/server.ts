// @acme/payload/server — published-content readers for server code only
// (React Server Components, route handlers). The `server-only` marker turns
// an import from a client bundle into a build error.
import 'server-only';
import { createContentReaders, type ContentDocs, type ContentSource } from '@acme/app/content';
import { getPayload, type Where } from 'payload';
import config from './src/payload.config';
import type { Event, Story, Walk } from './src/payload-types';

// Compile-time drift check: the generated CMS documents must satisfy the
// reader contract in packages/app/content/docs.ts.
type GeneratedDocs = { walks: Walk; stories: Story; events: Event };
type AssertDocsMatch<T extends ContentDocs> = T;
export type CheckedContentDocs = AssertDocsMatch<GeneratedDocs>;

/**
 * Whether this process has a content database. Without one the readers return
 * `{ status: 'unavailable', reason: 'not-configured' }` instead of trying to
 * connect.
 */
export const isContentDatabaseConfigured = (): boolean => Boolean(process.env.DATABASE_URL);

const payloadSource: ContentSource = {
  isConfigured: isContentDatabaseConfigured,
  async find(query) {
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
      draft: false,
      // Run as an anonymous visitor so the collection read rule
      // (publishedOrCurator) applies on top of the reader's own filter.
      overrideAccess: false,
    });
    return docs;
  },
};

export const { listWalks, getWalk, listStories, getStory, listEventsForDate } =
  createContentReaders(payloadSource);

export { harlemToday, isHarlemDate } from '@acme/app/content';
export type {
  ContentResult,
  DetailResult,
  EventRecord,
  StoryRecord,
  WalkRecord,
} from '@acme/app/content';
