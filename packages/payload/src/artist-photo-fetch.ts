import { lookup } from 'node:dns';
import { request, type RequestOptions } from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
  ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20],
] as const) blocked.addSubnet(address, prefix, 'ipv6');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');

/** Fail closed for special-use, mapped, private and non-unicast addresses. */
export function isPublicPhotoAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  return family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

export class PhotoFetchError extends Error {
  readonly reason: 'blocked' | 'unavailable' | 'too-large' | 'unsupported';

  constructor(reason: PhotoFetchError['reason']) {
    super(`Artist photo upstream ${reason}`);
    this.reason = reason;
  }
}

/** Validate the actual DNS answers used by the socket, avoiding a second lookup. */
export function createPhotoLookup(resolve: typeof lookup = lookup): LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) return callback(error, []);
      if (!addresses.length || addresses.some(({ address }) => !isPublicPhotoAddress(address))) {
        return callback(new PhotoFetchError('blocked'), []);
      }
      // Honour the socket's requested family, but validate *all* DNS answers first.
      const matching = addresses.filter(({ family }) => !options.family || family === options.family);
      const first = matching[0];
      if (!first) return callback(new PhotoFetchError('blocked'), []);
      callback(null, options.all ? matching : first.address, first.family);
    });
  };
}

type PhotoFetchOptions = {
  kind?: 'metadata' | 'image';
  headers?: Record<string, string>;
};

/** Injectable transport for deterministic tests; production always uses Node HTTPS. */
export function createPublicPhotoFetcher(
  transport: typeof request = request,
  resolve: typeof lookup = lookup,
  deadlineMs = 30_000,
) {
  return async (value: string, options: PhotoFetchOptions = {}) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new PhotoFetchError('blocked');
    }
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (
      url.protocol !== 'https:' || url.username || url.password ||
      (url.port && url.port !== '443') ||
      (isIP(hostname) && !isPublicPhotoAddress(hostname)) ||
      hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')
    ) throw new PhotoFetchError('blocked');

    const image = options.kind === 'image';
    const maxBytes = image ? 15 * 1024 * 1024 : 2 * 1024 * 1024;
    return new Promise<{
      ok: true;
      url: string;
      contentType: string;
      bytes: Uint8Array<ArrayBuffer>;
      json(): Promise<unknown>;
      text(): Promise<string>;
    }>((resolveResponse, reject) => {
      const controller = new AbortController();
      // Covers DNS, TLS, headers and the entire body, including trickle responses.
      const timer = setTimeout(() => controller.abort(), deadlineMs);
      const fail = (error: Error) => {
        clearTimeout(timer);
        reject(error);
      };
      const requestOptions: RequestOptions = {
        method: 'GET',
        // No pooled/proxy sockets: every connection passes the validated lookup.
        agent: false,
        lookup: createPhotoLookup(resolve),
        signal: controller.signal,
        headers: {
          ...options.headers,
          'accept-encoding': 'identity',
          'user-agent': 'HarlemMight/1.0 (+https://harlemmight.com)',
        },
      };
      // HTTPS.request never follows redirects. Reject all 3xx without fetching Location.
      let req: ReturnType<typeof request>;
      try {
        req = transport(url, requestOptions, (upstream) => {
          const stop = (reason: PhotoFetchError['reason']) => {
            fail(new PhotoFetchError(reason));
            upstream.destroy();
            req.destroy();
          };
          const status = upstream.statusCode ?? 0;
          if (status < 200 || status >= 300) return stop('unavailable');
          const contentType = (upstream.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
          const encoding = upstream.headers['content-encoding'];
          if (encoding && encoding !== 'identity') return stop('unsupported');
          if (!(image ? /^image\/(jpeg|png|webp|gif|avif)$/ : /^(application\/json|text\/html|application\/xhtml\+xml)$/).test(contentType)) {
            return stop('unsupported');
          }
          const length = Number(upstream.headers['content-length'] ?? '0');
          if (!Number.isFinite(length) || length < 0 || length > maxBytes) return stop('too-large');
          const chunks: Buffer[] = [];
          let size = 0;
          upstream.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > maxBytes) return stop('too-large');
            chunks.push(chunk);
          });
          upstream.on('error', fail);
          upstream.on('end', () => {
            clearTimeout(timer);
            if (!size) return fail(new PhotoFetchError('unavailable'));
            const bytes = new Uint8Array(Buffer.concat(chunks, size));
            resolveResponse({
              ok: true, url: url.href, contentType, bytes,
              async json() { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; },
              async text() { return new TextDecoder().decode(bytes); },
            });
          });
        });
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      req.on('error', fail);
      req.end();
    });
  };
}

/** Bounded, non-redirecting, public-network-only reader for photo resources. */
export const fetchPublicPhotoResource = createPublicPhotoFetcher();
