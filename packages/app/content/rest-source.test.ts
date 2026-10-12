import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRestContentSource, restQueryString } from './rest-source.ts';
import { createContentReaders } from './readers.ts';

test('restQueryString encodes nested where, select and draft the way qs reads them', () => {
  const qs = decodeURIComponent(
    restQueryString({
      collection: 'places',
      where: { and: [{ _status: { equals: 'published' } }, { slug: { equals: 'apollo-theater' } }] },
      depth: 1,
      limit: 1,
      sort: 'name',
      select: ['name', 'slug'],
      page: 2,
    }),
  );
  assert.equal(
    qs,
    'where[and][0][_status][equals]=published&where[and][1][slug][equals]=apollo-theater&depth=1&limit=1&page=2&sort=name&select[name]=true&select[slug]=true&draft=false',
  );
});

test('find rejects on a non-2xx answer and returns docs on success', async () => {
  const urls: string[] = [];
  let status = 500;
  const source = createRestContentSource({
    apiUrl: 'https://example.test/payload-api/',
    fetch: async (url) => {
      urls.push(url);
      return { ok: status < 300, status, json: async () => ({ docs: [{ id: 1 }] }) };
    },
  });
  const query = { collection: 'walks', where: {}, depth: 0, limit: 5 } as const;
  await assert.rejects(source.find(query), /answered 500/);
  status = 200;
  assert.deepEqual(await source.find(query), [{ id: 1 }]);
  assert.ok(urls[0]?.startsWith('https://example.test/payload-api/walks?'));
});

test('findPage sends the page and reads Payload pagination metadata', async () => {
  const urls: string[] = [];
  const source = createRestContentSource({
    apiUrl: 'https://example.test/payload-api',
    fetch: async (url) => {
      urls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ docs: [{ id: 9 }], hasNextPage: false, totalDocs: 31 }),
      };
    },
  });
  const page = await source.findPage({ collection: 'music-artists', where: {}, depth: 1, limit: 24, page: 2 });
  assert.deepEqual(page, { docs: [{ id: 9 }], hasNextPage: false, totalDocs: 31 });
  assert.match(decodeURIComponent(urls[0] ?? ''), /music-artists\?.*limit=24.*page=2/);
});

test('no apiUrl means not configured', () => {
  const source = createRestContentSource({ apiUrl: undefined, fetch: async () => assert.fail('no request') });
  assert.equal(source.isConfigured(), false);
});


test('serializes the stable music pagination tie-breaker for the REST path', () => {
  const query = restQueryString({ collection: 'music-artists', where: {}, depth: 1, page: 2, limit: 24, sort: 'name,id' });
  assert.equal(new URLSearchParams(query).get('sort'), 'name,id');
});

test('event range REST reads send the published overlap filter, stable sort and page anonymously', async () => {
  const requests: { url: string; headers: Record<string, string> }[] = [];
  const source = createRestContentSource({
    apiUrl: 'https://example.test/payload-api/',
    fetch: async (url, init) => {
      requests.push({ url, headers: init.headers });
      return {
        ok: true,
        status: 200,
        json: async () => ({ docs: [], hasNextPage: true, totalDocs: 72 }),
      };
    },
  });
  const result = await createContentReaders(source).listEventsForDateRange('2026-10-31', '2026-11-02', 2);
  assert.deepEqual(result, { status: 'ok', data: { events: [], hasNextPage: true, totalDocs: 72 } });
  assert.equal(requests.length, 1);
  const request = requests[0]!;
  assert.deepEqual(request.headers, { accept: 'application/json' });
  const url = new URL(request.url);
  assert.equal(url.pathname, '/payload-api/events');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    'where[and][0][_status][equals]': 'published',
    'where[and][1][startsAt][less_than]': '2026-11-03T05:00:00.000Z',
    'where[and][2][endsAt][greater_than]': '2026-10-31T04:00:00.000Z',
    depth: '1',
    limit: '24',
    page: '2',
    sort: 'startsAt,id',
    draft: 'false',
  });
});

test('event range REST failures remain unavailable rather than an empty event list', async () => {
  for (const response of [
    { ok: false, status: 503, json: async () => ({ docs: [] }) },
    { ok: true, status: 200, json: async () => ({ error: 'Missing documents' }) },
  ]) {
    const source = createRestContentSource({ apiUrl: 'https://example.test/payload-api', fetch: async () => response });
    const result = await createContentReaders(source).listEventsForDateRange('2026-10-12', '2026-10-12');
    assert.equal(result.status, 'unavailable');
    if (result.status === 'unavailable') assert.equal(result.reason, 'query-failed');
    assert.ok(!('data' in result));
  }
});
