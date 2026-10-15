import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import React from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { WIDGET_SCHEMA_VERSION, toMobileDeepLink } from '@acme/widgets';
import type { WidgetSnapshot } from '@acme/widgets';

// The compiler is CommonJS; loading it directly also avoids import-lint walking
// its multi-megabyte generated namespace while checking this small harness.
const { JsxEmit, ModuleKind, ScriptTarget, transpileModule } = createRequire(import.meta.url)('typescript') as typeof import('typescript');

const now = Date.parse('2026-10-12T12:00:00Z');
const kinds = ['story', 'event', 'place', 'walk'] as const;
const names = ['HarlemStory', 'HarlemEvent', 'HarlemPlace', 'HarlemWalk'];
function snapshot(label: string, expiresAt = '2026-10-13T00:00:00Z'): WidgetSnapshot {
  return {
    schemaVersion: 1, generatedAt: new Date(now).toISOString(), expiresAt,
    story: { kind: 'story', title: `${label} story`, subtitle: 'Public story', eyebrow: 'STORY', path: '/stories/history' },
    event: { kind: 'event', title: `${label} event`, subtitle: 'Public event', eyebrow: 'EVENT', path: '/today' },
    place: { kind: 'place', title: `${label} place`, subtitle: 'Saved place', eyebrow: 'PLACE', path: '/explore?place=apollo' },
    walk: { kind: 'walk', title: `${label} walk`, subtitle: 'Confirmed stop', eyebrow: 'WALK', path: '/walks/history' },
  };
}
type Element = React.ReactElement<Record<string, unknown>>;
type WidgetRequest = { widgetName: string; renderWidget: () => Element };
type Task = { widgetAction: string; widgetInfo: { widgetName: string }; renderWidget: (element: Element) => void };

