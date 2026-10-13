import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ModuleKind, transpileModule } from 'typescript';
import * as content from '@acme/app/content';

type FindResult = { docs: never[]; hasNextPage: boolean; totalDocs: number };
function loadReaders(configured: boolean, answer?: (query: Record<string, unknown>, attempt: number) => FindResult) {
  const reads: Record<string, unknown>[] = [];
  let initializations = 0;
  const delays: number[] = [];
  const warnings: string[] = [];
  const config = { test: 'configuration identity only; no database connection' };
  const modules: Record<string, unknown> = {
    'server-only': {},
    '@acme/app/content': content,
    './src/payload.config': { __esModule: true, default: config },
    payload: {
      getPayload: async (options: { config: unknown }) => {
        assert.equal(options.config, config);
        initializations++;
        return {
          async find(query: Record<string, unknown>) {
            reads.push(query);
            return answer?.(query, reads.length) ?? { docs: [], hasNextPage: false, totalDocs: 0 };
          },
          create: () => assert.fail('Published readers must not create CMS data'),
          update: () => assert.fail('Published readers must not update CMS data'),
          delete: () => assert.fail('Published readers must not delete CMS data'),
        };
      },
    },
  };
  const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
  const exports = {} as typeof import('../server.ts');
  // Only the fixed local reader entry is evaluated. Config/Payload/network and
  // filesystem operations are replaced or forbidden before module evaluation.
  new Function('require', 'exports', 'process', 'setTimeout', 'console', compiled)((specifier: string) => {
    assert.ok(Object.hasOwn(modules, specifier), `Unexpected reader runtime dependency: ${specifier}`);
    return modules[specifier];
  }, exports, { env: { DATABASE_URL: configured ? 'test-configured' : undefined } },
  (callback: () => void, delay: number) => { delays.push(delay); callback(); },
  { warn: (message: string) => warnings.push(message) });
  return { readers: exports, reads, delays, warnings, initializations: () => initializations };
}

test('public reader entry initializes lazily and leaves unconfigured content unavailable', async () => {
  const f = loadReaders(false);
  assert.equal(f.initializations(), 0);
  assert.equal(f.readers.isContentDatabaseConfigured(), false);
  assert.deepEqual(await f.readers.listWalks(), { status: 'unavailable', reason: 'not-configured' });
  assert.equal(f.initializations(), 0);
  assert.deepEqual(f.reads, []);
});

test('the server entry exposes the existing published readers without dormant ingestion operations', async () => {
  const f = loadReaders(true);
  assert.equal(f.initializations(), 0);
  assert.equal('persistRightsClearedMusicArtistHeadshot' in f.readers, false);
  const r = f.readers;
  await Promise.all([
    r.listWalks(), r.getWalk('test-walk'), r.listStories(), r.getStory('test-story'),
    r.listPlaces(), r.listExploreCatalogue(), r.listExplorePoints(),
    r.getPlace('test-place'), r.getPlaceByLegacySlug('test-place'),
    r.listMusicArtists(), r.getMusicArtist('test-artist'), r.listMusicArtistsPage(1),
    r.listEventsForDate('2026-10-12'), r.listEventsForDateRange('2026-10-12', '2026-10-18', 1),
  ]);
  assert.equal(f.reads.length, 14);
  for (const query of f.reads) {
    assert.equal(query.overrideAccess, false, String(query.collection));
    assert.equal(query.draft, false, String(query.collection));
    assert.ok(query.where, 'The published content contract must retain its filters');
  }
  const paged = f.reads.filter((query) => query.page === 1);
  assert.equal(paged.length, 3);
  for (const query of paged) assert.equal(query.pagination, undefined);
  for (const query of f.reads.filter((query) => query.page === undefined)) assert.equal(query.pagination, false);
});


test('the adapter preserves collection filters, projection, depth and ordering', async () => {
  const f = loadReaders(true);
  await f.readers.listExplorePoints();
  assert.deepEqual(f.reads[0], {
    collection: 'places', where: {}, depth: 0, limit: content.PLACES_LIMIT, sort: 'name',
    select: { slug: true, name: true, kind: true, lifecycle: true, location: true, locationAccuracy: true, featured: true },
    pagination: false, draft: false, overrideAccess: false,
  });
  await f.readers.getWalk('test-walk');
  assert.deepEqual(f.reads[1], {
    collection: 'walks', where: { and: [{ _status: { equals: 'published' } }, { slug: { equals: 'test-walk' } }] },
    depth: 1, limit: 1, sort: undefined, pagination: false, draft: false, overrideAccess: false,
  });
});

test('paged readers preserve requested page and Payload count metadata', async () => {
  const f = loadReaders(true, () => ({ docs: [], hasNextPage: true, totalDocs: 55 }));
  assert.deepEqual(await f.readers.listMusicArtistsPage(2), {
    status: 'ok', data: { artists: [], hasNextPage: true, totalDocs: 55 },
  });
  assert.deepEqual(f.reads[0], {
    collection: 'music-artists', where: { _status: { equals: 'published' } }, depth: 1,
    limit: content.MUSIC_PAGE_SIZE, page: 2, sort: 'name,id', draft: false, overrideAccess: false,
  });
  assert.deepEqual(await f.readers.listEventsForDateRange('2026-10-12', '2026-10-18', 3), {
    status: 'ok', data: { events: [], hasNextPage: true, totalDocs: 55 },
  });
  assert.equal(f.reads[1]?.page, 3);
  assert.equal(f.reads[1]?.limit, content.EVENTS_PAGE_SIZE);
  assert.deepEqual(f.reads[1]?.where, { and: [
    { _status: { equals: 'published' } },
    { startsAt: { less_than: '2026-10-19T04:00:00.000Z' } },
    { endsAt: { greater_than: '2026-10-12T04:00:00.000Z' } },
  ] });
});

test('transient list failures retry twice with the original anonymous query', async () => {
  const f = loadReaders(true, (_query, attempt) => {
    if (attempt < 3) throw new Error('query transport failed', { cause: new Error('ECONNRESET') });
    return { docs: [], hasNextPage: false, totalDocs: 0 };
  });
  assert.deepEqual(await f.readers.listWalks(), { status: 'ok', data: [] });
  assert.equal(f.initializations(), 3);
  assert.deepEqual(f.delays, [400, 1200]);
  assert.equal(f.warnings.length, 2);
  assert.deepEqual(f.reads, [f.reads[0], f.reads[0], f.reads[0]]);
});

test('exhausted paged transport failures remain unavailable rather than empty', async () => {
  const error = new Error('ETIMEDOUT');
  const f = loadReaders(true, () => { throw error; });
  assert.deepEqual(await f.readers.listMusicArtistsPage(4), { status: 'unavailable', reason: 'query-failed', error });
  assert.equal(f.reads.length, 3);
  assert.deepEqual(f.delays, [400, 1200]);
  assert.equal(f.reads[2]?.page, 4);
});

test('non-transient query errors are never retried', async () => {
  const error = new Error('invalid field');
  const f = loadReaders(true, () => { throw error; });
  assert.deepEqual(await f.readers.listWalks(), { status: 'unavailable', reason: 'query-failed', error });
  assert.equal(f.reads.length, 1);
  assert.deepEqual(f.delays, []);
  assert.deepEqual(f.warnings, []);
});
