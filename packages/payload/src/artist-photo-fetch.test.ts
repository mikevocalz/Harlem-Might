import assert from 'node:assert/strict';
import { lookup } from 'node:dns';
import { EventEmitter } from 'node:events';
import { request, type RequestOptions } from 'node:https';
import type { IncomingMessage, OutgoingHttpHeaders } from 'node:http';
import { Readable } from 'node:stream';
import { describe, it } from 'node:test';
import {
  createPhotoLookup, createPublicPhotoFetcher, isPublicPhotoAddress, PhotoFetchError,
} from './artist-photo-fetch.ts';

const dns = (addresses = [{ address: '93.184.216.34', family: 4 }]) =>
  ((_name: string, _options: unknown, callback: (error: Error | null, values: typeof addresses) => void) => {
    callback(null, addresses);
  }) as typeof lookup;

function upstreamFixture({
  status = 200, type = 'image/jpeg', length, encoding,
  chunks = [Buffer.from('image')], stall = false,
}: { status?: number; type?: string; length?: string; encoding?: string; chunks?: Buffer[]; stall?: boolean } = {}) {
  let connections = 0;
  let options: RequestOptions | undefined;
  const upstream = (stall ? new Readable({ read() {} }) : Readable.from(chunks)) as IncomingMessage;
  upstream.statusCode = status;
  upstream.headers = { 'content-type': type, 'content-length': length, 'content-encoding': encoding };
  const transport = ((_url: URL, init: RequestOptions, callback: (value: IncomingMessage) => void) => {
    connections++;
    options = init;
    const req = new EventEmitter() as EventEmitter & { end(): void; destroy(): void };
    req.destroy = () => { upstream.destroy(); };
    req.end = () => queueMicrotask(() => {
      init.lookup!('cdn.example', {}, (error) => {
        if (error) req.emit('error', error);
        else callback(upstream);
      });
    });
    init.signal?.addEventListener('abort', () => {
      upstream.destroy();
      req.emit('error', new Error('aborted'));
    });
    return req;
  }) as typeof request;
  return { transport, upstream, connections: () => connections, options: () => options };
}

const reason = (expected: PhotoFetchError['reason']) =>
  (error: unknown) => error instanceof PhotoFetchError && error.reason === expected;

describe('photo public-network boundary', () => {
  it('rejects special-use IPv4, IPv6, mapped and encoded addresses', async () => {
    for (const address of [
      '0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.169.254',
      '172.16.1.1', '192.168.1.1', '192.0.0.1', '192.0.2.1', '198.18.0.1',
      '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255',
      '::1', '::', 'fd00::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1',
      '64:ff9b::a00:1', '2001:db8::1', '2002:7f00:1::1', '3fff::1',
    ]) assert.equal(isPublicPhotoAddress(address), false, address);
    assert.equal(isPublicPhotoAddress('93.184.216.34'), true);
    assert.equal(isPublicPhotoAddress('2606:4700:4700::1111'), true);
    const fixture = upstreamFixture();
    const fetcher = createPublicPhotoFetcher(fixture.transport, dns());
    for (const url of [
      'https://[::1]/', 'https://[fd00::1]/', 'https://[::ffff:127.0.0.1]/',
      'https://2130706433/', 'https://0x7f000001/', 'https://127.1/',
      'http://cdn.example/', 'https://user:password@cdn.example/', 'https://cdn.example:8080/',
    ]) await assert.rejects(fetcher(url), reason('blocked'));
    assert.equal(fixture.connections(), 0);
  });

  it('rejects mixed public/private DNS answers before connecting', async () => {
    const fixture = upstreamFixture();
    const fetcher = createPublicPhotoFetcher(fixture.transport, dns([
      { address: '93.184.216.34', family: 4 }, { address: 'fd00::1', family: 6 },
    ]));
    await assert.rejects(fetcher('https://cdn.example/', { kind: 'image' }), reason('blocked'));
    assert.equal(fixture.upstream.readableDidRead, false);
  });

  it('uses the validated lookup answers directly for the socket', async () => {
    let calls = 0;
    const resolve = ((_name: string, _options: unknown, callback: (error: Error | null, values: { address: string; family: number }[]) => void) => {
      calls++;
      callback(null, [{ address: calls === 1 ? '93.184.216.34' : '127.0.0.1', family: 4 }]);
    }) as typeof lookup;
    const address = await new Promise((fulfill, reject) => {
      createPhotoLookup(resolve)('cdn.example', { all: true }, (error, value) => error ? reject(error) : fulfill(value));
    });
    assert.deepEqual(address, [{ address: '93.184.216.34', family: 4 }]);
    assert.equal(calls, 1);
  });

  it('does not follow any redirect to another resource', async () => {
    const fixture = upstreamFixture({ status: 302 });
    fixture.upstream.headers.location = 'https://127.0.0.1/private';
    await assert.rejects(createPublicPhotoFetcher(fixture.transport, dns())('https://cdn.example/', { kind: 'image' }), reason('unavailable'));
    assert.equal(fixture.connections(), 1);
    assert.equal(fixture.upstream.destroyed, true);
  });
});

