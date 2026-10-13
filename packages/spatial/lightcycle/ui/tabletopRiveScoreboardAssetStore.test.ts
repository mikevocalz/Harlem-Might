import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import { tabletopRiveScoreboardAsset as asset } from './tabletopRiveScoreboardAssetStore.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const originalFetch = globalThis.fetch;
const requests: { source: string; response: ReturnType<typeof deferred<Response>> }[] = [];
const A = 'https://example.invalid/a.riv';
const B = 'https://example.invalid/b.riv';

beforeEach(() => {
  asset.reset();
  requests.length = 0;
  globalThis.fetch = (source) => {
    const response = deferred<Response>();
    requests.push({ source: String(source), response });
    return response.promise;
  };
});

afterEach(() => {
  asset.reset();
  globalThis.fetch = originalFetch;
});

function bytesResponse(value: number) {
  return new Response(new Uint8Array([value]));
}

function assertReady(source: string, value: number) {
  const state = asset.getState();
  assert.equal(state.source, source);
  assert.equal(state.status, 'ready');
  assert.equal(state.error, null);
  assert.deepEqual(Array.from(new Uint8Array(state.bytes!)), [value]);
}

it('loads real response bytes and coalesces loading/ready requests for the same source', async () => {
  const loading = asset.load(A);
  await asset.load(A);
  assert.equal(requests.length, 1);
  assert.equal(asset.getState().status, 'loading');
  requests[0]!.response.resolve(bytesResponse(1));
  await loading;
  assertReady(A, 1);
  await asset.load(A);
  assert.equal(requests.length, 1);
});

for (const reset of ['reset', 'empty source'] as const) {
  for (const staleOutcome of ['bytes', 'fetch failure', 'HTTP failure', 'body failure'] as const) {
    it(`${reset} revokes old ${staleOutcome} after a same-URL reload`, async () => {
      const old = asset.load(A);
      if (reset === 'reset') asset.reset();
      else await asset.load('');
      const current = asset.load(A);
      requests[1]!.response.resolve(bytesResponse(2));
      await current;
      assertReady(A, 2);

      if (staleOutcome === 'bytes') requests[0]!.response.resolve(bytesResponse(1));
      else if (staleOutcome === 'fetch failure') requests[0]!.response.reject(new Error('old fetch'));
      else if (staleOutcome === 'HTTP failure') requests[0]!.response.resolve(new Response(null, { status: 503 }));
      else {
        const response = bytesResponse(1);
        response.arrayBuffer = async () => { throw new Error('old body'); };
        requests[0]!.response.resolve(response);
      }
      await old;
      assertReady(A, 2);
    });
  }
}

it('does not let a superseded source regain ownership when the URL changes A → B → A', async () => {
  const oldA = asset.load(A);
  const oldB = asset.load(B);
  const currentA = asset.load(A);
  assert.deepEqual(requests.map(({ source }) => source), [A, B, A]);
  requests[2]!.response.resolve(bytesResponse(3));
  await currentA;
  requests[1]!.response.reject(new Error('old B'));
  requests[0]!.response.resolve(bytesResponse(1));
  await Promise.all([oldA, oldB]);
  assertReady(A, 3);
});

it('revokes a response whose body was already being read when reset occurred', async () => {
  const body = deferred<ArrayBuffer>();
  const bodyStarted = deferred<void>();
  const response = bytesResponse(1);
  response.arrayBuffer = () => { bodyStarted.resolve(); return body.promise; };
  const old = asset.load(A);
  requests[0]!.response.resolve(response);
  await bodyStarted.promise;
  asset.reset();
  const current = asset.load(A);
  requests[1]!.response.resolve(bytesResponse(2));
  await current;
  body.resolve(new Uint8Array([1]).buffer);
  await old;
  assertReady(A, 2);
});

for (const outcome of ['bytes', 'failure'] as const) {
  it(`keeps reset state idle when old ${outcome} settles without a replacement`, async () => {
    const old = asset.load(A);
    asset.reset();
    if (outcome === 'bytes') requests[0]!.response.resolve(bytesResponse(1));
    else requests[0]!.response.reject(new Error('stale'));
    await old;
    assert.equal(asset.getState().source, '');
    assert.equal(asset.getState().status, 'idle');
    assert.equal(asset.getState().bytes, undefined);
    assert.equal(asset.getState().error, null);
  });
}

for (const outcome of ['fetch failure', 'HTTP failure', 'body failure'] as const) {
  it(`reports a current ${outcome} and allows an explicit same-source retry`, async () => {
    const loading = asset.load(A);
    if (outcome === 'fetch failure') requests[0]!.response.reject(new Error('offline'));
    else if (outcome === 'HTTP failure') requests[0]!.response.resolve(new Response(null, { status: 503 }));
    else {
      const response = bytesResponse(1);
      response.arrayBuffer = async () => { throw new Error('bad body'); };
      requests[0]!.response.resolve(response);
    }
    await loading;
    assert.equal(asset.getState().status, 'failed');
    assert.equal(asset.getState().bytes, undefined);
    assert.match(asset.getState().error!, /offline|503|bad body/);
    const retry = asset.load(A);
    requests[1]!.response.resolve(bytesResponse(2));
    await retry;
    assertReady(A, 2);
  });
}
