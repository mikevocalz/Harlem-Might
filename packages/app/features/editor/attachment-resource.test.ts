import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { afterEach, beforeEach, it } from 'node:test';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';
import type { Attachment } from './attachment.ts';
import type { DropAsset } from '@acme/ui';
import { useAttachStore } from './attach.store.ts';

type Assets = { assets: DropAsset[] };

// Execute the production sheet's callbacks and real Zustand request store.
// Only presentation and React scheduling are replaced; acquisition, the picker,
// downloads and their resource callbacks run without replacement.
const harness = { useAttachStore: Object.assign(
  (select: (state: ReturnType<typeof useAttachStore.getState>) => unknown) => select(useAttachStore.getState()),
  useAttachStore,
) };
Object.assign(globalThis, { attachmentTest: harness });
const stubs: Record<string, string> = {
  react: 'export const useMemo = (create) => create();',
  zustand: `export { createStore } from 'zustand/vanilla'; export const useStore = (store, select) => select(store.getState());`,
  '@acme/ui': `export const Button = 'Button', DropZone = 'DropZone', Modal = 'Modal', MotionView = 'MotionView';`,
  '@acme/ui/tw': `export const Pressable = 'Pressable', Text = 'Text', View = 'View';`,
  '@acme/ui/icons': `export const CloudUpload = 'CloudUpload', Paperclip = 'Paperclip', X = 'X';`,
  './attach.store.ts': 'export const { useAttachStore } = globalThis.attachmentTest;',
  'react/jsx-runtime': 'export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx;',
};
const root = import.meta.url;
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/AttachSheet.tsx') && specifier in stubs) {
      return { url: `attachment-test:${specifier}`, shortCircuit: true };
    }
    if (context.parentURL === 'attachment-test:zustand') return next(specifier, { ...context, parentURL: root });
    if (specifier === './download' && context.parentURL?.endsWith('/attachment.ts')) return next('./download.web.ts', context);
    if (specifier === './pick-file' && context.parentURL?.endsWith('/AttachSheet.tsx')) return next('./pick-file.web.ts', context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('attachment-test:')) return { format: 'module', source: stubs[url.slice('attachment-test:'.length)]!, shortCircuit: true };
    if (url.endsWith('/AttachSheet.tsx')) return {
      format: 'module', shortCircuit: true,
      source: transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX },
      }).outputText,
    };
    return next(url, context);
  },
});
const { AttachSheet } = await import('./AttachSheet.tsx');
const { acquireAttachment, attach } = await import('./attachment.ts');
const { pickFile } = await import('./pick-file.web.ts');
const { downloadAttachment } = await import('./download.web.ts');

type Element = { type: string; props: Record<string, unknown> & { children?: Element | Element[] } };
function find(element: Element, type: string, label?: string): Element | undefined {
  if (element.type === type && (label === undefined || element.props['aria-label'] === label)) return element;
  const children = element.props.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child && typeof child === 'object') {
      const found = find(child, type, label);
      if (found) return found;
    }
  }
  return undefined;
}
function sheet() {
  const tree = AttachSheet() as unknown as Element;
  return {
    drop: find(tree, 'DropZone')!.props.onDrop as (event: Assets) => void,
    choose: find(tree, 'Pressable', 'Browse files')!.props.onPress as () => void,
    close: find(tree, 'Modal')!.props.onRequestClose as () => void,
  };
}
class Input extends EventTarget {
  type = '';
  files: File[] | null = null;
  click() {}
  select(name = 'picked.txt') { this.files = [new File(['chosen'], name)]; this.dispatchEvent(new Event('change')); }
  cancel() { this.dispatchEvent(new Event('cancel')); }
}
const realDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const realFetch = globalThis.fetch;
const createUrl = URL.createObjectURL;
const revokeUrl = URL.revokeObjectURL;
let inputs: Input[];
let created: string[];
let revoked: string[];
beforeEach(() => {
  inputs = []; created = []; revoked = [];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: (tag: string) => { assert.equal(tag, 'input'); const input = new Input(); inputs.push(input); return input; },
  } });
  URL.createObjectURL = (blob) => { const uri = createUrl(blob); created.push(uri); return uri; };
  URL.revokeObjectURL = (uri) => { revoked.push(uri); revokeUrl(uri); };
});
afterEach(() => {
  useAttachStore.getState().resolve(null);
  for (const uri of created) revokeUrl(uri);
  URL.createObjectURL = createUrl;
  URL.revokeObjectURL = revokeUrl;
  globalThis.fetch = realFetch;
  if (realDocument) Object.defineProperty(globalThis, 'document', realDocument);
  else Reflect.deleteProperty(globalThis, 'document');
});
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function asset(name: string) {
  const uri = URL.createObjectURL(new Blob([name]));
  let released = false;
  return { uri, fileName: name, type: 'text/plain', release() {
    if (!released) { released = true; URL.revokeObjectURL(uri); }
  } };
}
async function assertOwned(attachment: Attachment | null, uri: string) {
  assert.ok(attachment);
  assert.equal(attachment.uri, uri);
  assert.equal(revoked.includes(uri), false, 'successful transfer must keep its URL usable');
  assert.ok((await realFetch(uri)).ok);
  assert.equal(typeof attachment.release, 'function', 'the recipient must receive eventual ownership');
  attachment.release!(); attachment.release!();
  assert.equal(revoked.filter((value) => value === uri).length, 1, 'release is idempotent');
}

