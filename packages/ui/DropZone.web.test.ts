import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Assets, DropZoneProps } from './DropZone.types';

type Element = { type: unknown; props: Record<string, any> };
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

// Production component and instance-store helper; only hook scheduling, rendered
// leaves, FileReader and object-URL allocation are controlled. This is not DOM QA.
function fixture() {
  const readers: Reader[] = [];
  const allocated: string[] = [];
  const released: string[] = [];
  const refs: { current: any }[] = [];
  const memos: unknown[] = [];
  let refIndex = 0;
  let memoIndex = 0;
  let mounted = false;
  let cleanups: (() => void)[] = [];
  let pending: (() => void)[] = [];
  let props: DropZoneProps;
  let throwUrl = false;
  let throwRead = false;
  class Reader {
    result: string | null = null;
    error: Error | null = null;
    onload?: () => void;
    onerror?: () => void;
    onabort?: () => void;
    readyState = 0;
    aborted = false;
    readAsDataURL() { if (throwRead) throw new Error('read start failed'); this.readyState = 1; readers.push(this); }
    succeed() { this.readyState = 2; this.result = 'data:image/png;base64,AA'; this.onload?.(); }
    fail() { this.readyState = 2; this.error = new Error('read failed'); this.onerror?.(); }
    abort() { this.aborted = true; this.readyState = 2; this.onabort?.(); }
  }
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const modules: Record<string, unknown> = {
    react: {
      useRef: (initial: unknown) => refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }),
      useMemo: (init: () => unknown) => memos[memoIndex++] ?? (memos[memoIndex - 1] = init()),
      useEffect: (effect: () => (() => void) | undefined) => {
        if (!mounted) pending.push(() => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); });
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'zustand/vanilla': { createStore },
    zustand: { useStore: (store: StoreApi<unknown>, select: (value: unknown) => unknown) => select(store.getState()) },
    './tv': { tv: () => () => Object.fromEntries(['root', 'well', 'title', 'description'].map((key) => [key, () => key])) },
    './html/dom.web': { DropSurface: 'DropSurface' },
    './tw': { View: 'View' },
    './icons': { CloudUpload: 'CloudUpload' },
    './Text': { Text: 'Text' },
  };
  const urls = {
    createObjectURL: () => { if (throwUrl) throw new Error('url failed'); const uri = `blob:${allocated.length}`; allocated.push(uri); return uri; },
    revokeObjectURL: (uri: string) => released.push(uri),
  };
  function execute(name: string) {
    const output = transpileModule(readFileSync(new URL(name, import.meta.url), 'utf8'), {
      compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
    }).outputText;
    const exports: Record<string, any> = {};
    new Function('require', 'exports', 'FileReader', 'URL', output)((id: string) => {
      assert.ok(id in modules, `Unexpected dependency: ${id}`);
      return modules[id];
    }, exports, Reader, urls);
    return exports;
  }
  modules['./use-instance-store'] = execute('./use-instance-store.ts');
  const { DropZone } = execute('./DropZone.web.tsx');
  const render = (next = props): Element => {
    props = next; refIndex = memoIndex = 0; pending = [];
    const tree = DropZone(props) as Element;
    pending.forEach((run) => run()); mounted = true;
    return tree;
  };
  return {
    readers, allocated, released, render,
    failUrls() { throwUrl = true; },
    failReads() { throwRead = true; },
    unmount() { cleanups.forEach((run) => run()); cleanups = []; mounted = false; },
    drop(tree: Element, files = [new File(['x'], 'one.png', { type: 'image/png' })], text = '') {
      return Promise.resolve(tree.props.onDrop({ preventDefault() {}, dataTransfer: { files, getData: () => text } }));
    },
  };
}

function hasAlert(element: unknown): boolean {
  if (!element || typeof element !== 'object') return false;
  if (Array.isArray(element)) return element.some(hasAlert);
  const node = element as Element;
  return node.props?.role === 'alert' || hasAlert(node.props?.children);
}

test('failed base64 reading is handled, releases prepared URLs and can retry', async () => {
  const f = fixture(); const batches: Assets[] = [];
  const props = { includeBase64: true, onDrop: (value: Assets) => batches.push(value) };
  let tree = f.render(props);
  const pending = f.drop(tree, [new File(['a'], 'a.png'), new File(['b'], 'b.png')]);
  f.readers[0]!.succeed(); f.readers[1]!.fail();
  await assert.doesNotReject(pending);
  assert.equal(batches.length, 0);
  assert.deepEqual([...f.released].sort(), [...f.allocated].sort());
  assert.ok(hasAlert(f.render()));
  tree = f.render(); const retry = f.drop(tree); f.readers.at(-1)!.succeed(); await retry;
  assert.equal(batches.length, 1); assert.equal(batches[0]!.assets[0]!.base64, 'data:image/png;base64,AA');
  assert.equal(hasAlert(f.render()), false);
  assert.ok(!f.released.includes(batches[0]!.assets[0]!.uri!));
});

