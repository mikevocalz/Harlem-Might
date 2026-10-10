import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRestContentSource, restQueryString } from './rest-source.ts';

test('restQueryString encodes nested where, select and draft the way qs reads them', () => {
  const qs = decodeURIComponent(
    restQueryString({
      collection: 'places',
      where: { and: [{ _status: { equals: 'published' } }, { slug: { equals: 'apollo-theater' } }] },
      depth: 1,
      limit: 1,
      sort: 'name',
      select: ['name', 'slug'],
    }),
  );
  assert.equal(
    qs,
    'where[and][0][_status][equals]=published&where[and][1][slug][equals]=apollo-theater&depth=1&limit=1&sort=name&select[name]=true&select[slug]=true&draft=false',
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

test('no apiUrl means not configured', () => {
  const source = createRestContentSource({ apiUrl: undefined, fetch: async () => assert.fail('no request') });
  assert.equal(source.isConfigured(), false);
});