it('the real sheet transfers the first dropped asset and immediately releases the rest', async () => {
  const pending = useAttachStore.getState().request();
  const first = asset('first.txt'); const second = asset('second.txt');
  sheet().drop({ assets: [first, second] });
  assert.deepEqual(revoked, [second.uri]);
  await assertOwned(await pending, first.uri);
});

for (const scenario of ['closed', 'text-first'] as const) {
  it(`the real sheet releases every unadopted asset for a ${scenario} drop`, async () => {
    const assets = [asset('first.txt'), asset('second.txt')];
    if (scenario === 'text-first') {
      void useAttachStore.getState().request();
      sheet().drop({ assets: [{ type: 'text', text: 'hello' }, ...assets] });
    } else sheet().drop({ assets });
    await flush();
    assert.deepEqual([...revoked].sort(), assets.map((entry) => entry.uri).sort());
  });
}

for (const boundary of ['cancel', 'replace'] as const) {
  it(`the real sheet releases a picker result after dialog ${boundary}`, async () => {
    const original = useAttachStore.getState().request();
    const ui = sheet(); ui.choose();
    const replacement = boundary === 'replace' ? useAttachStore.getState().request() : null;
    if (boundary === 'cancel') ui.close();
    assert.equal(await original, null);
    inputs[0]!.select(); await flush();
    assert.deepEqual(revoked, created);
    assert.equal(created.length, 1);
    if (replacement) {
      assert.equal(useAttachStore.getState().open, true);
      useAttachStore.getState().resolve(null); assert.equal(await replacement, null);
    }
  });

  it(`the real sheet releases an in-flight downloaded URL after dialog ${boundary}`, async () => {
    const response = deferred<Response>(); const started = deferred<void>();
    globalThis.fetch = () => { started.resolve(); return response.promise; };
    const original = useAttachStore.getState().request(); const ui = sheet();
    ui.drop({ assets: [{ uri: 'https://example.invalid/file.txt', type: 'text/plain' }] });
    await started.promise;
    const replacement = boundary === 'replace' ? useAttachStore.getState().request() : null;
    if (boundary === 'cancel') ui.close();
    assert.equal(await original, null);
    response.resolve(new Response('downloaded')); await flush();
    assert.deepEqual(revoked, created); assert.equal(created.length, 1);
    if (replacement) {
      assert.equal(useAttachStore.getState().open, true);
      useAttachStore.getState().resolve(null); assert.equal(await replacement, null);
    }
  });
}

it('the real sheet transfers the picker URL to the request caller without revoking it', async () => {
  const pending = useAttachStore.getState().request(); sheet().choose(); inputs[0]!.select();
  await assertOwned(await pending, created[0]!);
});