describe('photo resource limits', () => {
  it('returns a bounded image and keeps the original TLS hostname', async () => {
    const fixture = upstreamFixture();
    const result = await createPublicPhotoFetcher(fixture.transport, dns())('https://cdn.example/a.jpg', { kind: 'image' });
    assert.equal(await result.text(), 'image');
    assert.equal(result.contentType, 'image/jpeg');
    assert.equal(result.url, 'https://cdn.example/a.jpg');
    assert.equal(fixture.options()?.agent, false);
    assert.equal((fixture.options()?.headers as OutgoingHttpHeaders)['accept-encoding'], 'identity');
  });

  for (const length of [undefined, '1']) {
    it(`cancels an oversized streamed image with ${length ? 'understated' : 'absent'} Content-Length`, async () => {
      const fixture = upstreamFixture({ length, chunks: [Buffer.alloc(8 * 1024 * 1024), Buffer.alloc(8 * 1024 * 1024)] });
      await assert.rejects(createPublicPhotoFetcher(fixture.transport, dns())('https://cdn.example/', { kind: 'image' }), reason('too-large'));
      assert.equal(fixture.upstream.destroyed, true);
    });
  }

  it('rejects a declared oversized response before reading', async () => {
    const fixture = upstreamFixture({ length: String(16 * 1024 * 1024) });
    await assert.rejects(createPublicPhotoFetcher(fixture.transport, dns())('https://cdn.example/', { kind: 'image' }), reason('too-large'));
    assert.equal(fixture.upstream.readableDidRead, false);
  });

  it('bounds profile HTML separately at 2 MiB', async () => {
    const fixture = upstreamFixture({ type: 'text/html', chunks: [Buffer.alloc(2 * 1024 * 1024 + 1)] });
    await assert.rejects(createPublicPhotoFetcher(fixture.transport, dns())('https://profile.example/'), reason('too-large'));
    assert.equal(fixture.upstream.destroyed, true);
  });

  it('rejects active image types, unexpected compression and empty bodies', async () => {
    for (const settings of [{ type: 'image/svg+xml' }, { encoding: 'gzip' }]) {
      const fixture = upstreamFixture(settings);
      await assert.rejects(createPublicPhotoFetcher(fixture.transport, dns())('https://cdn.example/', { kind: 'image' }), reason('unsupported'));
      assert.equal(fixture.upstream.destroyed, true);
    }
    const fixture = upstreamFixture({ chunks: [] });
    await assert.rejects(createPublicPhotoFetcher(fixture.transport, dns())('https://cdn.example/', { kind: 'image' }), reason('unavailable'));
  });

  it('aborts a stalled body by the overall deadline', async () => {
    const fixture = upstreamFixture({ stall: true });
    await assert.rejects(createPublicPhotoFetcher(fixture.transport, dns(), 20)('https://cdn.example/', { kind: 'image' }), /aborted/);
    assert.equal(fixture.upstream.destroyed, true);
  });
});


it('preserves the 20 MiB Commons ingestion ceiling without raising the proxy limit', async () => {
  const fixture = upstreamFixture({ chunks: [Buffer.alloc(20 * 1024 * 1024)] });
  const photo = await createPublicPhotoFetcher(fixture.transport, dns())('https://upload.wikimedia.org/wikipedia/commons/a/aa/portrait.jpg', { kind: 'commons-image' });
  assert.equal(photo.bytes.length, 20 * 1024 * 1024);
  const oversized = upstreamFixture({ chunks: [Buffer.alloc(20 * 1024 * 1024), Buffer.alloc(1)] });
  await assert.rejects(createPublicPhotoFetcher(oversized.transport, dns())('https://upload.wikimedia.org/wikipedia/commons/a/aa/portrait.jpg', { kind: 'commons-image' }), reason('too-large'));
  assert.equal(oversized.upstream.destroyed, true);
});

it('serves WEBP by response media type even when the selected Bloodshed URL ends in .jpg', async () => {
  const fixture = upstreamFixture({ type: 'image/webp', chunks: [Buffer.from('RIFF-photo-WEBP')] });
  const url = 'https://static.wikia.nocookie.net/hip-hop-music/images/a/a8/Bloodshed2.jpg/revision/latest?cb=20140201024637';
  const result = await createPublicPhotoFetcher(fixture.transport, dns())(url, { kind: 'image' });
  assert.equal(result.contentType, 'image/webp');
  assert.equal(result.url, url);
  assert.equal(await result.text(), 'RIFF-photo-WEBP');
});
