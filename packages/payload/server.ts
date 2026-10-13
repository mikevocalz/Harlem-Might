// @acme/payload/server — published-content readers for server code only
// (React Server Components, route handlers). The `server-only` marker turns
// an import from a client bundle into a build error.
import 'server-only';
import { createContentReaders } from '@acme/app/content';
import { getPayload } from 'payload';
import { createPayloadContentSource } from './src/content-source.ts';
import config from './src/payload.config';

export type { CheckedContentDocs } from './src/content-source.ts';

/**
 * Whether this process has a content database. Without one the readers return
 * `{ status: 'unavailable', reason: 'not-configured' }` instead of trying to
 * connect.
 */
export const isContentDatabaseConfigured = (): boolean => Boolean(process.env.DATABASE_URL);

const payloadSource = createPayloadContentSource({
  isConfigured: isContentDatabaseConfigured,
  // Payload caches its initialized instance; this does not connect until a read.
  getPayload: () => getPayload({ config }),
});

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
  listMusicArtistsPage,
  getMusicArtist,
  listEventsForDate,
  listEventsForDateRange,
} = createContentReaders(payloadSource);

export { addHarlemDays, EVENT_RANGE_DAYS, EVENTS_PAGE_SIZE, harlemToday, isHarlemDate } from '@acme/app/content';
export type {
  ContentResult,
  DetailResult,
  EventPage,
  EventRecord,
  MusicArtistPage,
  MusicArtistRecord,
  PlaceRecord,
  PlaceRef,
  StoryRecord,
  WalkRecord,
} from '@acme/app/content';
