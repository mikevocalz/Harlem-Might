import assert from 'node:assert/strict';
import { Socket } from 'node:net';
import { after, mock, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { BasePayload, buildConfig, type FindOptions, type SelectType } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { createContentReaders, type PlaceDoc } from '@acme/app/content';
import { createPayloadContentSource } from './content-source.ts';
import { Places } from './collections/Places.ts';

// The real Local API, query sanitizer and afterRead projection run over the
// real Places collection. Only database I/O is in-memory. Never init Payload,
// open a database connection, or access the network in these regressions.
const forbidden = () => { throw new Error('Database/network access is forbidden in this offline regression'); };
mock.method(globalThis, 'fetch', forbidden);
mock.method(Socket.prototype, 'connect', forbidden);
after(() => mock.restoreAll());
const config = await buildConfig({
  secret: 'offline-content-select-test-only',
  admin: { user: 'users' },
  db: postgresAdapter({ pool: {}, push: false }),
  collections: [{ slug: 'users', auth: true, fields: [] }, Places, { slug: 'media', fields: [] }],
});
const full: PlaceDoc = {
  id: 11, slug: 'test-place', name: 'Test Place', kind: 'culture', lifecycle: 'open',
  locationAccuracy: 'verified', location: [-73.95, 40.81], featured: true,
  summary: 'A test place.', primaryArea: 'Central Harlem', primaryCategory: 'art',
  address: { formatted: 'A test address' },
  locationSource: { url: 'https://source.test/place', verifiedAt: '2026-10-01T00:00:00.000Z' },
  website: 'https://venue.test/', phone: 'Test telephone',
  openingHours: { note: 'Check with venue.' }, images: [],
};

// Postgres returns points as GeoJSON before Payload's afterRead normalization.
const adapterRow = (row: PlaceDoc) => structuredClone({
  ...row, location: row.location ? { type: 'Point', coordinates: row.location } : row.location,
});

type AdapterInput = { collection: string; limit?: number; page?: number; pagination?: boolean; select?: SelectType };
function fixture(rows: PlaceDoc[] = [full]) {
  const requests: FindOptions<'places', SelectType>[] = [];
  const adapterCalls: AdapterInput[] = [];
  const db = new Proxy({
    name: 'offline-content-select-fixture', defaultIDType: 'number',
    find: async (input: AdapterInput) => {
      assert.equal(input.collection, 'places');
      adapterCalls.push(input);
      const start = input.pagination === false ? 0 : ((input.page ?? 1) - 1) * (input.limit ?? 10);
      const docs = rows.slice(start, start + (input.limit ?? 10)).map(adapterRow);
      // Return complete rows deliberately: pinned Payload afterRead must remove
      // unselected fields itself, so a fake projection cannot hide a regression.
      return {
        docs, totalDocs: rows.length, totalPages: 2, page: input.page ?? 1, pagingCounter: 1,
        hasNextPage: start + docs.length < rows.length, hasPrevPage: start > 0,
        nextPage: null, prevPage: null, limit: input.limit ?? 10,
      };
    },
    findOne: async () => rows[0] ? adapterRow(rows[0]) : null,
  }, {
    get(target, key) {
      if (!(key in target)) throw new Error(`Unexpected database access: ${String(key)}`);
      return Reflect.get(target, key);
    },
  });
  const payload = new BasePayload();
  Object.assign(payload, {
    config, db,
    collections: Object.fromEntries(config.collections.map(collection => [collection.slug, { config: collection }])),
  });
  const find = payload.find;
  mock.method(payload, 'find', async (options: FindOptions<'places', SelectType>) => {
    requests.push(options);
    return find(options);
  });
  const source = createPayloadContentSource({ isConfigured: () => true, getPayload: async () => payload });
  return { payload, source, readers: createContentReaders(source), requests, adapterCalls };
}

const query = { collection: 'places', where: {}, depth: 0, limit: 1, sort: 'name' } as const;

test('production find/findPage preserve selected output, implicit ids and query options through the pinned Local API', async () => {
  const second = { ...full, id: 12, slug: 'test-place-two', name: 'Test Place Two' };
  const context = fixture([full, second]);
  assert.deepEqual(await context.source.find({ ...query, page: 2, select: ['name'] }), [{ id: 11, name: full.name }]);
  assert.deepEqual(await context.source.findPage({ ...query, page: 2, select: ['name'] }), {
    docs: [{ id: 12, name: second.name }], hasNextPage: false, totalDocs: 2,
  });
  const [list, page] = context.requests;
  assert.deepEqual(list, { ...query, pagination: false, draft: false, overrideAccess: false, select: { name: true } });
  assert.deepEqual(page, { ...query, page: 2, draft: false, overrideAccess: false, select: { name: true } });
  assert.deepEqual(context.adapterCalls.map(call => call.select), [{ name: true }, { name: true }]);
});

test('pinned Local API findByID also keeps id and omits unselected required fields', async () => {
  const { payload } = fixture();
  const selected = await payload.findByID({ collection: 'places', id: full.id, depth: 0, select: { name: true }, overrideAccess: false });
  assert.deepEqual(selected, { id: full.id, name: full.name });
});

test('empty local include-list stays id-only while no selection returns detail fields', async () => {
  const { source } = fixture();
  assert.deepEqual(await source.find({ ...query, select: [] }), [{ id: full.id }]);
  const [complete] = await source.find(query);
  assert.equal(complete?.slug, full.slug);
  assert.equal(complete?.phone, full.phone);
  assert.deepEqual(complete?.openingHours, full.openingHours);
});

test('both projected Explore readers map real stripped rows without fetching detail columns', async () => {
  const { readers, requests } = fixture();
  const catalogue = await readers.listExploreCatalogue();
  const points = await readers.listExplorePoints();
  assert.equal(catalogue.status, 'ok');
  assert.equal(points.status, 'ok');
  if (catalogue.status !== 'ok' || points.status !== 'ok') assert.fail('projected readers must succeed');
  const [place] = catalogue.data;
  const [point] = points.data;
  assert.equal(place?.summary, full.summary);
  assert.equal(place?.address, full.address?.formatted);
  assert.equal(place?.phone, undefined);
  assert.equal(place?.website, undefined);
  assert.deepEqual(place?.images, []);
  assert.equal(point?.slug, full.slug);
  assert.equal(point?.name, full.name);
  assert.equal(point?.kind, full.kind);
  assert.equal(point?.lifecycle, full.lifecycle);
  assert.equal(point?.locationAccuracy, full.locationAccuracy);
  assert.deepEqual(point?.location, full.location);
  assert.equal(point?.featured, true);
  assert.equal(point?.summary, undefined);
  assert.equal(point?.address, undefined);
  assert.equal(point?.phone, undefined);
  assert.equal(requests[0]?.select?.summary, true);
  assert.equal(requests[1]?.select?.summary, undefined);
  for (const request of requests) {
    assert.equal(request.depth, 0);
    assert.equal(request.select?.images, undefined);
    assert.equal(request.select?.phone, undefined);
    assert.equal(request.overrideAccess, false);
  }
});

test('production source still defers unconfigured reads and surfaces query errors', async () => {
  const unconfigured = createContentReaders(createPayloadContentSource({ isConfigured: () => false, getPayload: forbidden }));
  assert.deepEqual(await unconfigured.listExplorePoints(), { status: 'unavailable', reason: 'not-configured' });
  const error = new Error('Invalid content query');
  const failed = createContentReaders(createPayloadContentSource({ isConfigured: () => true, getPayload: async () => { throw error; } }));
  assert.deepEqual(await failed.listExploreCatalogue(), { status: 'unavailable', reason: 'query-failed', error });
});

test('a transient Local API failure retries the same projection without widening the result', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const { payload, requests } = fixture();
  let attempts = 0;
  const source = createPayloadContentSource({
    isConfigured: () => true,
    getPayload: async () => {
      if (++attempts === 1) throw new Error('ECONNRESET');
      return payload;
    },
  });
  assert.deepEqual(await source.find({ ...query, select: ['name'] }), [{ id: full.id, name: full.name }]);
  assert.equal(attempts, 2);
  assert.deepEqual(requests[0]?.select, { name: true });
});

test('compiler checks the concrete adapters against generated documents and pinned SDK selection types', () => {
  const compiler = spawnSync(process.execPath, [
    createRequire(import.meta.url).resolve('typescript/bin/tsc'),
    '--noEmit', '--project', fileURLToPath(new URL('./__typechecks__/tsconfig.json', import.meta.url)),
  ], { encoding: 'utf8' });
  assert.ifError(compiler.error);
  assert.equal(compiler.status, 0, compiler.stdout + compiler.stderr);
});
