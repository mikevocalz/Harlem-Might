import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchArtistPhotos } from './artist-photo-client.ts';

test('photo lookups forward the exact signal and distinguish failures from missing photos', async (t) => {
  const controller = new AbortController();
  let status = 503;
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    assert.equal(init.signal, controller.signal);
    assert.deepEqual(init.headers, { accept: 'application/json' });
    return new Response(JSON.stringify({ photos: { Artist: null } }), { status });
  });
  await assert.rejects(fetchArtistPhotos(['Artist'], { signal: controller.signal }), /answered 503/);
  status = 200;
  assert.deepEqual(await fetchArtistPhotos(['Artist'], { signal: controller.signal }), { Artist: null });
});

test('aborting a photo lookup rejects rather than returning a missing photo', async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    assert.equal(init.signal, controller.signal);
    controller.abort();
    throw new DOMException('Cancelled', 'AbortError');
  });
  await assert.rejects(fetchArtistPhotos(['Artist'], { signal: controller.signal }), { name: 'AbortError' });
});
