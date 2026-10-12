import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire, registerHooks } from 'node:module';
import { it } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import type { WorkStore } from 'next/dist/server/app-render/work-async-storage.external';
import type { PublicUseCacheStore, RequestStore } from 'next/dist/server/app-render/work-unit-async-storage.external';
import { eventRangeCacheTag } from './event-cache-key.ts';

// Real installed Next tag APIs, revalidation executor and default cache handler.
// Node does not compile `use cache`: the small lookup below supplies that outer
// cache boundary; the real cached reader collects its own tags/lifetime. This
// tests recovery/source reads and invalidation scope without a live database.
Object.assign(globalThis, { AsyncLocalStorage });
process.env.__NEXT_USE_CACHE = 'true';
const require = createRequire(import.meta.url);
const { workAsyncStorage } = require('next/dist/server/app-render/work-async-storage.external') as typeof import('next/dist/server/app-render/work-async-storage.external');
const { workUnitAsyncStorage } = require('next/dist/server/app-render/work-unit-async-storage.external') as typeof import('next/dist/server/app-render/work-unit-async-storage.external');
const { initializeCacheHandlers, getCacheHandler, setCacheHandler } = require('next/dist/server/use-cache/handlers') as typeof import('next/dist/server/use-cache/handlers');
const { executeRevalidates } = require('next/dist/server/revalidation-utils') as typeof import('next/dist/server/revalidation-utils');
const { createDefaultCacheHandler } = require('next/dist/server/lib/cache-handlers/default') as typeof import('next/dist/server/lib/cache-handlers/default');
const nextCacheUrl = pathToFileURL(require.resolve('next/cache')).href;
type EventResult = Awaited<ReturnType<typeof import('./cached-content.ts').cachedEventsForDateRange>>;
const source = { reads: [] as unknown[][], available: false, actionRead: async (..._args: [string, string, number]): Promise<EventResult> => { throw new Error('Missing cache boundary'); } };
Object.assign(globalThis, { __eventRetrySource: source });
const exports = ['getMusicArtist', 'getPlace', 'getStory', 'getWalk', 'getPlaceByLegacySlug', 'listEventsForDate', 'listExploreCatalogue', 'listMusicArtistsPage', 'listStories', 'listWalks'];
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/cached-content.ts')) {
      if (specifier === 'server-only') return { url: 'data:text/javascript,export {}', shortCircuit: true };
      if (specifier === '@acme/payload/server') return { url: 'event-retry-source:fixture', shortCircuit: true };
    }
    if (context.parentURL?.endsWith('/today-retry-action.ts') && specifier === './cached-content.ts') {
      return { url: 'event-retry-source:cached', shortCircuit: true };
    }
    if (specifier === 'next/cache') return { url: nextCacheUrl, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'event-retry-source:cached') return { format: 'module', shortCircuit: true, source: 'export const cachedEventsForDateRange = (...args) => globalThis.__eventRetrySource.actionRead(...args);' };
    if (url === 'event-retry-source:fixture') return { format: 'module', shortCircuit: true, source: `
      ${exports.map((name) => `export const ${name} = () => { throw new Error('Unexpected reader'); };`).join('\n')}
      export async function listEventsForDateRange(...args) {
        const h = globalThis.__eventRetrySource; h.reads.push(args);
        return h.available ? { status: 'ok', data: { events: [], totalDocs: 0, hasNextPage: false } } : { status: 'unavailable', reason: 'query-failed' };
      }` };
    return next(url, context);
  },
});
const { cachedEventsForDateRange } = await import('./cached-content.ts');
const { retryTodayEvents } = await import('./today-retry-action.ts');

function fixture() {
  source.reads = [];
  source.available = false;
  initializeCacheHandlers(1_000_000);
  const handler = createDefaultCacheHandler(1_000_000);
  setCacheHandler('default', handler);
  setCacheHandler('remote', handler);
  assert.equal(getCacheHandler('default'), handler);
  const requestStore = () => ({
    page: '/today/page', route: '/today', incrementalCache: { revalidateTag: async () => {} },
    // Stay inside cache lifetimes: only tag expiry can cause a new source read.
    cacheLifeProfiles: { seconds: { stale: 30, revalidate: 300, expire: 600 }, minutes: { stale: 300, revalidate: 300, expire: 600 } },
  } as unknown as WorkStore);
  const read = async (start: string, end: string, page: number) => {
    const key = eventRangeCacheTag(start, end, page);
    const hit = await handler.get(key, []);
    if (hit) return JSON.parse(await new Response(hit.value).text()) as EventResult;
    const context = { type: 'cache', phase: 'render', tags: null } as PublicUseCacheStore;
    const result = await workAsyncStorage.run(requestStore(), () => workUnitAsyncStorage.run(context, () => cachedEventsForDateRange(start, end, page)));
    const tags = context.tags ?? [];
    assert.deepEqual(tags, result.status === 'unavailable' ? [key] : []);
    await handler.set(key, Promise.resolve({
      value: new Response(JSON.stringify(result)).body!, tags,
      timestamp: performance.timeOrigin + performance.now(),
      stale: context.explicitStale!, revalidate: context.explicitRevalidate!, expire: context.explicitExpire!,
    }));
    return result;
  };
  source.actionRead = read;
  const action = (store: WorkStore, input: unknown) => workAsyncStorage.run(store, () =>
    workUnitAsyncStorage.run({ type: 'request', phase: 'action' } as RequestStore, () => retryTodayEvents(input)));
  const flush = async (store: WorkStore) => {
    await executeRevalidates(store);
    await setTimeout(2); // Move past the handler's rounded tag timestamp.
  };
  return { read, action, flush, requestStore };
}

