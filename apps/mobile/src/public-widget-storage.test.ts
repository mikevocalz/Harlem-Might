import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import type { WidgetSnapshot } from '@acme/widgets';

const feedUrl = new URL('../widgets/public-feed.ts', import.meta.url).href;
const harnessKey = '__harlemWidgetStorageTest';
type Harness = { opens: number; unavailable: boolean; saved?: string };
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
        return { getString: () => state.saved, set: (_, value) => { state.saved = value; } };
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

test('widget refresh contains storage construction failures and retries on the next refresh', async (t) => {
  const previous = process.env.EXPO_PUBLIC_WIDGET_FEED_URL;
  process.env.EXPO_PUBLIC_WIDGET_FEED_URL = 'https://example.test/widgets';
  t.after(() => {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_WIDGET_FEED_URL;
    else process.env.EXPO_PUBLIC_WIDGET_FEED_URL = previous;
  });
  t.mock.method(globalThis, 'fetch', async () => Response.json(snapshot));
  const state: Harness = { opens: 0, unavailable: true };
  const feed = await loadFeed('refresh', state);
  assert.equal(await feed.refreshPublicSnapshot(), null);
  state.unavailable = false;
  assert.deepEqual(await feed.refreshPublicSnapshot(), snapshot);
  assert.deepEqual(feed.loadPublicSnapshot(), snapshot);
});