test('unmount aborts pending reads and prevents stale delivery after effect replay', async () => {
  const f = fixture(); const batches: Assets[] = [];
  const tree = f.render({ includeBase64: true, onDrop: (value) => batches.push(value) });
  const pending = f.drop(tree); f.unmount();
  assert.equal(f.readers[0]!.aborted, true);
  f.render(); f.readers[0]!.succeed(); await pending;
  assert.equal(batches.length, 0); assert.deepEqual(f.released, f.allocated);
});

test('a drop without a consumer allocates no resources', async () => {
  const f = fixture(); await f.drop(f.render({}));
  assert.deepEqual(f.allocated, []); assert.deepEqual(f.readers, []);
});

test('successful assets transfer ownership and release is idempotent', async () => {
  const f = fixture(); const batches: Assets[] = [];
  await f.drop(f.render({ onDrop: (value) => batches.push(value) }));
  assert.equal(batches[0]!.assets[0]!.fileName, 'one.png');
  assert.deepEqual(f.released, []); f.unmount(); assert.deepEqual(f.released, []);
  batches[0]!.assets[0]!.release!(); batches[0]!.assets[0]!.release!();
  assert.deepEqual(f.released, f.allocated);
});

test('object URL failure is handled without delivering a partial batch', async () => {
  const f = fixture(); const batches: Assets[] = []; const tree = f.render({ onDrop: (value) => batches.push(value) });
  f.failUrls(); await assert.doesNotReject(f.drop(tree));
  assert.equal(batches.length, 0); assert.ok(hasAlert(f.render()));
});

test('synchronous reader failure and browser cancellation settle the whole batch', async () => {
  for (const synchronous of [true, false]) {
    const f = fixture(); const batches: Assets[] = [];
    const tree = f.render({ includeBase64: true, onDrop: (value) => batches.push(value) });
    if (synchronous) f.failReads();
    const pending = f.drop(tree);
    if (!synchronous) f.readers[0]!.abort();
    await assert.doesNotReject(pending);
    assert.equal(batches.length, 0); assert.deepEqual(f.allocated, []);
    assert.ok(hasAlert(f.render()));
    f.unmount();
  }
});

test('unmount releases already prepared assets before their batch transfers', async () => {
  const f = fixture(); const batches: Assets[] = [];
  const pending = f.drop(f.render({ onDrop: (value) => batches.push(value) }));
  assert.equal(f.allocated.length, 1); f.unmount(); await pending;
  assert.equal(batches.length, 0); assert.deepEqual(f.released, f.allocated);
});

test('drop text is snapshotted before the browser closes data-transfer access', async () => {
  const f = fixture(); const batches: Assets[] = [];
  const tree = f.render({ onDrop: (value) => batches.push(value) });
  let available = true;
  const pending = tree.props.onDrop({ preventDefault() {}, dataTransfer: { files: [], getData: () => available ? 'Harlem' : '' } });
  available = false; await pending;
  assert.deepEqual(batches, [{ assets: [{ type: 'text', text: 'Harlem' }] }]);
});

test('accepted independent drops both complete and text fallback remains supported', async () => {
  const f = fixture(); const batches: Assets[] = [];
  const tree = f.render({ includeBase64: true, onDrop: (value) => batches.push(value) });
  const first = f.drop(tree); const second = f.drop(tree);
  f.readers[1]!.succeed(); await second; f.readers[0]!.succeed(); await first;
  assert.equal(batches.length, 2);
  await f.drop(tree, [], 'Harlem'); assert.deepEqual(batches[2], { assets: [{ type: 'text', text: 'Harlem' }] });
});

test('MIME filtering and disabled object URLs retain the existing payload', async () => {
  const f = fixture(); const batches: Assets[] = [];
  const tree = f.render({ disableObjectUrl: true, allowedMimeTypes: [/image\/.*/g], onDrop: (value) => batches.push(value) });
  await f.drop(tree, [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' }), new File(['x'], 'x.txt', { type: 'text/plain' })]);
  assert.deepEqual(batches[0]!.assets.map((asset) => asset.fileName), ['a.png', 'b.jpg']);
  assert.deepEqual(f.allocated, []); assert.deepEqual(f.readers, []);
  assert.ok(batches[0]!.assets.every((asset) => asset.uri === undefined && asset.release === undefined));
  await tick();
});
