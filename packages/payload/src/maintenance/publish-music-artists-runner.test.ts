import assert from 'node:assert/strict';
import { it } from 'node:test';
import { publishMusicArtists } from './publish-music-artists-runner.ts';

const artist = (id: number) => ({ id, name: `Artist ${id}`, slug: `artist-${id}`, _status: 'draft' as const });
const log = { info: () => {}, error: () => {} };

it('reads all pages in stable ID order before publishing anything', async () => {
  const calls: string[] = [];
  const result = await publishMusicArtists({
    find: async ({ page, sort }) => {
      assert.equal(sort, 'id');
      calls.push(`read ${page}`);
      return { docs: [artist(page)], hasNextPage: page === 1 };
    },
    update: async ({ id }) => { calls.push(`write ${id}`); },
  }, true, log);
  assert.deepEqual(calls, ['read 1', 'read 2', 'write 1', 'write 2']);
  assert.deepEqual(result, { published: 2, failed: 0 });
});

it('continues after one invalid update and reports both successes and failures', async () => {
  const writes: (number | string)[] = [];
  const errors: unknown[] = [];
  const result = await publishMusicArtists({
    find: async () => ({ docs: [artist(1), artist(2)], hasNextPage: false }),
    update: async ({ id }) => { writes.push(id); if (id === 1) throw new Error('Invalid record'); },
  }, true, { ...log, error: (message) => errors.push(message) });
  assert.deepEqual(writes, [1, 2]);
  assert.deepEqual(result, { published: 1, failed: 1 });
  assert.match(String(errors[0]), /artist 1/);
});

it('preview and ineligible records never trigger writes', async () => {
  const payload = {
    find: async () => ({ docs: [artist(1), { ...artist(2), name: ' ' }, { ...artist(3), _status: 'published' as const }], hasNextPage: false }),
    update: async () => assert.fail('Preview cannot publish'),
  };
  assert.deepEqual(await publishMusicArtists(payload, false, log), { published: 0, failed: 0 });
  payload.find = async () => ({ docs: [{ ...artist(2), name: ' ' }, { ...artist(3), _status: 'published' as const }], hasNextPage: false });
  assert.deepEqual(await publishMusicArtists(payload, true, log), { published: 0, failed: 0 });
});

it('a later page read failure happens before any updates', async () => {
  await assert.rejects(publishMusicArtists({
    find: async ({ page }) => { if (page === 2) throw new Error('Offline'); return { docs: [artist(1)], hasNextPage: true }; },
    update: async () => assert.fail('Cannot write an incomplete snapshot'),
  }, true, log), /Offline/);
});
