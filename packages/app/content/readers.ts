import type { EventDoc, MusicArtistDoc, PlaceDoc, StoryDoc, WalkDoc } from './docs.ts';
import { harlemDayBounds } from './harlem-time.ts';
import { mapEvent, mapMusicArtist, mapPlaceRecord, mapStory, mapWalk } from './map.ts';
import type { EventRecord, MusicArtistRecord, PlaceRecord, StoryRecord, WalkRecord } from './records.ts';
import {
  notConfigured,
  ok,
  queryFailed,
  type ContentResult,
  type DetailResult,
} from './result.ts';

/**
 * A Payload `where` clause. Kept structural here because packages/app cannot
 * import Payload's `Where` type; the binding passes it through unchanged.
 */
export type ContentWhere = { [field: string]: unknown };

/** Documents returned per collection, by slug. */
export interface ContentDocs {
  walks: WalkDoc;
  stories: StoryDoc;
  events: EventDoc;
  places: PlaceDoc;
  'music-artists': MusicArtistDoc;
}

/** The subset of a Payload Local API `find` call the readers use. */
export interface ContentQuery<TSlug extends keyof ContentDocs> {
  collection: TSlug;
  where: ContentWhere;
  depth: number;
  limit: number;
  sort?: string;
  /** 1-based page for {@linkcode ContentSource.findPage}; `find` ignores it. */
  page?: number;
  /**
   * Field include-list (Payload `select`). Omit to return whole documents.
   * Slim reads exist so a listing never pays for columns it cannot render.
   */
  select?: readonly string[];
}

/** One page of a paginated read. */
export interface ContentPage<TDoc> {
  docs: TDoc[];
  /** Whether Payload reports another page after this one. */
  hasNextPage: boolean;
  /** Documents matching the query across all pages. */
  totalDocs: number;
}

/**
 * Where documents come from. In production this is Payload's Local API,
 * bound in packages/payload/server.ts; tests pass an in-memory fake.
 */
export interface ContentSource {
  /** False when this process has no content database. */
  isConfigured(): boolean;
  /** Runs a published-only query. Rejects when the database cannot answer. */
  find<TSlug extends keyof ContentDocs>(query: ContentQuery<TSlug>): Promise<ContentDocs[TSlug][]>;
  /** Runs a published-only query one page at a time (`query.page`, 1-based). */
  findPage<TSlug extends keyof ContentDocs>(
    query: ContentQuery<TSlug>,
  ): Promise<ContentPage<ContentDocs[TSlug]>>;
}

export interface ContentReaders {
  listWalks(): Promise<ContentResult<WalkRecord[]>>;
  getWalk(slug: string): Promise<DetailResult<WalkRecord>>;
  listStories(): Promise<ContentResult<StoryRecord[]>>;
  getStory(slug: string): Promise<DetailResult<StoryRecord>>;
  /**
   * Published events that overlap one New York calendar day, earliest first.
   *
   * @param dateInNY `YYYY-MM-DD` in America/New_York (see `harlemToday()`).
   * @throws {RangeError} when `dateInNY` is not a real date. Validate route
   * params with `isHarlemDate()` first and 404 on failure.
   */
  listEventsForDate(dateInNY: string): Promise<ContentResult<EventRecord[]>>;
  /** Every catalogue place, name-ordered. Places are not versioned: import state is carried on the record itself. */
  listPlaces(): Promise<ContentResult<PlaceRecord[]>>;
  /**
   * The catalogue in the shape browse surfaces render — same `PlaceRecord`,
   * but the query selects only the columns Explore rows, the map and nearby
   * modules read. Detail facts (menus, phone, images…) stay in `getPlace`.
   */
  listExploreCatalogue(): Promise<ContentResult<PlaceRecord[]>>;
  /**
   * The map's read: `EXPLORE_POINT_FIELDS` only. The Explore map region
   * suspends on this while the list and sheet take `listExploreCatalogue`,
   * so dots and GL init never wait on catalogue columns they don't render.
   */
  listExplorePoints(): Promise<ContentResult<PlaceRecord[]>>;
  getPlace(slug: string): Promise<DetailResult<PlaceRecord>>;
  /** Resolves a stored generated path (osm-*, lpc-*, mon-*) for a permanent redirect. */
  getPlaceByLegacySlug(slug: string): Promise<DetailResult<PlaceRecord>>;
  /** Published Harlem artists, name-ordered. Draft candidates never leave the CMS. */
  listMusicArtists(): Promise<ContentResult<MusicArtistRecord[]>>;
  /** One {@linkcode MUSIC_PAGE_SIZE} page of the directory, 1-based. */
  listMusicArtistsPage(page?: number): Promise<ContentResult<MusicArtistPage>>;
  getMusicArtist(slug: string): Promise<DetailResult<MusicArtistRecord>>;
}

/** A page of the music directory. */
export interface MusicArtistPage {
  artists: MusicArtistRecord[];
  hasNextPage: boolean;
  totalDocs: number;
}

/** Hard cap per list read. No route shows more than this today. */
export const LIST_LIMIT = 100;

/** Artists per /music page — a full grid row-count on 2- and 3-column layouts. */
export const MUSIC_PAGE_SIZE = 24;

/**
 * Cap for the places catalogue read. Places is the browse corpus, not an
 * editorial list, so it gets its own limit sized well above the Harlem
 * import (1578 rows in October 2026).
 */
export const PLACES_LIMIT = 5000;

