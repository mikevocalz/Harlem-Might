import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createContentReaders } from './readers.ts';
import { createRestContentSource } from './rest-source.ts';

test('request options preserve async date and page validation before configuration or transport', async () => {
  const signal = AbortSignal.abort();
  const readers = createContentReaders({
    isConfigured: () => assert.fail('invalid input must reject before configuration'),
    find: async () => assert.fail('invalid input must not query'),
    findPage: async () => assert.fail('invalid input must not query'),
  });
  for (const read of [
    () => readers.listEventsForDate('2026-02-30', { signal }),
    () => readers.listMusicArtistsPage(0, { signal }),
    () => readers.listMusicArtistsPage(Number.MAX_SAFE_INTEGER + 1, { signal }),
  ]) {
    let result: Promise<unknown> | undefined;
    assert.doesNotThrow(() => { result = read(); });
    assert.ok(result instanceof Promise);
    await assert.rejects(result, RangeError);
  }
});

test('REST list and page reads retain cancellation while only page reads serialize page', async () => {
  const controller = new AbortController();
  const urls: URL[] = [];
  const source = createRestContentSource({
    apiUrl: 'https://example.test/payload-api',
    fetch: async (url, init) => {
      urls.push(new URL(url));
      assert.equal(init.signal, controller.signal);
      if (init.signal?.aborted) throw init.signal.reason;
      return { ok: true, status: 200, json: async () => ({ docs: [], totalDocs: 0 }) };
    },
  });
  const query = { collection: 'places', where: {}, depth: 0, limit: 5, page: 2 } as const;
  await source.find(query, { signal: controller.signal });
  await source.findPage(query, { signal: controller.signal });
  assert.equal(urls[0]?.searchParams.has('page'), false);
  assert.equal(urls[1]?.searchParams.get('page'), '2');
  assert.equal(query.page, 2);
  controller.abort();
  await assert.rejects(source.find(query, { signal: controller.signal }), { name: 'AbortError' });
  await assert.rejects(source.findPage(query, { signal: controller.signal }), { name: 'AbortError' });
});

test('validated event ranges forward cancellation through the paginated REST path', async () => {
  const controller = new AbortController();
  let receivedUrl: URL | undefined;
  const readers = createContentReaders(createRestContentSource({
    apiUrl: 'https://example.test/payload-api',
    fetch: async (url, init) => {
      receivedUrl = new URL(url);
      assert.equal(init.signal, controller.signal);
      return { ok: true, status: 200, json: async () => ({ docs: [], hasNextPage: true, totalDocs: 25 }) };
    },
  }));
  assert.deepEqual(await readers.listEventsForDateRange('2026-10-12', '2026-10-13', 2, { signal: controller.signal }), {
    status: 'ok', data: { events: [], hasNextPage: true, totalDocs: 25 },
  });
  assert.equal(receivedUrl?.searchParams.get('page'), '2');
  assert.equal(receivedUrl?.searchParams.get('where[and][0][_status][equals]'), 'published');
});
