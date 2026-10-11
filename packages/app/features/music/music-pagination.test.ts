import assert from 'node:assert/strict';
import { it } from 'node:test';
import { requestNextMusicPage } from './music-pagination.ts';

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
