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
const { initializeCacheHandlers, getCacheHandler } = require('next/dist/server/use-cache/handlers') as typeof import('next/dist/server/use-cache/handlers');
const { executeRevalidates } = require('next/dist/server/revalidation-utils') as typeof import('next/dist/server/revalidation-utils');
const nextCacheUrl = pathToFileURL(require.resolve('next/cache')).href;
const source = { reads: [] as unknown[][], available: false };
Object.assign(globalThis, { __eventRetrySource: source });
const exports = ['getMusicArtist', 'getPlace', 'getStory', 'getWalk', 'getPlaceByLegacySlug', 'listEventsForDate', 'listExploreCatalogue', 'listMusicArtistsPage', 'listStories', 'listWalks'];
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/cached-content.ts')) {
      if (specifier === 'server-only') return { url: 'data:text/javascript,export {}', shortCircuit: true };
      if (specifier === '@acme/payload/server') return { url: 'event-retry-source:fixture', shortCircuit: true };
    }
    if (specifier === 'next/cache') return { url: nextCacheUrl, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
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

it('an immediate retry expires only its range/page and reads the recovered source again', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-12T15:00:00Z') });
  initializeCacheHandlers(1_000_000);
  const handler = getCacheHandler('default')!;
  const store = {
    page: '/today/page', route: '/today', incrementalCache: { revalidateTag: async () => {} },
    // Keep both cached successes/failures well inside their lifetime: only the
    // explicit tag expiry may cause a new source read in this regression.
    cacheLifeProfiles: { seconds: { stale: 30, revalidate: 300, expire: 600 }, minutes: { stale: 300, revalidate: 300, expire: 600 } },
  } as unknown as WorkStore;
  const read = async (start: string, end: string, page: number) => {
    const key = eventRangeCacheTag(start, end, page);
    const hit = await handler.get(key, []);
    if (hit) return JSON.parse(await new Response(hit.value).text()) as Awaited<ReturnType<typeof cachedEventsForDateRange>>;
    const context = { type: 'cache', phase: 'render', tags: null } as PublicUseCacheStore;
    const result = await workAsyncStorage.run(store, () => workUnitAsyncStorage.run(context, () => cachedEventsForDateRange(start, end, page)));
    assert.deepEqual(context.tags, [key]);
    await handler.set(key, Promise.resolve({
      value: new Response(JSON.stringify(result)).body!, tags: context.tags!,
      timestamp: performance.timeOrigin + performance.now(),
      stale: context.explicitStale!, revalidate: context.explicitRevalidate!, expire: context.explicitExpire!,
    }));
    return result;
  };
  const target = ['2026-10-12', '2027-01-09', 2] as const;
  const otherPages = [['2026-10-12', '2027-01-09', 1], ['2026-10-12', '2026-10-12', 2], ['2026-10-11', '2027-01-08', 2]] as const;
  assert.equal((await read(...target)).status, 'unavailable');
  assert.equal((await read(...target)).status, 'unavailable');
  assert.equal(source.reads.length, 1, 'refresh alone reuses the failed entry');
  for (const args of otherPages) await read(args[0], args[1], args[2]);
  assert.equal(source.reads.length, 4);
  source.available = true;
  await setTimeout(2); // Next rounds tag timestamps to milliseconds.
  await workAsyncStorage.run(store, () => workUnitAsyncStorage.run({ type: 'request', phase: 'action' } as RequestStore, () => retryTodayEvents({ view: 'upcoming', page: 2 })));
  assert.deepEqual(store.pendingRevalidatedTags?.map(({ tag, profile }) => ({ tag, profile })), [{ tag: eventRangeCacheTag(...target), profile: undefined }]);
  await executeRevalidates(store);
  await setTimeout(2); // Move past the handler’s rounded expiration timestamp.
  assert.equal((await read(...target)).status, 'ok');
  assert.equal(source.reads.length, 5, 'retry makes a fresh source read');
  assert.deepEqual(source.reads.at(-1), target);
  for (const args of otherPages) assert.equal((await read(args[0], args[1], args[2])).status, 'unavailable');
  assert.equal(source.reads.length, 5, 'other dates, views and pages stay cached');
  const tagsBefore = store.pendingRevalidatedTags?.length;
  await assert.rejects(() => retryTodayEvents({ view: 'upcoming', page: 2, tag: 'all-events' }), /Invalid event retry/);
  assert.equal(store.pendingRevalidatedTags?.length, tagsBefore);
});