/**
 * Columns a browse surface needs. `kind`/`lifecycle`/`locationAccuracy` stay
 * because `PlaceRecord` requires them; menus, contact fields, opening hours
 * and image joins are detail-page facts fetched by `getPlace`.
 */
export const EXPLORE_PLACE_FIELDS = [
  'slug',
  'name',
  'kind',
  'lifecycle',
  'primaryCategory',
  'primaryArea',
  'summary',
  'location',
  'locationAccuracy',
  'locationSource',
  'address',
  'featured',
] as const;

/**
 * The subset the Explore map needs — enough for mapPlaceRecord plus the
 * marker's name/coords/featured flag. Reads about a third of the catalogue
 * row, so the map region resolves before the fuller catalogue does.
 */
export const EXPLORE_POINT_FIELDS = [
  'slug',
  'name',
  'kind',
  'lifecycle',
  'location',
  'locationAccuracy',
  'featured',
] as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Drafts never leave the CMS: versioned collections carry this clause, and
// the production source also runs with access control on
// (packages/payload/server.ts). Places is not versioned — it has no _status
// column — so its reads pass an empty base clause to `bySlug` instead.
const PUBLISHED: ContentWhere = { _status: { equals: 'published' } };

export const createContentReaders = (source: ContentSource): ContentReaders => {
  const list = async <TSlug extends keyof ContentDocs, TRecord>(
    query: ContentQuery<TSlug>,
    map: (doc: ContentDocs[TSlug]) => TRecord,
  ): Promise<ContentResult<TRecord[]>> => {
    if (!source.isConfigured()) return notConfigured();
    try {
      const docs = await source.find(query);
      return ok(docs.map(map));
    } catch (error) {
      return queryFailed(error);
    }
  };

  const bySlug = async <TSlug extends keyof ContentDocs, TRecord>(
    collection: TSlug,
    slug: string,
    map: (doc: ContentDocs[TSlug]) => TRecord,
    base: ContentWhere = PUBLISHED,
  ): Promise<DetailResult<TRecord>> => {
    // A malformed slug can never match a stored one (Payload validates the
    // same pattern on save), so skip the round trip.
    if (!SLUG_PATTERN.test(slug)) return source.isConfigured() ? { status: 'not-found' } : notConfigured();
    const result = await list({ collection, where: { and: [base, { slug: { equals: slug } }] }, depth: 1, limit: 1 }, map);
    if (result.status !== 'ok') return result;
    const [record] = result.data;
    return record === undefined ? { status: 'not-found' } : ok(record);
  };

  return {
    listWalks: () => list({ collection: 'walks', where: PUBLISHED, depth: 1, limit: LIST_LIMIT, sort: '-updatedAt' }, mapWalk),
    getWalk: (slug) => bySlug('walks', slug, mapWalk),
    listStories: () =>
      list({ collection: 'stories', where: PUBLISHED, depth: 1, limit: LIST_LIMIT, sort: '-publishedAt' }, mapStory),
    getStory: (slug) => bySlug('stories', slug, mapStory),
    listEventsForDate: (dateInNY) => {
      const { start, end } = harlemDayBounds(dateInNY);
      return list(
        {
          collection: 'events',
          where: {
            and: [
              PUBLISHED,
              { startsAt: { less_than: end.toISOString() } },
              { endsAt: { greater_than: start.toISOString() } },
            ],
          },
          depth: 1,
          limit: LIST_LIMIT,
          sort: 'startsAt',
        },
        mapEvent,
      );
    },
    listPlaces: () =>
      list({ collection: 'places', where: {}, depth: 0, limit: PLACES_LIMIT, sort: 'name' }, mapPlaceRecord),
    listExploreCatalogue: () =>
      list(
        { collection: 'places', where: {}, depth: 0, limit: PLACES_LIMIT, sort: 'name', select: EXPLORE_PLACE_FIELDS },
        mapPlaceRecord,
      ),
    listExplorePoints: () =>
      list(
        { collection: 'places', where: {}, depth: 0, limit: PLACES_LIMIT, sort: 'name', select: EXPLORE_POINT_FIELDS },
        mapPlaceRecord,
      ),
    getPlace: (slug) => bySlug('places', slug, mapPlaceRecord, {}),
    getPlaceByLegacySlug: async (slug) => {
      if (!SLUG_PATTERN.test(slug)) return source.isConfigured() ? { status: 'not-found' } : notConfigured();
      const result = await list(
        { collection: 'places', where: { 'legacySlugs.slug': { equals: slug } }, depth: 1, limit: 1 },
        mapPlaceRecord,
      );
      if (result.status !== 'ok') return result;
      const [record] = result.data;
      return record === undefined ? { status: 'not-found' } : ok(record);
    },
    listMusicArtists: () =>
      list({ collection: 'music-artists', where: PUBLISHED, depth: 1, limit: LIST_LIMIT, sort: 'name' }, mapMusicArtist),
    listMusicArtistsPage: async (page = 1) => {
      if (!source.isConfigured()) return notConfigured();
      try {
        const result = await source.findPage({
          collection: 'music-artists',
          where: PUBLISHED,
          depth: 1,
          limit: MUSIC_PAGE_SIZE,
          sort: 'name,id',
          page,
        });
        return ok({
          artists: result.docs.map(mapMusicArtist),
          hasNextPage: result.hasNextPage,
          totalDocs: result.totalDocs,
        });
      } catch (error) {
        return queryFailed(error);
      }
    },
    getMusicArtist: (slug) => bySlug('music-artists', slug, mapMusicArtist),
  };
};