it('a second successful acquisition cannot orphan a URL after the same request settles', async () => {
  const pending = useAttachStore.getState().request(); const ui = sheet(); ui.choose(); ui.choose();
  inputs[0]!.select('first.txt'); inputs[1]!.select('second.txt');
  const attachment = await pending; await flush();
  assert.deepEqual(revoked, [created[1]]);
  await assertOwned(attachment, created[0]!);
});

it('picker cancellation removes the remaining change handler before it can allocate a URL', async () => {
  const pending = pickFile(); inputs[0]!.cancel(); inputs[0]!.select();
  assert.equal(await pending, null); assert.deepEqual(created, []);
});

it('the picker rejects allocation failures instead of leaving acquisition unresolved', async () => {
  const pending = acquireAttachment(pickFile, () => {});
  URL.createObjectURL = () => { throw new Error('Allocation failed'); };
  inputs[0]!.select();
  assert.equal(await pending, null);
});

it('successful streaming downloads retain their URL until the attachment owner releases it', async () => {
  globalThis.fetch = async () => new Response('downloaded');
  const attachment = await acquireAttachment(async () => ({ uri: 'https://example.invalid/file.txt' }), () => {});
  await assertOwned(attachment, created[0]!);
});

it('body-less downloads preserve the string API and optionally hand off release', async () => {
  globalThis.fetch = async () => ({ ok: true, body: null, headers: new Headers(), blob: async () => new Blob(['file']) }) as Response;
  let release: (() => void) | undefined;
  const uri = await downloadAttachment('https://example.invalid/file.txt', 'file.txt', () => {}, (cleanup) => { release = cleanup; });
  assert.equal(typeof uri, 'string'); assert.equal(typeof release, 'function');
  assert.deepEqual(revoked, []); release!(); release!(); assert.deepEqual(revoked, [uri]);
});

it('a failed final progress report disposes the downloaded URL', async () => {
  globalThis.fetch = async () => new Response('downloaded');
  const attachment = await attach({ uri: 'https://example.invalid/file.txt' }, (progress) => {
    if (progress.phase === 'done') throw new Error('View was disposed');
  });
  assert.equal(attachment, null); assert.equal(created.length, 1); assert.deepEqual(revoked, created);
});

it('a failed local handoff releases its source instead of abandoning it', async () => {
  const source = asset('failed.txt');
  assert.equal(await acquireAttachment(async () => source, (progress) => {
    if (progress.phase === 'done') throw new Error('View was disposed');
  }), null);
  assert.deepEqual(revoked, [source.uri]);
});

it('resolving without a waiting request releases the otherwise unowned result', () => {
  const source = asset('orphan.txt');
  useAttachStore.getState().resolve({ ...source, name: source.fileName });
  assert.deepEqual(revoked, [source.uri]);
});


it('legacy direct download callers still receive a usable string URI', async () => {
  globalThis.fetch = async () => new Response('legacy');
  const uri = await downloadAttachment('https://example.invalid/file.txt', 'file.txt', () => {});
  assert.equal(typeof uri, 'string');
  assert.equal(await (await realFetch(uri!)).text(), 'legacy');
  assert.deepEqual(revoked, []);
  URL.revokeObjectURL(uri!);
});

it('a rejected download ownership callback releases the newly allocated URL', async () => {
  globalThis.fetch = async () => new Response('downloaded');
  await assert.rejects(downloadAttachment('https://example.invalid/file.txt', 'file.txt', () => {}, () => {
    throw new Error('Recipient failed');
  }), /Recipient failed/);
  assert.equal(created.length, 1); assert.deepEqual(revoked, created);
});

for (const success of [true, false]) {
  it(`remote attachment ${success ? 'success' : 'failure'} releases its replaced source resource`, async () => {
    let sourceReleases = 0;
    globalThis.fetch = async () => new Response('downloaded', { status: success ? 200 : 503 });
    const result = await attach({ uri: 'https://example.invalid/file.txt', release: () => { sourceReleases++; } }, () => {});
    assert.equal(sourceReleases, 1);
    if (success) await assertOwned(result, created[0]!);
    else { assert.equal(result, null); assert.deepEqual(created, []); }
  });
}