it('an immediate retry expires only its unavailable range/page and reads the recovered source again', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-12T15:00:00Z') });
  const { read, action, flush, requestStore } = fixture();
  const target = ['2026-10-12', '2027-01-09', 2] as const;
  const otherPages = [['2026-10-12', '2027-01-09', 1], ['2026-10-12', '2026-10-12', 2], ['2026-10-11', '2027-01-08', 2]] as const;
  assert.equal((await read(...target)).status, 'unavailable');
  assert.equal((await read(...target)).status, 'unavailable');
  assert.equal(source.reads.length, 1, 'refresh alone reuses the failed entry');
  for (const args of otherPages) await read(args[0], args[1], args[2]);
  assert.equal(source.reads.length, 4);
  source.available = true;
  await setTimeout(2);
  const store = requestStore();
  await action(store, { view: 'upcoming', page: 2 });
  assert.deepEqual(store.pendingRevalidatedTags?.map(({ tag, profile }) => ({ tag, profile })), [{ tag: eventRangeCacheTag(...target), profile: undefined }]);
  assert.equal(source.reads.length, 4, 'the retry inspects the cached failure');
  await flush(store);
  assert.equal((await read(...target)).status, 'ok');
  assert.equal(source.reads.length, 5, 'retry makes a fresh source read');
  assert.deepEqual(source.reads.at(-1), target);
  for (const args of otherPages) assert.equal((await read(args[0], args[1], args[2])).status, 'unavailable');
  assert.equal(source.reads.length, 5, 'other dates, views and pages stay cached');
  const invalid = requestStore();
  await assert.rejects(() => action(invalid, { view: 'upcoming', page: 2, tag: 'all-events' }), /Invalid event retry/);
  assert.equal(invalid.pendingRevalidatedTags, undefined);
  assert.equal(source.reads.length, 5, 'invalid input never reads or invalidates');
});

it('retrying a successful listing is a no-op, including a healthy cache miss', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-12T15:00:00Z') });
  const { read, action, flush, requestStore } = fixture();
  source.available = true;
  for (const page of [3, 4]) {
    // Page 3 is already cached; page 4 is first read by the action.
    if (page === 3) await read('2026-10-12', '2027-01-09', page);
    for (let attempt = 0; attempt < 2; attempt++) {
      const store = requestStore();
      await action(store, { view: 'upcoming', page });
      assert.equal(store.pendingRevalidatedTags, undefined);
      await flush(store);
      assert.equal((await read('2026-10-12', '2027-01-09', page)).status, 'ok');
    }
  }
  assert.equal(source.reads.length, 2, 'one source read per healthy page, with no refresh churn');
});

it('a delayed concurrent retry cannot evict a successful entry recovered by another retry', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-12T15:00:00Z') });
  const { read, action, flush, requestStore } = fixture();
  const target = ['2026-10-12', '2027-01-09', 5] as const;
  const input = { view: 'upcoming', page: 5 };
  assert.equal((await read(...target)).status, 'unavailable');
  let release!: () => void;
  let observed!: () => void;
  const captured = new Promise<void>((resolve) => { observed = resolve; });
  const paused = new Promise<void>((resolve) => { release = resolve; });
  source.actionRead = async (...args) => {
    const oldFailure = await read(...args);
    observed();
    await paused;
    return oldFailure;
  };
  const delayedStore = requestStore();
  const delayed = action(delayedStore, input);
  await captured; // Deterministic barrier: delayed action has captured failure.
  source.actionRead = read;
  source.available = true;
  await setTimeout(2);
  const fastStore = requestStore();
  await action(fastStore, input);
  await flush(fastStore);
  assert.equal((await read(...target)).status, 'ok');
  assert.equal(source.reads.length, 2);
  await setTimeout(2);
  release();
  await delayed;
  assert.equal(delayedStore.pendingRevalidatedTags?.[0]?.tag, eventRangeCacheTag(...target));
  await flush(delayedStore);
  assert.equal((await read(...target)).status, 'ok');
  assert.equal(source.reads.length, 2, 'late failure-tag invalidation leaves the recovered success cached');
});
