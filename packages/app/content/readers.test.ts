import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  EventDoc as Event,
  MediaDoc as Media,
  MusicArtistDoc as Artist,
  PlaceDoc as Place,
  StoryDoc as Story,
  WalkDoc as Walk,
} from './docs.ts';
import { addHarlemDays } from './harlem-time.ts';
import { createRestContentSource } from './rest-source.ts';
import { explorePlaceFromRecord } from '../features/explore/catalogue.ts';
import {
  createContentReaders,
  EVENT_RANGE_DAYS,
  EVENTS_PAGE_SIZE,
  MUSIC_PAGE_SIZE,
  type ContentDocs,
  type ContentQuery,
  type ContentSelect,
  type ContentSource,
  type ContentWhere,
} from './readers.ts';

// Fixtures are synthetic test data for the mapping, not content. They never
// reach the CMS or a page.
const place = (id: number, slug: string): Place =>
  ({ id, slug, name: `Place ${id}`, kind: 'culture', lifecycle: 'unknown', locationAccuracy: 'pending' });

const walk: Walk = {
  id: 1,
  title: 'Test walk',
  slug: 'test-walk',
  summary: 'Summary.',
  stops: [
    { place: place(10, 'stop-a'), note: 'Look up.' },
    { place: 11, note: null },
  ],
  distanceMeters: 1200,
  durationMinutes: 30,
  startDescription: 'Corner A',
  endDescription: 'Corner B',
  accessibility: { note: 'Two steps at the entrance.', sourceUrl: null, verifiedAt: null },
  sources: [{ label: 'Source', url: null, accessedAt: null }],
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const media: Media = { alt: 'Alt', url: '/media/a.jpg', width: 800, height: 600 };

const artist = (id: number, slug: string): Artist => ({
  id,
  slug,
  name: `Artist ${id}`,
  genre: 'jazz',
  connection: 'scene',
  shortBio: 'Short.',
  biography: 'Long.',
  updatedAt: '2026-10-01T00:00:00.000Z',
});

const licensedMedia: Media = {
  id: 17,
  alt: 'A documented editorial photograph.',
  url: 'https://example.org/photo.jpg',
  role: 'hero',
  source: 'other',
  sourceUrl: 'https://example.org/source',
  license: 'Example license',
  licenseUrl: 'https://example.org/license',
  creator: 'Example photographer',
  credit: 'Example photographer',
  attributionText: 'Photograph by Example photographer',
  shareAlike: false,
  noDerivatives: false,
};

const story: Story = {
  id: 2,
  title: 'Test story',
  slug: 'test-story',
  body: 'Body.',
  author: 'Byline',
  places: [place(10, 'stop-a'), 12],
  archive: [
    { media, credit: 'Credit', rights: 'public_domain' },
    { media: 99, credit: 'Orphan credit', rights: 'licensed' },
  ],
  sources: null,
  updatedAt: '',
};

const event: Event = {
  id: 3,
  title: 'Test event',
  slug: 'test-event',
  startsAt: '2026-10-07T23:00:00.000Z',
  startsAt_tz: 'America/New_York',
  endsAt: '2026-10-08T01:00:00.000Z',
  lifecycle: 'cancelled',
  place: null,
  venueName: 'Uncatalogued venue',
  sourceUrl: 'https://example.org/listing',
  fetchedAt: '2026-10-01T00:00:00.000Z',
  lastVerifiedAt: '2026-10-06T00:00:00.000Z',
};

interface FakeOptions {
  configured?: boolean;
  docs?: Partial<{ [K in keyof ContentDocs]: ContentDocs[K][] }>;
  fail?: Error;
}

const projectDocs = (docs: ContentDocs[keyof ContentDocs][], select?: readonly string[]) =>
  select ? docs.map(doc => Object.fromEntries(Object.entries(doc).filter(([key]) => key === 'id' || select.includes(key)))) : docs;

const responseSource = (body: unknown) => createRestContentSource({
  apiUrl: 'https://content-fixture.test/payload-api',
  fetch: async () => ({ ok: true, status: 200, json: async () => body }),
});

const fakeSource = (options: FakeOptions = {}) => {
  const queries: ContentQuery<keyof ContentDocs>[] = [];
  const source: ContentSource = {
    isConfigured: () => options.configured ?? true,
    async find<TSlug extends keyof ContentDocs, const TSelect extends ContentSelect>(query: ContentQuery<TSlug, TSelect>) {
      queries.push(query);
      if (options.fail) throw options.fail;
      const docs = projectDocs(options.docs?.[query.collection] ?? [], query.select);
      return responseSource({ docs }).find(query);
    },
    async findPage<TSlug extends keyof ContentDocs, const TSelect extends ContentSelect>(query: ContentQuery<TSlug, TSelect>) {
      queries.push(query);
      if (options.fail) throw options.fail;
      const all = projectDocs(options.docs?.[query.collection] ?? [], query.select);
      const start = ((query.page ?? 1) - 1) * query.limit;
      return responseSource({
        docs: all.slice(start, start + query.limit), hasNextPage: start + query.limit < all.length, totalDocs: all.length,
      }).findPage(query);
    },
  };
  return { source, queries };
};

type VersionedEvent = Event & { _status: 'published' | 'draft' };

// Evaluate the reader's published/overlap query in memory so the boundary,
// draft and pagination assertions exercise the actual query it builds.
const matchesEventWhere = (doc: VersionedEvent, where: ContentWhere): boolean =>
  Object.entries(where).every(([field, clause]) => {
    if (field === 'and') return (clause as ContentWhere[]).every((item) => matchesEventWhere(doc, item));
    const value = doc[field as keyof VersionedEvent];
    return Object.entries(clause as Record<string, unknown>).every(([operator, boundary]) => {
      if (operator === 'equals') return value === boundary;
      assert.equal(typeof value, 'string');
      assert.equal(typeof boundary, 'string');
      if (operator === 'less_than') return String(value) < String(boundary);
      if (operator === 'greater_than') return String(value) > String(boundary);
      assert.fail(`Unsupported event query operator: ${operator}`);
    });
  });

const eventQuerySource = (docs: VersionedEvent[]) => {
  const { source, queries } = fakeSource();
  source.findPage = async <TSlug extends keyof ContentDocs, const TSelect extends ContentSelect>(query: ContentQuery<TSlug, TSelect>) => {
    assert.equal(query.collection, 'events');
    queries.push(query);
    const matches = docs.filter((doc) => matchesEventWhere(doc, query.where));
    const fields = query.sort?.split(',') ?? [];
    matches.sort((a, b) => {
      for (const field of fields) {
        const comparison = field === 'id' ? a.id - b.id : a.startsAt.localeCompare(b.startsAt);
        if (comparison !== 0) return comparison;
      }
      return 0;
    });
    const start = ((query.page ?? 1) - 1) * query.limit;
    return responseSource({
      docs: projectDocs(matches.slice(start, start + query.limit), query.select),
      hasNextPage: start + query.limit < matches.length,
      totalDocs: matches.length,
    }).findPage(query);
  };
  return { source, queries };
};

test('no database configured is "unavailable", not an empty list', async () => {
  const { source, queries } = fakeSource({ configured: false });
  const readers = createContentReaders(source);
  assert.deepEqual(await readers.listWalks(), { status: 'unavailable', reason: 'not-configured' });
  assert.deepEqual(await readers.getStory('anything'), { status: 'unavailable', reason: 'not-configured' });
  assert.deepEqual(await readers.getStory('Bad Slug'), { status: 'unavailable', reason: 'not-configured' });
  assert.equal(queries.length, 0);
});

test('a query that throws is "unavailable" with the error kept', async () => {
  const failure = new Error('connect ECONNREFUSED');
  const readers = createContentReaders(fakeSource({ fail: failure }).source);
  for (const result of [await readers.listStories(), await readers.getWalk('test-walk'), await readers.listEventsForDate('2026-10-07')]) {
    assert.equal(result.status, 'unavailable');
    assert.ok(result.status === 'unavailable' && result.reason === 'query-failed' && result.error === failure);
  }
});

test('a non-Error rejection is wrapped in an Error', async () => {
  const { source } = fakeSource();
  source.find = async () => {
    throw 'timeout';
  };
  const result = await createContentReaders(source).listWalks();
  assert.ok(result.status === 'unavailable' && result.reason === 'query-failed' && result.error.message === 'timeout');
});

test('an answered empty query is ok with an empty array', async () => {
  const readers = createContentReaders(fakeSource().source);
  assert.deepEqual(await readers.listWalks(), { status: 'ok', data: [] });
  assert.deepEqual(await readers.getWalk('missing-walk'), { status: 'not-found' });
});

test('malformed slugs are not-found without a query', async () => {
  const { source, queries } = fakeSource({ docs: { walks: [walk] } });
  assert.deepEqual(await createContentReaders(source).getWalk('../etc'), { status: 'not-found' });
  assert.equal(queries.length, 0);
});

test('versioned-content queries ask for published documents only', async () => {
  const { source, queries } = fakeSource();
  const readers = createContentReaders(source);
  await readers.listWalks();
  await readers.getWalk('test-walk');
  await readers.listStories();
  await readers.getStory('test-story');
  await readers.listEventsForDate('2026-10-07');
  assert.equal(queries.length, 5);
  for (const query of queries) {
    assert.match(JSON.stringify(query.where), /"_status":\{"equals":"published"\}/);
  }
});

test('place reads do not apply a status clause to the unversioned places collection', async () => {
  const { source, queries } = fakeSource();
  const readers = createContentReaders(source);
  await readers.listPlaces();
  await readers.getPlace('test-place');
  assert.equal(queries.length, 2);
  assert.deepEqual(queries[0]?.where, {});
  assert.deepEqual(queries[1]?.where, { and: [{}, { slug: { equals: 'test-place' } }] });
});

test('a generated source slug resolves through the stored legacy slug', async () => {
  const { source, queries } = fakeSource({ docs: { places: [place(10, 'the-edge')] } });
  const result = await createContentReaders(source).getPlaceByLegacySlug('osm-node-2768136308');
  assert.equal(result.status, 'ok');
  if (result.status === 'ok') assert.equal(result.data.slug, 'the-edge');
  assert.deepEqual(queries[0]?.where, { 'legacySlugs.slug': { equals: 'osm-node-2768136308' } });
});

test('invalid event dates reject the returned Promise without a synchronous throw', async () => {
  const { source, queries } = fakeSource();
  const readers = createContentReaders(source);
  for (const date of ['2026-02-30', 'not-a-date', '2026-13-01']) {
    let result: ReturnType<typeof readers.listEventsForDate> | undefined;
    assert.doesNotThrow(() => { result = readers.listEventsForDate(date); });
    assert.ok(result instanceof Promise);
    await assert.rejects(result, RangeError);
  }
  assert.equal(queries.length, 0);
});

test('events for a date use the New York day window, overlap semantics, earliest first', async () => {
  const { source, queries } = fakeSource();
  await createContentReaders(source).listEventsForDate('2026-10-07');
  const [query] = queries;
  assert.equal(query?.sort, 'startsAt,id');
  assert.deepEqual(query?.where, {
    and: [
      { _status: { equals: 'published' } },
      { startsAt: { less_than: '2026-10-08T04:00:00.000Z' } },
      { endsAt: { greater_than: '2026-10-07T04:00:00.000Z' } },
    ],
  });
});

test('event ranges include both NY dates and share the daily half-open overlap predicate', async () => {
  const { source, queries } = fakeSource();
  const readers = createContentReaders(source);
  await readers.listEventsForDate('2026-10-07');
  await readers.listEventsForDateRange('2026-10-07', '2026-10-07');
  assert.deepEqual(queries[1]?.where, queries[0]?.where);
  await readers.listEventsForDateRange('2026-10-07', '2026-10-09', 2);
  assert.deepEqual(queries[2], {
    collection: 'events',
    where: {
      and: [
        { _status: { equals: 'published' } },
        { startsAt: { less_than: '2026-10-10T04:00:00.000Z' } },
        { endsAt: { greater_than: '2026-10-07T04:00:00.000Z' } },
      ],
    },
    depth: 1,
    limit: EVENTS_PAGE_SIZE,
    sort: 'startsAt,id',
    page: 2,
  });
});

test('event range endpoints use New York midnight on both sides of DST transitions', async () => {
  const { source, queries } = fakeSource();
  const readers = createContentReaders(source);
  await readers.listEventsForDateRange('2026-03-07', '2026-03-09');
  await readers.listEventsForDateRange('2026-10-31', '2026-11-02');
  assert.deepEqual(queries.map((query) => query.where), [
    { and: [
      { _status: { equals: 'published' } },
      { startsAt: { less_than: '2026-03-10T04:00:00.000Z' } },
      { endsAt: { greater_than: '2026-03-07T05:00:00.000Z' } },
    ] },
    { and: [
      { _status: { equals: 'published' } },
      { startsAt: { less_than: '2026-11-03T05:00:00.000Z' } },
      { endsAt: { greater_than: '2026-10-31T04:00:00.000Z' } },
    ] },
  ]);
});

test('event ranges preserve ongoing/cancelled/postponed events and exclude drafts and outside midnight boundaries', async () => {
  const fixture = (id: number, patch: Partial<VersionedEvent> = {}): VersionedEvent => ({
    ...event, id, slug: `event-${id}`, _status: 'published', lifecycle: 'scheduled', ...patch,
  });
  const { source } = eventQuerySource([
    fixture(1, { startsAt: '2026-10-06T23:00:00.000Z', endsAt: '2026-10-07T05:00:00.000Z' }),
    fixture(2, { endsAt: '2026-10-07T04:00:00.000Z', startsAt: '2026-10-06T23:00:00.000Z' }),
    fixture(3, { startsAt: '2026-10-10T04:00:00.000Z', endsAt: '2026-10-10T06:00:00.000Z' }),
    fixture(4, { _status: 'draft' }),
    fixture(7, { startsAt: '2026-10-09T23:00:00.000Z', endsAt: '2026-10-10T03:59:59.999Z' }),
    fixture(6, { lifecycle: 'postponed', ticketUrl: 'https://example.org/tickets' }),
    fixture(5, { lifecycle: 'cancelled', ticketUrl: 'https://example.org/tickets' }),
    fixture(8, { startsAt: '2026-10-07T04:00:00.000Z', endsAt: '2026-10-07T05:00:00.000Z' }),
  ]);
  const result = await createContentReaders(source).listEventsForDateRange('2026-10-07', '2026-10-09');
  assert.equal(result.status, 'ok');
  if (result.status !== 'ok') return;
  assert.deepEqual(result.data.events.map((record) => [record.id, record.status]), [
    [1, 'scheduled'], [8, 'scheduled'], [5, 'cancelled'], [6, 'postponed'], [7, 'scheduled'],
  ]);
  assert.equal(result.data.totalDocs, 5);
  assert.equal(result.data.hasNextPage, false);
});

test('event ranges preserve totals and deterministic ordering across pages including beyond the final page', async () => {
  const docs: VersionedEvent[] = Array.from({ length: 50 }, (_, i) => ({
    ...event, id: 50 - i, slug: `event-${50 - i}`, _status: 'published',
  }));
  const { source, queries } = eventQuerySource(docs);
  const readers = createContentReaders(source);
  const records: number[] = [];
  for (const page of [1, 2, 3, 4]) {
    const result = await readers.listEventsForDateRange('2026-10-07', '2026-10-09', page);
    assert.equal(result.status, 'ok');
    if (result.status !== 'ok') return;
    assert.equal(result.data.totalDocs, 50);
    assert.equal(result.data.hasNextPage, page < 3);
    assert.equal(result.data.events.length, page < 3 ? EVENTS_PAGE_SIZE : page === 3 ? 2 : 0);
    records.push(...result.data.events.map((record) => record.id));
  }
  assert.deepEqual(records, Array.from({ length: 50 }, (_, i) => i + 1));
  assert.deepEqual(queries.map((query) => [query.page, query.limit, query.sort]), [
    [1, 24, 'startsAt,id'], [2, 24, 'startsAt,id'], [3, 24, 'startsAt,id'], [4, 24, 'startsAt,id'],
  ]);
});

test('event range reads distinguish an empty page, missing configuration and a failed query', async () => {
  const empty = fakeSource();
  assert.deepEqual(await createContentReaders(empty.source).listEventsForDateRange('2026-10-07', '2026-10-09'), {
    status: 'ok', data: { events: [], hasNextPage: false, totalDocs: 0 },
  });
  assert.equal(empty.queries[0]?.page, 1);
  const missing = fakeSource({ configured: false });
  assert.deepEqual(await createContentReaders(missing.source).listEventsForDateRange('2026-10-07', '2026-10-09'), {
    status: 'unavailable', reason: 'not-configured',
  });
  assert.equal(missing.queries.length, 0);
  const error = new Error('socket hangup');
  const failed = await createContentReaders(fakeSource({ fail: error }).source).listEventsForDateRange('2026-10-07', '2026-10-09');
  assert.deepEqual(failed, { status: 'unavailable', reason: 'query-failed', error });
});

test('event range validation rejects bad dates, reversed/overlong windows and invalid pages before querying', async () => {
  for (const configured of [true, false]) {
    const { source, queries } = fakeSource({ configured });
    const readers = createContentReaders(source);
    for (const [start, end] of [
      ['today', '2026-10-12'], ['2026-02-29', '2026-10-12'],
      ['2026-10-12', '2026-13-01'], ['2026-10-12', '2026-10-11'],
      ['2026-01-01', addHarlemDays('2026-01-01', EVENT_RANGE_DAYS)],
      ['2026-09-01', addHarlemDays('2026-09-01', EVENT_RANGE_DAYS)],
    ] as const) {
      await assert.rejects(readers.listEventsForDateRange(start, end), RangeError);
    }
    for (const page of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      await assert.rejects(readers.listEventsForDateRange('2026-10-12', '2026-10-12', page), RangeError);
    }
    assert.equal(queries.length, 0);
  }
});

test('a 90-calendar-day event range is valid through either DST transition', async () => {
  const { source, queries } = fakeSource();
  const readers = createContentReaders(source);
  for (const start of ['2026-01-01', '2026-09-01']) {
    const end = addHarlemDays(start, EVENT_RANGE_DAYS - 1);
    assert.equal((await readers.listEventsForDateRange(start, end)).status, 'ok');
  }
  assert.equal(queries.length, 2);
});

test('walk mapping keeps stop order and count, and drops an unsourced accessibility note', async () => {
  const result = await createContentReaders(fakeSource({ docs: { walks: [walk] } }).source).getWalk('test-walk');
  assert.equal(result.status, 'ok');
  if (result.status !== 'ok') return;
  assert.deepEqual(result.data.stops, [
    { position: 1, place: { id: 10, slug: 'stop-a', name: 'Place 10' }, note: 'Look up.' },
    { position: 2, place: undefined, note: undefined },
  ]);
  assert.equal(result.data.accessibility, undefined);
  assert.deepEqual(result.data.sources, [{ label: 'Source', url: undefined, accessedAt: undefined }]);
});

test('place detail reads carry only populated, rights-cleared images', async () => {
  const doc = { ...place(10, 'stop-a'), images: [licensedMedia, { ...licensedMedia, id: 18, credit: null }] };
  const result = await createContentReaders(fakeSource({ docs: { places: [doc] } }).source).getPlace('stop-a');
  assert.equal(result.status, 'ok');
  if (result.status !== 'ok') return;
  assert.equal(result.data.images?.length, 1);
  assert.equal(result.data.images?.[0]?.attributionText, 'Photograph by Example photographer');
});

test('story mapping drops unpopulated places and archive items without an image', async () => {
  const result = await createContentReaders(fakeSource({ docs: { stories: [story] } }).source).listStories();
  assert.equal(result.status, 'ok');
  if (result.status !== 'ok') return;
  const [mapped] = result.data;
  assert.deepEqual(mapped?.places, [{ id: 10, slug: 'stop-a', name: 'Place 10' }]);
  assert.equal(mapped?.archive.length, 1);
  assert.equal(mapped?.archive[0]?.credit, 'Credit');
  assert.equal(mapped?.archive[0]?.url, '/media/a.jpg');
  assert.deepEqual(mapped?.sources, []);
});

test('event mapping keeps cancelled status, venue fallback and provenance', async () => {
  const result = await createContentReaders(fakeSource({ docs: { events: [event] } }).source).listEventsForDate('2026-10-07');
  assert.equal(result.status, 'ok');
  if (result.status !== 'ok') return;
  assert.deepEqual(result.data[0], {
    id: 3,
    slug: 'test-event',
    title: 'Test event',
    startsAt: '2026-10-07T23:00:00.000Z',
    endsAt: '2026-10-08T01:00:00.000Z',
    timeZone: 'America/New_York',
    status: 'cancelled',
    images: [],
    place: undefined,
    venueName: 'Uncatalogued venue',
    venueUrl: undefined,
    sourceUrl: 'https://example.org/listing',
    fetchedAt: '2026-10-01T00:00:00.000Z',
    lastVerifiedAt: '2026-10-06T00:00:00.000Z',
    ticketUrl: undefined,
  });
});

for (const options of [
  { configured: true },
  { configured: false },
  { configured: true, fail: new Error('socket hangup') },
]) {
  test(`listMusicArtistsPage rejects invalid pages before configuration or queries (${JSON.stringify(options)})`, async () => {
    const { source, queries } = fakeSource(options);
    let configurationChecks = 0;
    const isConfigured = source.isConfigured;
    source.isConfigured = () => {
      configurationChecks++;
      return isConfigured();
    };
    const readers = createContentReaders(source);
    for (const page of [0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      await assert.rejects(readers.listMusicArtistsPage(page), {
        name: 'RangeError',
        message: 'Expected a positive safe integer music page.',
      }, `page ${page}`);
    }
    assert.equal(configurationChecks, 0);
    assert.deepEqual(queries, []);
  });
}

test('listMusicArtistsPage defaults to page 1 and accepts positive safe integer pages', async () => {
  const { source, queries } = fakeSource();
  const readers = createContentReaders(source);
  for (const page of [undefined, 1, 2, Number.MAX_SAFE_INTEGER]) {
    assert.deepEqual(await readers.listMusicArtistsPage(page), {
      status: 'ok', data: { artists: [], hasNextPage: false, totalDocs: 0 },
    });
  }
  assert.deepEqual(queries.map((query) => query.page), [1, 1, 2, Number.MAX_SAFE_INTEGER]);
});

test('listMusicArtistsPage keeps valid unconfigured reads unavailable without querying', async () => {
  const { source, queries } = fakeSource({ configured: false });
  const readers = createContentReaders(source);
  for (const page of [undefined, 1, 2, Number.MAX_SAFE_INTEGER]) {
    assert.deepEqual(await readers.listMusicArtistsPage(page), {
      status: 'unavailable', reason: 'not-configured',
    });
  }
  assert.deepEqual(queries, []);
});

test('listMusicArtistsPage pages the directory in MUSIC_PAGE_SIZE steps', async () => {
  const docs = Array.from({ length: 50 }, (_, i) => artist(100 + i, `artist-${i}`));
  const { source, queries } = fakeSource({ docs: { 'music-artists': docs } });
  const readers = createContentReaders(source);
  const first = await readers.listMusicArtistsPage(1);
  assert.equal(first.status, 'ok');
  if (first.status !== 'ok') return;
  assert.equal(first.data.artists.length, MUSIC_PAGE_SIZE);
  assert.equal(first.data.hasNextPage, true);
  assert.equal(first.data.totalDocs, 50);
  assert.equal(queries[0]?.sort, 'name,id', 'same-name artists need a stable unique tie-breaker');
  const last = await readers.listMusicArtistsPage(3);
  assert.equal(last.status, 'ok');
  if (last.status !== 'ok') return;
  assert.equal(last.data.artists.length, 2);
  assert.equal(last.data.hasNextPage, false);
  assert.deepEqual(
    queries.map((q) => [q.collection, q.page, q.limit]),
    [
      ['music-artists', 1, MUSIC_PAGE_SIZE],
      ['music-artists', 3, MUSIC_PAGE_SIZE],
    ],
  );
});

test('listMusicArtistsPage reports a failed read without leaking it', async () => {
  const readers = createContentReaders(fakeSource({ fail: new Error('socket hangup') }).source);
  const result = await readers.listMusicArtistsPage(2);
  assert.equal(result.status, 'unavailable');
  if (result.status !== 'unavailable') return;
  assert.equal(result.reason, 'query-failed');
});

test('listMusicArtists reads every published page, including artists 101 and 102', async () => {
  const docs = Array.from({ length: 102 }, (_, i) => artist(i + 1, `artist-${i + 1}`));
  docs[100]!.name = 'Vado';
  docs[101]!.name = 'Willie The Lion Smith';
  const { source, queries } = fakeSource({ docs: { 'music-artists': docs } });
  const result = await createContentReaders(source).listMusicArtists();
  assert.equal(result.status, 'ok');
  if (result.status !== 'ok') return;
  assert.equal(result.data.length, 102);
  assert.deepEqual(result.data.slice(-2).map((record) => record.name), ['Vado', 'Willie The Lion Smith']);
  assert.deepEqual(queries.map((query) => [query.page, query.limit, query.sort]), [[1, 100, 'name,id'], [2, 100, 'name,id']]);
  for (const query of queries) assert.deepEqual(query.where, { _status: { equals: 'published' } });
});

test('listMusicArtists never exposes a partial catalogue when a later page fails', async () => {
  const { source } = fakeSource({ docs: { 'music-artists': Array.from({ length: 102 }, (_, i) => artist(i, `artist-${i}`)) } });
  const findPage = source.findPage;
  source.findPage = async <TSlug extends keyof ContentDocs, const TSelect extends ContentSelect>(query: ContentQuery<TSlug, TSelect>) => {
    if (query.page === 2) throw new Error('Second-page read failed');
    return findPage(query);
  };
  const result = await createContentReaders(source).listMusicArtists();
  assert.equal(result.status, 'unavailable');
  assert.ok(!('data' in result));
});

test('listMusicArtists fails closed when a paginated source repeats records', async () => {
  const { source } = fakeSource({ docs: { 'music-artists': [artist(1, 'one')] } });
  const findPage = source.findPage;
  source.findPage = async <TSlug extends keyof ContentDocs, const TSelect extends ContentSelect>(query: ContentQuery<TSlug, TSelect>) => ({ ...await findPage({ ...query, page: 1 }), hasNextPage: true });
  assert.equal((await createContentReaders(source).listMusicArtists()).status, 'unavailable');
});

for (const accuracy of ['pending', 'approx', 'verified'] as const) {
  test(`${accuracy} place coordinates obey the read-model contract on every public projection`, async () => {
    const location = [-73.94, 40.81] as const;
    const doc: Place = {
      ...place(10, 'stop-a'), location, locationAccuracy: accuracy,
      locationSource: { url: 'https://example.org/place', verifiedAt: '2026-10-01T00:00:00Z' },
    };
    const readers = createContentReaders(fakeSource({ docs: {
      places: [doc], walks: [{ ...walk, stops: [{ place: doc }] }],
      stories: [{ ...story, places: [doc] }], events: [{ ...event, place: doc }],
    } }).source);
    const expected = accuracy === 'pending' ? undefined : location;
    for (const result of [await readers.listPlaces(), await readers.listExploreCatalogue(), await readers.listExplorePoints()]) {
      assert.ok(result.status === 'ok');
      assert.equal(result.data.length, 1, 'Pending locations retain their catalogue record');
      assert.deepEqual(result.data[0]!.location, expected);
      assert.equal(result.data[0]!.locationAccuracy, accuracy);
      assert.deepEqual(explorePlaceFromRecord(result.data[0]!).lngLat, expected);
    }
    for (const result of [await readers.getPlace(doc.slug), await readers.getPlaceByLegacySlug('legacy-stop')]) {
      assert.ok(result.status === 'ok');
      assert.deepEqual(result.data.location, expected);
      assert.equal(result.data.locationAccuracy, accuracy);
      assert.equal(result.data.locationSourceUrl, doc.locationSource!.url);
      assert.equal(result.data.locationSourceReadAt, doc.locationSource!.verifiedAt);
    }
    const walkResult = await readers.getWalk(walk.slug);
    const storyResult = await readers.getStory(story.slug);
    const eventResult = await readers.listEventsForDate('2026-10-07');
    assert.ok(walkResult.status === 'ok' && storyResult.status === 'ok' && eventResult.status === 'ok');
    for (const related of [walkResult.data.stops[0]!.place, storyResult.data.places[0], eventResult.data[0]!.place]) {
      assert.ok(related, 'Pending locations retain their place relationship');
      assert.equal(related.slug, doc.slug);
      assert.deepEqual(related.lngLat, expected);
    }
    assert.deepEqual(doc.location, location, 'Mapping does not mutate the editorial source');
  });
}
