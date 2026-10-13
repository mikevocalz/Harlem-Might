import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import type { WidgetSnapshot } from '@acme/widgets';

const feedUrl = new URL('../widgets/public-feed.ts', import.meta.url).href;
const harnessKey = '__harlemWidgetStorageTest';
type Harness = { opens: number; unavailable: boolean; readFailure?: boolean; writeFailure?: boolean; saved?: string };
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(feedUrl) && specifier === 'react-native-mmkv') {
      return { url: 'widget-storage-test:mmkv', shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'widget-storage-test:mmkv') return {
      format: 'module', shortCircuit: true,
      source: `export function createMMKV({ id }) {
        const state = globalThis.${harnessKey};
        state.opens++;
        if (id !== 'harlem-might-public-widgets-v1') throw new Error('Unexpected store');
        if (state.unavailable) throw new Error('Storage unavailable');
        return {
          getString: () => {
            if (state.readFailure) throw new Error('Read unavailable');
            return state.saved;
          },
          set: (_, value) => {
            if (state.writeFailure) throw new Error('Write unavailable');
            state.saved = value;
          },
        };
      }`,
    };
    return next(url, context);
  },
});
async function loadFeed(name: string, harness: Harness) {
  Object.assign(globalThis, { [harnessKey]: harness });
  return await import(`${feedUrl}?${name}`) as typeof import('../widgets/public-feed.ts');
}
const snapshot: WidgetSnapshot = {
  schemaVersion: 1, generatedAt: '2026-10-12T00:00:00Z', expiresAt: '2026-10-13T00:00:00Z',
  story: null, event: null, place: null, walk: null,
};

test('importing the public widget feed does not acquire optional native storage', async () => {
  const state = { opens: 0, unavailable: true };
  await loadFeed('import', state);
  assert.equal(state.opens, 0);
});

test('failed storage construction returns an empty snapshot and can recover', async () => {
  const state: Harness = { opens: 0, unavailable: true };
  const feed = await loadFeed('read-recovery', state);
  assert.equal(feed.loadPublicSnapshot(), null);
  assert.equal(state.opens, 1);
  state.unavailable = false;
  state.saved = JSON.stringify(snapshot);
  assert.deepEqual(feed.loadPublicSnapshot(), snapshot);
  assert.equal(state.opens, 2);
  feed.storePublicSnapshot(snapshot);
  assert.equal(state.opens, 2, 'successful acquisition is reused');
});

test('invalid widget data is rejected before opening native storage', async () => {
  const state: Harness = { opens: 0, unavailable: true };
  const feed = await loadFeed('invalid', state);
  assert.throws(() => feed.storePublicSnapshot({ ...snapshot, schemaVersion: 2 } as unknown as WidgetSnapshot), /Invalid widget snapshot/);
  assert.equal(state.opens, 0);
});

test('stored cards require every text field and a string source URL when present', async () => {
  const state: Harness = { opens: 0, unavailable: false };
  const feed = await loadFeed('card-shape', state);
  for (const kind of ['story', 'event', 'place', 'walk'] as const) {
    const card = { kind, title: 'Harlem', subtitle: 'Public details', eyebrow: 'Published', path: '/today' };
    for (const field of ['title', 'subtitle', 'eyebrow', 'path']) {
      for (const value of [undefined, null, 17, {}, []]) {
        const malformed = { ...snapshot, [kind]: { ...card, [field]: value } };
        state.saved = JSON.stringify(malformed);
        assert.equal(feed.loadPublicSnapshot(), null, `${kind}.${field}`);
        assert.throws(() => feed.storePublicSnapshot(malformed), /Invalid widget snapshot/);
      }
    }
    for (const sourceUrl of [null, 17, {}, []]) {
      state.saved = JSON.stringify({ ...snapshot, [kind]: { ...card, sourceUrl } });
      assert.equal(feed.loadPublicSnapshot(), null);
    }
    const valid = { ...snapshot, [kind]: { ...card, sourceUrl: 'https://example.test/source' } };
    feed.storePublicSnapshot(valid);
    assert.deepEqual(feed.loadPublicSnapshot(), valid);
  }
});

test('widget refresh returns fresh data despite storage construction failure and retries persistence', async (t) => {
  const previous = process.env.EXPO_PUBLIC_WIDGET_FEED_URL;
  process.env.EXPO_PUBLIC_WIDGET_FEED_URL = 'https://example.test/widgets';
  t.after(() => {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_WIDGET_FEED_URL;
    else process.env.EXPO_PUBLIC_WIDGET_FEED_URL = previous;
  });
  t.mock.method(globalThis, 'fetch', async () => Response.json(snapshot));
  const state: Harness = { opens: 0, unavailable: true };
  const feed = await loadFeed('refresh', state);
  assert.deepEqual(await feed.refreshPublicSnapshot(), snapshot);
  assert.equal(state.saved, undefined, 'fresh return does not claim persistence');
  state.unavailable = false;
  assert.deepEqual(await feed.refreshPublicSnapshot(), snapshot);
  assert.deepEqual(feed.loadPublicSnapshot(), snapshot);
});

test('malformed fetched card text cannot replace a valid cached snapshot', async (t) => {
  const previous = process.env.EXPO_PUBLIC_WIDGET_FEED_URL;
  process.env.EXPO_PUBLIC_WIDGET_FEED_URL = 'https://example.test/widgets';
  t.after(() => {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_WIDGET_FEED_URL;
    else process.env.EXPO_PUBLIC_WIDGET_FEED_URL = previous;
  });
  const valid = { ...snapshot, story: { kind: 'story' as const, title: 'History', subtitle: 'Public story', eyebrow: 'Story', path: '/stories/history' } };
  let payload: unknown = { ...valid, story: { ...valid.story, subtitle: {} } };
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  const state: Harness = { opens: 0, unavailable: false, saved: JSON.stringify(snapshot) };
  const feed = await loadFeed('fetched-card', state);
  assert.deepEqual(await feed.refreshPublicSnapshot(), snapshot);
  assert.deepEqual(JSON.parse(state.saved!), snapshot);
  payload = valid;
  assert.deepEqual(await feed.refreshPublicSnapshot(), valid);
  assert.deepEqual(feed.loadPublicSnapshot(), valid);
});


test('valid explicit snapshots tolerate optional storage writes, including an acquired store failure', async () => {
  const state: Harness = { opens: 0, unavailable: true };
  const feed = await loadFeed('write-recovery', state);
  assert.doesNotThrow(() => feed.storePublicSnapshot(snapshot));
  assert.equal(state.saved, undefined);
  state.unavailable = false;
  feed.storePublicSnapshot(snapshot);
  const fresh = { ...snapshot, generatedAt: '2026-10-12T12:00:00Z' };
  state.writeFailure = true;
  assert.doesNotThrow(() => feed.storePublicSnapshot(fresh));
  assert.deepEqual(feed.loadPublicSnapshot(), snapshot, 'failed writes leave the saved value alone');
  assert.throws(() => feed.storePublicSnapshot({ ...fresh, story: {} } as WidgetSnapshot), /Invalid widget snapshot/);
  state.writeFailure = false;
  feed.storePublicSnapshot(fresh);
  assert.deepEqual(feed.loadPublicSnapshot(), fresh);
  assert.equal(state.opens, 2, 'an acquired store is reused after a transient write failure');
  state.readFailure = true;
  assert.equal(feed.loadPublicSnapshot(), null);
});
