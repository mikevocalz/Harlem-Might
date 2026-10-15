import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { createContentReaders } from './readers.ts';
import { createRestContentSource, type ContentFetch } from './rest-source.ts';
import { contentQuery, contentQueryResult, ContentQueryError, notConfigured, ok, queryFailed } from './result.ts';

const readersFor = (fetch: ContentFetch) => createContentReaders(createRestContentSource({
  apiUrl: 'https://example.test/payload-api', fetch,
}));
const emptyResponse = () => ({ ok: true, status: 200, json: async () => ({ docs: [] }) });
const clientFor = () => new QueryClient({ defaultOptions: { queries: { retry: 2, retryDelay: 0, gcTime: Infinity } } });

// Isolated cache identities for the generic query-contract test harness.
const queryFixtureKeys = {
  walks: ['walks'] as const,
  stories: ['stories'] as const,
  result: (kind: string) => [kind] as const,
  refresh: (status: string, count: number) => ['refresh', status, count] as const,
};

test('unavailable rejects at the query boundary and exhausts the configured retries', async () => {
  const client = clientFor();
  let calls = 0;
  const readers = readersFor(async () => { calls++; throw new Error('offline'); });
  try {
    await assert.rejects(client.fetchQuery({
      queryKey: queryFixtureKeys.walks, queryFn: ({ signal }) => contentQuery(readers.listWalks({ signal })),
    }), ContentQueryError);
    assert.equal(calls, 3);
    const state = client.getQueryState(queryFixtureKeys.walks);
    assert.equal(state?.status, 'error');
    assert.equal(state?.fetchFailureCount, 3);
    assert.equal(state?.data, undefined);
    assert.deepEqual(contentQueryResult({ data: undefined, error: state?.error ?? null }), queryFailed(new Error('offline')));
    assert.equal((await readers.listWalks()).status, 'unavailable');
  } finally { client.clear(); }
});

test('not-configured rejects but round-trips its reason for existing screens', async () => {
  const unavailable = notConfigured();
  await assert.rejects(contentQuery(Promise.resolve(unavailable)), (error: Error) => {
    assert.ok(error instanceof ContentQueryError);
    assert.equal(contentQueryResult({ data: undefined, error }), unavailable);
    return true;
  });
});

test('successful records, empty lists and not-found remain domain results', async () => {
  const client = clientFor();
  const readers = readersFor(async () => emptyResponse());
  try {
    for (const [key, result] of [
      ['success', ok(['walk'])], ['empty', await readers.listWalks()], ['missing', await readers.getWalk('absent')],
    ] as const) {
      assert.equal(await client.fetchQuery({ queryKey: queryFixtureKeys.result(key), queryFn: () => contentQuery(Promise.resolve(result)) }), result);
      assert.equal(client.getQueryState(queryFixtureKeys.result(key))?.status, 'success');
    }
    assert.equal(contentQueryResult({ data: undefined, error: null }), undefined);
  } finally { client.clear(); }
});

test('a failed refresh preserves last good data, including a successful empty list', async () => {
  const client = clientFor();
  try {
    for (const data of [ok(['walk']), ok([]), { status: 'not-found' } as const]) {
      const queryKey = queryFixtureKeys.refresh(data.status, data.status === 'ok' ? data.data.length : 0);
      client.setQueryData(queryKey, data);
      await assert.rejects(client.fetchQuery({ queryKey, queryFn: () => contentQuery(Promise.resolve(queryFailed(new Error('offline')))) }));
      const state = client.getQueryState<typeof data>(queryKey);
      assert.equal(state?.status, 'error');
      assert.equal(contentQueryResult({ data: state?.data, error: state?.error ?? null }), data);
    }
    assert.deepEqual(contentQueryResult({ data: undefined, error: new Error('unexpected') }), queryFailed(new Error('unexpected')));
  } finally { client.clear(); }
});

test('every reader forwards the same request-local signal to the injected REST transport', async () => {
  const signal = new AbortController().signal;
  const signals: (AbortSignal | undefined)[] = [];
  const readers = readersFor(async (_url, init) => { signals.push(init.signal); return emptyResponse(); });
  const options = { signal };
  await Promise.all([
    readers.listWalks(options), readers.getWalk('walk', options), readers.listStories(options), readers.getStory('story', options),
    readers.listEventsForDate('2026-10-10', options), readers.listPlaces(options), readers.listExploreCatalogue(options),
    readers.listExplorePoints(options), readers.getPlace('place', options), readers.getPlaceByLegacySlug('osm-123', options),
    readers.listMusicArtists(options), readers.listMusicArtistsPage(2, options), readers.getMusicArtist('artist', options),
  ]);
  assert.equal(signals.length, 13);
  assert.ok(signals.every((received) => received === signal));
});

test('concurrent queries isolate signals and cancellation cannot cache success or empty data', async () => {
  const client = clientFor();
  const signals = new Map<string, AbortSignal>();
  let markStarted: () => void = () => assert.fail('request gate not initialized');
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  const readers = readersFor(async (url, init) => {
    assert.ok(init.signal);
    const collection = new URL(url).pathname.split('/').at(-1)!;
    signals.set(collection, init.signal);
    if (signals.size === 2) markStarted();
    if (collection === 'stories') return emptyResponse();
    await new Promise<void>((resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    });
    return emptyResponse();
  });
  try {
    const walk = client.fetchQuery({ queryKey: queryFixtureKeys.walks, queryFn: ({ signal }) => contentQuery(readers.listWalks({ signal })) });
    const rejected = assert.rejects(walk);
    const story = client.fetchQuery({ queryKey: queryFixtureKeys.stories, queryFn: ({ signal }) => contentQuery(readers.listStories({ signal })) });
    await started;
    await client.cancelQueries({ queryKey: queryFixtureKeys.walks });
    await rejected;
    assert.notEqual(signals.get('walks'), signals.get('stories'));
    assert.equal(signals.get('walks')?.aborted, true);
    assert.equal(signals.get('stories')?.aborted, false);
    assert.deepEqual(await story, ok([]));
    assert.equal(client.getQueryData(queryFixtureKeys.walks), undefined);
    assert.notEqual(client.getQueryState(queryFixtureKeys.walks)?.status, 'success');
  } finally { client.clear(); }
});

test('an aborted reader remains unavailable and its query boundary rejects', async () => {
  const controller = new AbortController();
  const readers = readersFor(async (_url, init) => {
    assert.equal(init.signal, controller.signal);
    controller.abort();
    throw new DOMException('Cancelled', 'AbortError');
  });
  const result = await readers.listMusicArtistsPage(1, { signal: controller.signal });
  assert.equal(result.status, 'unavailable');
  await assert.rejects(contentQuery(Promise.resolve(result)), ContentQueryError);
});
