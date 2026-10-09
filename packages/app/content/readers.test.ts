import assert from 'node:assert/strict';
import test from 'node:test';
import type { EventDoc as Event, MediaDoc as Media, PlaceDoc as Place, StoryDoc as Story, WalkDoc as Walk } from './docs.ts';
import { createContentReaders, type ContentDocs, type ContentQuery, type ContentSource } from './readers.ts';

// Fixtures are synthetic test data for the mapping, not content. They never
// reach the CMS or a page.
const place = (id: number, slug: string): Place =>
  ({ id, slug, name: `Place ${id}` });

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

const fakeSource = (options: FakeOptions = {}) => {
  const queries: ContentQuery<keyof ContentDocs>[] = [];
  const source: ContentSource = {
    isConfigured: () => options.configured ?? true,
    async find(query) {
      queries.push(query);
      if (options.fail) throw options.fail;
      return (options.docs?.[query.collection] ?? []) as ContentDocs[typeof query.collection][];
    },
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

test('every query asks for published documents only', async () => {
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

test('events for a date use the New York day window, overlap semantics, earliest first', async () => {
  const { source, queries } = fakeSource();
  await createContentReaders(source).listEventsForDate('2026-10-07');
  const [query] = queries;
  assert.equal(query?.sort, 'startsAt');
  assert.deepEqual(query?.where, {
    and: [
      { _status: { equals: 'published' } },
      { startsAt: { less_than: '2026-10-08T04:00:00.000Z' } },
      { endsAt: { greater_than: '2026-10-07T04:00:00.000Z' } },
    ],
  });
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
    place: undefined,
    venueName: 'Uncatalogued venue',
    venueUrl: undefined,
    sourceUrl: 'https://example.org/listing',
    fetchedAt: '2026-10-01T00:00:00.000Z',
    lastVerifiedAt: '2026-10-06T00:00:00.000Z',
    ticketUrl: undefined,
  });
});
