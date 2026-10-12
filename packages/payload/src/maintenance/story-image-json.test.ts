import assert from 'node:assert/strict';
import { describe, it, type TestContext } from 'node:test';
import { fetchStoryImageJson } from './story-image-json.ts';

const url = 'https://metadata.example.invalid/w/api.php?format=json';
const headers = { 'User-Agent': 'HarlemMightTest/1.0' };
const page = { query: { pages: { '1': { pageimage: 'Harlem.jpg' } } } };
const validResponse = () => new Response(JSON.stringify(page));

type Event = 'fetch' | number;

function fixture(t: TestContext, responses: (Response | Error)[]) {
  const events: Event[] = [];
  const deadlines: number[] = [];
  const signals: AbortSignal[] = [];
  t.mock.method(AbortSignal, 'timeout', (ms: number) => {
    deadlines.push(ms);
    const signal = new AbortController().signal;
    signals.push(signal);
    return signal;
  });
  t.mock.method(globalThis, 'setTimeout', (resolve: () => void, ms: number) => {
    events.push(ms);
    resolve();
  });
  t.mock.method(globalThis, 'fetch', async (input: string, init?: RequestInit) => {
    events.push('fetch');
    assert.equal(input, url);
    assert.equal(init?.headers, headers);
    assert.equal(init?.signal, signals.at(-1));
    const response = responses.shift();
    assert.ok(response, 'unexpected extra request');
    if (response instanceof Error) throw response;
    return response;
  });
  return { events, deadlines, signals, remaining: responses };
}

describe('story lead-image JSON retries', () => {
  it('returns a valid object unchanged without waiting, preserving headers and the timeout', async (t) => {
    const state = fixture(t, [validResponse()]);
    assert.deepEqual(await fetchStoryImageJson<typeof page>(url, headers), page);
    assert.deepEqual(state.events, ['fetch']);
    assert.deepEqual(state.deadlines, [60_000]);
    assert.equal(state.remaining.length, 0);
  });

  for (const body of ['{"query":', '{"query":}']) {
    it(`retries malformed object JSON (${body}) and returns the next valid response`, async (t) => {
      const state = fixture(t, [new Response(body), validResponse()]);
      assert.deepEqual(await fetchStoryImageJson<typeof page>(url, headers), page);
      assert.deepEqual(state.events, ['fetch', 5_000, 'fetch']);
      assert.deepEqual(state.deadlines, [60_000, 60_000]);
      assert.notEqual(state.signals[0], state.signals[1]);
      assert.equal(state.remaining.length, 0);
    });
  }

  it('can recover on the fourth and final request with the existing rate-limit delays', async (t) => {
    const state = fixture(t, [
      new Response('{"query":'),
      new Response('<html>temporarily unavailable</html>'),
      new Response('{"error":"rate limited"}', { status: 429 }),
      validResponse(),
    ]);
    assert.deepEqual(await fetchStoryImageJson<typeof page>(url, headers), page);
    assert.deepEqual(state.events, ['fetch', 5_000, 'fetch', 10_000, 'fetch', 15_000, 'fetch']);
    assert.deepEqual(state.deadlines, [60_000, 60_000, 60_000, 60_000]);
    assert.equal(state.remaining.length, 0);
  });

  it('exhausts malformed JSON after four requests without another sleep or request', async (t) => {
    const state = fixture(t, [...Array.from({ length: 4 }, () => new Response('{"query":')), validResponse()]);
    await assert.rejects(fetchStoryImageJson(url, headers), {
      name: 'Error', message: 'metadata.example.invalid answered 200',
    });
    assert.deepEqual(state.events, ['fetch', 5_000, 'fetch', 10_000, 'fetch', 15_000, 'fetch']);
    assert.deepEqual(state.deadlines, [60_000, 60_000, 60_000, 60_000]);
    assert.equal(state.remaining.length, 1);
  });

  for (const body of ['', 'temporarily unavailable', '<html>temporarily unavailable</html>']) {
    it(`continues to retry a non-JSON body (${JSON.stringify(body)})`, async (t) => {
      const state = fixture(t, [new Response(body), validResponse()]);
      assert.deepEqual(await fetchStoryImageJson<typeof page>(url, headers), page);
      assert.deepEqual(state.events, ['fetch', 5_000, 'fetch']);
    });
  }

  it('does not accept valid object JSON from an unsuccessful HTTP response', async (t) => {
    const state = fixture(t, [new Response(JSON.stringify(page), { status: 503 }), validResponse()]);
    assert.deepEqual(await fetchStoryImageJson<typeof page>(url, headers), page);
    assert.deepEqual(state.events, ['fetch', 5_000, 'fetch']);
  });

  it('preserves the final HTTP error and four-request bound', async (t) => {
    const state = fixture(t, [
      ...Array.from({ length: 3 }, () => new Response('busy', { status: 503 })),
      new Response('{"error":"rate limited"}', { status: 429 }),
      validResponse(),
    ]);
    await assert.rejects(fetchStoryImageJson(url, headers), {
      name: 'Error', message: 'metadata.example.invalid answered 429',
    });
    assert.deepEqual(state.events, ['fetch', 5_000, 'fetch', 10_000, 'fetch', 15_000, 'fetch']);
    assert.equal(state.remaining.length, 1);
  });

  // Keep the object-only gate without adding response-schema validation.
  for (const body of ['[]', 'null', '"string"', '42']) {
    it(`preserves rejection of a body without an initial object prefix (${JSON.stringify(body)})`, async (t) => {
      const state = fixture(t, Array.from({ length: 4 }, () => new Response(body)));
      await assert.rejects(fetchStoryImageJson(url, headers), /metadata\.example\.invalid answered 200/);
      assert.deepEqual(state.events, ['fetch', 5_000, 'fetch', 10_000, 'fetch', 15_000, 'fetch']);
    });
  }

  for (const whitespace of [' ', '\t\r\n', '\n ']) {
    it(`accepts valid object JSON with surrounding whitespace (${JSON.stringify(whitespace)})`, async (t) => {
      const state = fixture(t, [new Response(`${whitespace}${JSON.stringify(page)}${whitespace}`)]);
      assert.deepEqual(await fetchStoryImageJson<typeof page>(url, headers), page);
      assert.deepEqual(state.events, ['fetch']);
      assert.deepEqual(state.deadlines, [60_000]);
    });
  }

  it('still returns valid object JSON without validating the Wikimedia schema', async (t) => {
    const state = fixture(t, [new Response('{"error":{"code":"missingtitle"}}')]);
    assert.deepEqual(await fetchStoryImageJson(url, headers), { error: { code: 'missingtitle' } });
    assert.deepEqual(state.events, ['fetch']);
  });

  it('does not change immediate propagation of a transport failure', async (t) => {
    const error = new TypeError('fetch failed');
    const state = fixture(t, [error, validResponse()]);
    await assert.rejects(fetchStoryImageJson(url, headers), (actual) => actual === error);
    assert.deepEqual(state.events, ['fetch']);
    assert.equal(state.remaining.length, 1);
  });

  it('does not change immediate propagation of a response-body read failure', async (t) => {
    const error = new Error('body stream failed');
    const response = validResponse();
    t.mock.method(response, 'text', async () => { throw error; });
    const state = fixture(t, [response, validResponse()]);
    await assert.rejects(fetchStoryImageJson(url, headers), (actual) => actual === error);
    assert.deepEqual(state.events, ['fetch']);
    assert.equal(state.remaining.length, 1);
  });
});
