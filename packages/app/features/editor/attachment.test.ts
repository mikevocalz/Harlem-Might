import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, it } from 'node:test';
import type { AttachProgress } from './attachment.ts';

// Resolve the actual web adapter in Node, just as the web bundler does.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './download' && context.parentURL === new URL('./attachment.ts', import.meta.url).href) {
      return next('./download.web.ts', context);
    }
    return next(specifier, context);
  },
});
const { acquireAttachment, attach, fileNameFrom, IDLE_PROGRESS } = await import('./attachment.ts');

it('keeps malformed-percent filenames usable and attaches the original local URI', async () => {
  for (const name of ['100%.pdf', '%E0%A4.pdf', '%zz.txt']) {
    const uri = `file:///documents/${name}`;
    assert.equal(fileNameFrom(uri), name);
    const progress: AttachProgress[] = [];
    assert.deepEqual(await attach({ uri }, (next) => progress.push(next)), { uri, name });
    assert.equal(progress.at(-1)?.phase, 'done');
    assert.equal(progress.at(-1)?.error, null);
  }
  assert.equal(fileNameFrom('file:///documents/hello%20world.pdf?download=1'), 'hello world.pdf');
  assert.equal(fileNameFrom('file:///documents/'), 'attachment');
});

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

it('reports rejected picker acquisition in the displayed error progress channel', async () => {
  const progress: AttachProgress[] = [];
  const attachment = await acquireAttachment(async () => { throw new Error('Picker unavailable'); },
    (next) => progress.push(next));
  assert.equal(attachment, null);
  assert.deepEqual(progress, [{ ...IDLE_PROGRESS, phase: 'error', error: 'Picker unavailable' }]);
});

it('uses the attachment fallback message when a picker rejects without an Error', async () => {
  const progress: AttachProgress[] = [];
  assert.equal(await acquireAttachment(() => Promise.reject('unavailable'),
    (next) => progress.push(next)), null);
  assert.equal(progress.at(-1)?.error, 'Could not attach that file.');
});

it('keeps picker cancellation idle without downloading or completing an attachment', async () => {
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; throw new Error('Unexpected download'); };
  const progress: AttachProgress[] = [];
  assert.equal(await acquireAttachment(async () => null, (next) => progress.push(next)), null);
  assert.deepEqual(progress, [IDLE_PROGRESS]);
  assert.equal(fetched, false);
});

it('can attach a local file after acquisition failed', async () => {
  const progress: AttachProgress[] = [];
  const report = (next: AttachProgress) => progress.push(next);
  await acquireAttachment(async () => { throw new Error('Picker unavailable'); }, report);
  const source = { uri: 'file:///100%.pdf' };
  assert.deepEqual(await acquireAttachment(async () => source, report), { ...source, name: '100%.pdf' });
  assert.equal(progress.at(-1)?.phase, 'done');
  assert.equal(progress.at(-1)?.error, null);
});

it('uses the real web transfer adapter and turns download failures into error progress', async () => {
  const progress: AttachProgress[] = [];
  globalThis.fetch = async () => new Response('unavailable', { status: 503 });
  const source = { uri: 'https://example.invalid/100%.pdf' };
  assert.equal(await acquireAttachment(async () => source, (next) => progress.push(next)), null);
  assert.equal(progress[0]?.phase, 'attaching');
  assert.equal(progress.at(-1)?.phase, 'error');
  assert.equal(progress.at(-1)?.name, '100%.pdf');
  assert.equal(progress.at(-1)?.error, 'Could not fetch that file (503).');
});

for (const outcome of ['picked', 'rejected'] as const) {
  it(`ignores a ${outcome} picker after its dialog request is no longer current`, async () => {
    const picker = deferred<{ uri: string }>();
    let current = true;
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; throw new Error('Unexpected download'); };
    const progress: AttachProgress[] = [];
    const pending = acquireAttachment(() => picker.promise, (next) => progress.push(next), () => current);
    current = false;
    if (outcome === 'picked') picker.resolve({ uri: 'https://example.invalid/document.pdf' });
    else picker.reject(new Error('Late picker error'));
    assert.equal(await pending, null);
    assert.deepEqual(progress, []);
    assert.equal(fetched, false);
  });
}

it('ignores download errors after its dialog is closed or replaced', async () => {
  const transfer = deferred<Response>();
  const started = deferred<void>();
  globalThis.fetch = () => { started.resolve(); return transfer.promise; };
  let current = true;
  const progress: AttachProgress[] = [];
  const pending = acquireAttachment(async () => ({ uri: 'https://example.invalid/document.pdf' }),
    (next) => progress.push(next), () => current);
  await started.promise;
  assert.equal(progress.at(-1)?.phase, 'attaching');
  current = false;
  transfer.reject(new Error('Late download error'));
  assert.equal(await pending, null);
  assert.equal(progress.length, 1);
});

it('does not reopen a picker for an already-dismissed dialog request', async () => {
  let picked = false;
  const progress: AttachProgress[] = [];
  assert.equal(await acquireAttachment(async () => { picked = true; return null; },
    (next) => progress.push(next), () => false), null);
  assert.equal(picked, false);
  assert.deepEqual(progress, []);
});

for (const [declared, expected] of [
  ['1', [1, 1]],
  ['6', [1 / 3, 1 / 2]],
  [null, [0, 0]],
  ['0', [0, 0]],
  ['-1', [0, 0]],
  ['Infinity', [0, 0]],
  ['not-a-size', [0, 0]],
] as const) {
  it(`bounds actual streamed attachment progress with content-length ${declared}`, async () => {
    globalThis.fetch = async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3]));
        controller.close();
      },
    }), { headers: declared === null ? {} : { 'content-length': declared } });
    const progress: AttachProgress[] = [];
    const attachment = await attach({ uri: 'https://example.invalid/document.pdf' }, (next) => progress.push(next));
    assert.ok(attachment);
    try {
      const transfer = progress.filter((next) => next.phase === 'attaching').slice(1);
      assert.deepEqual(transfer.map((next) => next.ratio), expected);
      for (const next of transfer) {
        assert.equal(Number.isFinite(next.ratio) && next.ratio >= 0 && next.ratio <= 1, true);
        assert.equal(next.bytesTotal, declared === '1' || declared === '6' ? Number(declared) : null);
      }
      assert.equal(progress.at(-1)?.phase, 'done');
      assert.equal((await (await realFetch(attachment.uri)).blob()).size, 3);
    } finally {
      URL.revokeObjectURL(attachment.uri);
    }
  });
}
