import assert from 'node:assert/strict';
import { it } from 'node:test';
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import { createContentReaders } from '../../content/readers.ts';
import { createRestContentSource } from '../../content/rest-source.ts';
import { fetchMusicArtistsPage, requestNextMusicPage } from './music-pagination.ts';
import { musicKeys } from './music.keys.ts';

it('infinite pages keep initial data and next-page failures, and forward each query signal', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 2, retryDelay: 0, gcTime: Infinity } } });
  const requests: number[] = [];
  let fails = true;
  let expectedSignal: AbortSignal | undefined;
  const readers = createContentReaders(createRestContentSource({
    apiUrl: 'https://example.test/payload-api',
    fetch: async (url, init) => {
      assert.equal(init.signal, expectedSignal);
      requests.push(Number(new URL(url).searchParams.get('page')));
      if (fails) throw new Error('offline');
      return { ok: true, status: 200, json: async () => ({ docs: [], hasNextPage: false, totalDocs: 1 }) };
    },
  }));
  const initial = { artists: [], hasNextPage: true, totalDocs: 1, page: 1 };
  const observer = new InfiniteQueryObserver(client, {
    queryKey: musicKeys.artists,
    initialPageParam: 1,
    initialData: { pages: [initial], pageParams: [1] },
    staleTime: 60_000,
    queryFn: ({ pageParam, signal }) => {
      expectedSignal = signal;
      return fetchMusicArtistsPage(readers.listMusicArtistsPage, pageParam, { signal });
    },
    getNextPageParam: (last) => last.hasNextPage ? last.page + 1 : undefined,
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    assert.deepEqual(requests, []);
    const failure = await observer.fetchNextPage();
    assert.equal(failure.isFetchNextPageError, true);
    assert.deepEqual(failure.data?.pages, [initial]);
    assert.deepEqual(requests, [2, 2, 2]);
    fails = false;
    const success = await observer.fetchNextPage();
    assert.equal(success.isError, false);
    assert.deepEqual(success.data?.pageParams, [1, 2]);
    assert.equal(success.data?.pages[1]?.page, 2);
    assert.equal(success.hasNextPage, false);
  } finally { unsubscribe(); client.clear(); }
});

const state = () => {
  const requests: unknown[] = [];
  const query = {
    hasNextPage: true, isFetching: false, isFetchNextPageError: false,
    fetchNextPage: async (options: { cancelRefetch: false }) => { requests.push(options); },
  };
  return { query, requests };
};

it('scroll loads an available page without cancelling any overlapping fetch', () => {
  const { query, requests } = state();
  requestNextMusicPage(query, true);
  assert.deepEqual(requests, [{ cancelRefetch: false }]);
});

it('scroll leaves a failed page for an explicit retry', () => {
  const { query, requests } = state();
  query.isFetchNextPageError = true;
  requestNextMusicPage(query, true);
  requestNextMusicPage(query, true);
  assert.deepEqual(requests, []);
  requestNextMusicPage(query);
  assert.deepEqual(requests, [{ cancelRefetch: false }]);
});

for (const automatic of [false, true]) {
  it(`${automatic ? 'scroll' : 'press'} does not interrupt a reconnect or next-page fetch`, () => {
    const { query, requests } = state();
    query.isFetching = true;
    requestNextMusicPage(query, automatic);
    assert.deepEqual(requests, []);
  });
  it(`${automatic ? 'scroll' : 'press'} stops at the final page`, () => {
    const { query, requests } = state();
    query.hasNextPage = false;
    requestNextMusicPage(query, automatic);
    assert.deepEqual(requests, []);
  });
}