// Execute the real feed, task handler, publisher, and widget component. Only
// MMKV, Android widget I/O, fetch, and time are controlled; no device/network claim.
function fixture(saved?: WidgetSnapshot) {
  const state = {
    saved: saved && JSON.stringify(saved), opens: 0, reads: 0, writes: 0,
    storageFailure: '' as '' | 'open' | 'read' | 'write',
    payload: snapshot('Fresh') as unknown,
    response: 'ok' as 'ok' | 'offline' | 'http-error' | 'invalid-json' | 'abort',
    fetches: 0, endpoint: 'https://example.test/widgets',
    updates: [] as WidgetRequest[], updateFailure: '',
  };
  const timers = new Set<() => void>();
  const modules: Record<string, unknown> = {
    react: React,
    'react/jsx-runtime': { jsx, jsxs },
    '@acme/widgets': { WIDGET_SCHEMA_VERSION, toMobileDeepLink },
    'react-native-mmkv': {
      createMMKV({ id }: { id: string }) {
        assert.equal(id, 'harlem-might-public-widgets-v1');
        state.opens++;
        if (state.storageFailure === 'open') throw new Error('MMKV unavailable');
        return {
          getString(key: string) {
            assert.equal(key, 'published-snapshot');
            state.reads++;
            if (state.storageFailure === 'read') throw new Error('MMKV read failed');
            return state.saved;
          },
          set(key: string, value: string) {
            assert.equal(key, 'published-snapshot');
            state.writes++;
            if (state.storageFailure === 'write') throw new Error('MMKV write failed');
            state.saved = value;
          },
        };
      },
    },
    'react-native-android-widget': {
      FlexWidget: 'FlexWidget', TextWidget: 'TextWidget',
      async requestWidgetUpdate(request: WidgetRequest) {
        state.updates.push(request);
        if (request.widgetName === state.updateFailure) throw new Error('Widget unavailable');
      },
    },
  };
  function load(file: string) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const compiled = transpileModule(source, {
      compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022, jsx: JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const exports: Record<string, unknown> = {};
    new Function('require', 'exports', 'process', 'fetch', 'Date', 'setTimeout', 'clearTimeout', compiled)(
      (id: string) => { assert.ok(id in modules, `Unexpected widget import ${id}`); return modules[id]; },
      exports, { env: { get EXPO_PUBLIC_WIDGET_FEED_URL() { return state.endpoint; } } },
      async (url: string, options: { signal: AbortSignal; headers: Record<string, string> }) => {
        state.fetches++;
        assert.equal(url, state.endpoint);
        assert.equal(options.headers.Accept, 'application/json');
        if (state.response === 'offline') throw new Error('Offline');
        if (state.response === 'abort') {
          return await new Promise<Response>((_, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
          });
        }
        if (state.response === 'http-error') return new Response(null, { status: 503 });
        if (state.response === 'invalid-json') return new Response('{');
        return Response.json(state.payload);
      },
      { now: () => now, parse: Date.parse },
      (callback: () => void, ms: number) => { assert.equal(ms, 7000); timers.add(callback); return callback; },
      (callback: () => void) => { timers.delete(callback); },
    );
    return exports;
  }
  const feed = load('../widgets/public-feed.ts') as typeof import('../widgets/public-feed.ts');
  modules['./public-feed'] = modules['../public-feed'] = feed;
  const widget = load('../widgets/android/HarlemWidget.tsx');
  modules['./HarlemWidget'] = modules['./android/HarlemWidget'] = widget;
  const handler = load('../widgets/android/task-handler.tsx');
  modules['./android/task-handler'] = handler;
  const publisher = load('../widgets/sync.android.ts') as typeof import('../widgets/sync.android.ts');
  assert.equal(state.opens, 0, 'imports must not acquire optional storage');
  return {
    state, feed, timers, publish: publisher.publishHomeWidgets,
    async task(action: string, widgetName = 'HarlemStory') {
      const rendered: Element[] = [];
      await (handler.widgetTaskHandler as (props: Task) => Promise<void>)({
        widgetAction: action, widgetInfo: { widgetName }, renderWidget: (element) => rendered.push(element),
      });
      return rendered;
    },
  };
}
function renderedTexts(element: Element): string[] {
  const render = element.type as (props: Record<string, unknown>) => Element;
  const tree = render(element.props);
  assert.equal(tree.type, 'FlexWidget', 'execute the actual HarlemWidget renderer');
  const children = tree.props.children as Element[];
  return children.map(child => child.props.text as string);
}
function assertPublished(f: ReturnType<typeof fixture>, expected: WidgetSnapshot | null) {
  assert.deepEqual(f.state.updates.map(update => update.widgetName), names);
  f.state.updates.forEach((request, index) => {
    const element = request.renderWidget();
    const card = expected?.[kinds[index]!] ?? null;
    assert.deepEqual(element.props.card, card);
    const texts = renderedTexts(element);
    assert.equal(texts[1], card?.title ?? ['Explore Harlem', 'Explore today', 'My places', 'Start a Harlem walk'][index]);
  });
}

for (const storageFailure of ['open', 'read', 'write'] as const) {
  test(`refresh and Android headless rendering preserve fresh data after MMKV ${storageFailure} failure`, async () => {
    for (const action of ['WIDGET_ADDED', 'WIDGET_UPDATE']) {
      const cached = snapshot('Cached');
      const f = fixture(cached);
      f.state.storageFailure = storageFailure;
      const [element] = await f.task(action);
      assert.ok(element);
      assert.deepEqual(element.props.card, (f.state.payload as WidgetSnapshot).story);
      assert.equal(renderedTexts(element)[1], 'Fresh story');
      assert.equal(f.state.saved, JSON.stringify(storageFailure === 'read' ? f.state.payload : cached));
      assert.equal(f.state.fetches, 1);
      assert.equal(f.timers.size, 0);
    }
  });

  test(`Android publishing without input preserves the fresh feed after MMKV ${storageFailure} failure`, async () => {
    const f = fixture(snapshot('Cached'));
    f.state.storageFailure = storageFailure;
    await f.publish();
    assertPublished(f, f.state.payload as WidgetSnapshot);
    assert.equal(f.state.fetches, 1);
    assert.equal(f.timers.size, 0);
  });

  test(`foreground refresh then explicit publishing survives MMKV ${storageFailure} failure`, async () => {
    const f = fixture(snapshot('Cached'));
    f.state.storageFailure = storageFailure;
    const fresh = await f.feed.refreshPublicSnapshot();
    assert.deepEqual(fresh, f.state.payload);
    assert.ok(fresh);
    await f.publish(fresh);
    assertPublished(f, fresh);
    assert.equal(f.state.fetches, 1, 'the foreground-provided snapshot does not refetch');
  });
}

test('explicit publishing rejects invalid data before rendering or touching native storage', async () => {
  for (const storageFailure of ['', 'open', 'write'] as const) {
    const f = fixture(snapshot('Cached'));
    f.state.storageFailure = storageFailure;
    const invalid = { ...snapshot('Invalid'), story: { kind: 'story', title: 'Missing fields' } } as WidgetSnapshot;
    await assert.rejects(f.publish(invalid), /Invalid widget snapshot/);
    assert.equal(f.state.opens, 0);
    assert.equal(f.state.fetches, 0);
    assert.equal(f.state.updates.length, 0);
  }
});

test('malformed feeds and failed fetches preserve valid cache and honest Android fallback', async () => {
  for (const response of ['ok', 'offline', 'http-error', 'invalid-json'] as const) {
    for (const cached of [snapshot('Cached'), snapshot('Expired', new Date(now).toISOString()), undefined]) {
      const f = fixture(cached);
      f.state.response = response;
      f.state.payload = { ...snapshot('Invalid'), story: { ...snapshot('Invalid').story, subtitle: {} } };
      const [element] = await f.task('WIDGET_UPDATE');
      assert.ok(element);
      const current = cached && Date.parse(cached.expiresAt) > now ? cached : null;
      assert.deepEqual(element.props.card, current?.story ?? null);
      assert.equal(renderedTexts(element)[1], current?.story?.title ?? 'Explore Harlem');
      await f.publish();
      assertPublished(f, current);
      assert.equal(f.state.saved, cached && JSON.stringify(cached));
      assert.equal(f.state.writes, 0);
      assert.equal(f.timers.size, 0);
    }
  }
});

test('timeout abort falls back to valid cache and clears its timer', async () => {
  const cached = snapshot('Cached');
  const f = fixture(cached);
  f.state.response = 'abort';
  const task = f.task('WIDGET_UPDATE');
  assert.equal(f.timers.size, 1);
  [...f.timers][0]!();
  const [element] = await task;
  assert.ok(element);
  assert.deepEqual(element.props.card, cached.story);
  assert.equal(f.timers.size, 0);
  assert.equal(f.state.writes, 0);
});

test('expired fresh and explicit snapshots render empty cards even when persistence is unavailable', async () => {
  const f = fixture();
  f.state.payload = snapshot('Expired', new Date(now).toISOString());
  f.state.storageFailure = 'open';
  const [element] = await f.task('WIDGET_UPDATE');
  assert.ok(element);
  assert.equal(element.props.card, null);
  await f.publish();
  assertPublished(f, null);
  f.state.updates = [];
  await f.publish(f.state.payload as WidgetSnapshot);
  assertPublished(f, null);
});

test('resize and click use cache without fetching; deleted and unknown widgets do nothing', async () => {
  const cached = snapshot('Cached');
  const f = fixture(cached);
  for (const action of ['WIDGET_RESIZED', 'WIDGET_CLICK']) {
    const [element] = await f.task(action);
    assert.ok(element);
    assert.deepEqual(element.props.card, cached.story);
  }
  assert.equal(f.state.fetches, 0);
  const reads = f.state.reads;
  for (const action of ['WIDGET_ADDED', 'WIDGET_UPDATE', 'WIDGET_RESIZED', 'WIDGET_CLICK', 'WIDGET_DELETED']) {
    assert.deepEqual(await f.task(action, 'UnknownWidget'), []);
  }
  assert.deepEqual(await f.task('WIDGET_DELETED'), []);
  assert.deepEqual(await f.task('UNRECOGNIZED_ACTION'), []);
  assert.equal(f.state.reads, reads);
  assert.equal(f.state.fetches, 0);
});

test('resize and click suppress an expired cached card without fetching', async () => {
  const f = fixture(snapshot('Expired', new Date(now).toISOString()));
  for (const action of ['WIDGET_RESIZED', 'WIDGET_CLICK']) {
    const [element] = await f.task(action);
    assert.ok(element);
    assert.equal(element.props.card, null);
    assert.equal(renderedTexts(element)[1], 'Explore Harlem');
  }
  assert.equal(f.state.fetches, 0);
});

test('unconfigured/insecure feed and unreadable storage produce honest empty cards', async () => {
  for (const endpoint of ['', 'http://example.test/widgets']) {
    const f = fixture(snapshot('Cached'));
    f.state.endpoint = endpoint;
    f.state.storageFailure = 'read';
    await f.publish();
    assertPublished(f, null);
    assert.equal(f.state.fetches, 0);
    assert.equal(f.timers.size, 0);
  }
});

test('one failed widget update does not prevent the other widget publications', async () => {
  const f = fixture();
  f.state.updateFailure = 'HarlemStory';
  await f.publish(snapshot('Explicit'));
  assertPublished(f, snapshot('Explicit'));
  assert.equal(f.state.fetches, 0);
  assert.deepEqual(f.feed.loadPublicSnapshot(), snapshot('Explicit'));
});
