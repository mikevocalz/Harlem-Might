import assert from 'node:assert/strict';
import type { lookup } from 'node:dns';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire, registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { before, it, type TestContext } from 'node:test';
import type { CollectionConfig, PayloadRequest, SanitizedConfig } from 'payload';
import { downloadFileToBuffer } from 'payload/internal';
import { bunnyStorage } from '@seshuk/payload-storage-bunny';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK0sAAAAASUVORK5CYII=', 'base64');
const sourceRoot = new URL('../', import.meta.url).href;
const payloadModule = (relative: string) => import(new URL(relative, import.meta.resolve('payload')).href);
const { _internal_safeFetchGlobal } = await payloadModule('./uploads/safeFetch.js') as {
  _internal_safeFetchGlobal: { lookup: typeof lookup };
};
const { generateFileData } = await payloadModule('./uploads/generateFileData.js') as {
  generateFileData: (args: { collection: { config: CollectionConfig }; config: SanitizedConfig; data: Record<string, unknown>; operation: 'create'; overwriteExistingFiles: boolean; req: PayloadRequest }) => Promise<{ data: Record<string, unknown>; files: { buffer: Buffer; path: string }[] }>;
};
const { pasteURLHandler } = await payloadModule('./uploads/endpoints/pasteURL.js') as {
  pasteURLHandler: (req: PayloadRequest) => Promise<Response>;
};
// Resolve the transport belonging to the installed Payload, without adding a
// direct app dependency or substituting our own implementation of safeFetch.
const { Agent, MockAgent } = createRequire(import.meta.resolve('payload'))('undici');

async function applicationConfig(enabled: boolean, nodeEnv: string) {
  const fixtureEnv: Record<string, string | undefined> = {
    NODE_ENV: nodeEnv, DATABASE_URL: undefined, PAYLOAD_PUSH: 'false',
    PAYLOAD_SECRET: 'offline-storage-policy-test', BETTER_AUTH_SECRET: undefined,
    BUNNY_STORAGE_ACCESS_KEY: enabled ? 'offline-placeholder' : undefined,
    BUNNY_STORAGE_ZONE_NAME: 'offline-zone', BUNNY_STORAGE_REGION: undefined,
    BUNNY_MEDIA_PREFIX: 'harlem/', NEXT_PUBLIC_BUNNY_CDN_BASE_URL: 'https://cdn.example.invalid',
    NEXT_PUBLIC_SITE_URL: 'https://harlem.example.invalid', WEB_VITE_URL: undefined,
    PAYLOAD_MCP_ENABLED: 'false', BETTER_AUTH_TRUSTED_ORIGINS: undefined,
  };
  const previous = Object.fromEntries(Object.keys(fixtureEnv).map((key) => [key, process.env[key]]));
  // Native Node strips TS but not extensionless imports. Scope resolution and
  // module isolation to application source so every mode gets a fresh config.
  const resolver = registerHooks({ resolve(specifier, context, nextResolve) {
    const ts = specifier.startsWith('.') && context.parentURL?.startsWith(sourceRoot)
      ? new URL(`${specifier}.ts`, context.parentURL) : undefined;
    const resolved = nextResolve(ts && existsSync(ts) ? ts.href : specifier, context);
    if (!resolved.url.startsWith(sourceRoot)) return resolved;
    const url = new URL(resolved.url);
    url.searchParams.set('storage-test', `${enabled}-${nodeEnv}`);
    return { ...resolved, url: url.href };
  } });
  try {
    for (const [key, value] of Object.entries(fixtureEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    // Runs the actual application plugins and Payload 4 sanitizer. Deliberately
    // never calls Payload.init, adapter.init/connect, onInit, or a storage write.
    const { default: config } = await import(new URL('../payload.config.ts', import.meta.url).href) as { default: Promise<SanitizedConfig> };
    return await config;
  } finally {
    resolver.deregister();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const modes: { enabled: boolean; nodeEnv: string; config: SanitizedConfig }[] = [];
before(async () => {
  for (const enabled of [false, true]) for (const nodeEnv of ['production', 'development']) {
    modes.push({ enabled, nodeEnv, config: await applicationConfig(enabled, nodeEnv) });
  }
});
const mediaOf = (config: SanitizedConfig) => config.collections.find(({ slug }) => slug === 'media')!;
function request(config: SanitizedConfig, identity: 'members' | 'users' = 'users', url = 'https://harlem.example.invalid/payload-api/media') {
  const req = {
    user: { id: 1, collection: identity }, context: {}, query: {},
    headers: new Headers(), routeParams: { collection: 'media' },
    url, t: (key: string) => key,
    payload: {
      config, collections: { media: { config: mediaOf(config) } },
      logger: { error() {} }, db: { findOne: async () => null },
    },
  } as unknown as PayloadRequest;
  return req;
}
function rejectUnsafeFetch(t: TestContext) {
  return t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unsafe global fetch must not be called'); });
}
const remoteFile = (config: SanitizedConfig, url: string) => downloadFileToBuffer({
  data: { filename: 'avatar.png', url }, req: request(config), uploadConfig: mediaOf(config).upload,
});

it('restores safe fetch after the pinned Bunny plugin and the full Payload 4 sanitizer, in every mode', async () => {
  const raw = await bunnyStorage({
    collections: { media: { prefix: 'harlem', disablePayloadAccessControl: true } },
    storage: { apiKey: 'offline-placeholder', hostname: 'cdn.example.invalid', zoneName: 'offline-zone' },
  })({ collections: [{ slug: 'media', fields: [], upload: true }] } as never);
  // A canary bump that changes this behavior should trigger a deliberate review
  // of this compatibility boundary rather than leaving an obsolete workaround.
  const rawUpload = raw.collections![0]!.upload;
  assert.ok(rawUpload && typeof rawUpload === 'object');
  assert.equal(rawUpload.skipSafeFetch, true);
  for (const { enabled, nodeEnv, config } of modes) {
    const media = mediaOf(config);
    assert.equal(media.upload.skipSafeFetch, enabled ? false : undefined, `${enabled}/${nodeEnv}`);
    assert.equal(media.upload.pasteURL, undefined);
    assert.equal(media.upload.adapter, enabled ? 'bunny' : undefined);
    assert.equal(Boolean(media.upload.disableLocalStorage), enabled);
    assert.equal(media.upload.bulkUpload, true);
    if (enabled) assert.deepEqual(media.upload.handlers, []);
    assert.equal(config.db.name, 'postgres');
  }
});

it('rejects private and encoded IP targets before any insecure fetch, with Bunny enabled or absent', async (t) => {
  const unsafe = rejectUnsafeFetch(t);
  for (const { config } of modes) for (const host of [
    '127.0.0.1', '10.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.0.1',
    '2130706433', '0x7f000001', '127.1', '[::1]', '[fd00::1]', '[::ffff:127.0.0.1]',
  ]) await assert.rejects(remoteFile(config, `http://${host}/avatar.png`), /private or internal address/);
  for (const { config } of modes) {
    await assert.rejects(remoteFile(config, 'file:///etc/passwd'), /HTTP or HTTPS/);
  }
  assert.equal(unsafe.mock.callCount(), 0);
});

it('rejects private DNS and mixed public/private DNS answers using Payload’s real safe-fetch lookup', async (t) => {
  const unsafe = rejectUnsafeFetch(t);
  let answers = [{ address: '127.0.0.1', family: 4 }];
  const dns = t.mock.method(_internal_safeFetchGlobal, 'lookup', ((_hostname: string, options: { all?: boolean }, callback: (error: null, values: typeof answers) => void) => {
    assert.equal(options.all, true);
    // Only unsafe answers reach the real dispatcher, so no socket is opened.
    callback(null, answers);
  }) as typeof lookup);
  for (const { config } of modes) for (const records of [
    [{ address: '127.0.0.1', family: 4 }],
    [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }],
    [{ address: 'fd00::1', family: 6 }],
  ]) {
    answers = records;
    await assert.rejects(remoteFile(config, 'http://private.example.invalid/avatar.png'), /private or internal address/);
  }
  assert.equal(dns.mock.callCount(), modes.length * 3);
  assert.equal(unsafe.mock.callCount(), 0);
});

it('keeps public CDN reads and redirects working, but rechecks private redirect targets', async (t) => {
  const unsafe = rejectUnsafeFetch(t);
  const transport = new MockAgent();
  transport.disableNetConnect();
  t.after(() => transport.close());
  // Only replace the public response transport. The real downloadFileToBuffer,
  // fetchWithRedirects and safeFetch still select and validate every URL.
  const dispatch = Agent.prototype.dispatch;
  let safeDispatcher: object;
  const dns = t.mock.method(_internal_safeFetchGlobal, 'lookup', ((_hostname: string, options: { all?: boolean }, callback: (error: null, values: { address: string; family: number }[]) => void) => {
    assert.equal(options.all, true);
    callback(null, [{ address: '10.0.0.1', family: 4 }]);
  }) as typeof lookup);
  t.mock.method(Agent.prototype, 'dispatch', function (this: object, options: { origin: string | URL }, handler: unknown) {
    safeDispatcher ??= this;
    if (String(options.origin) === 'https://private.example.invalid') return dispatch.call(this, options, handler);
    return this === safeDispatcher ? transport.dispatch(options, handler) : dispatch.call(this, options, handler);
  });
  const origin = 'https://cdn.example.invalid';
  const pool = transport.get(origin);
  const headers = { 'content-type': 'image/png', 'content-length': String(png.length) };
  for (const { config } of modes) {
    pool.intercept({ path: '/harlem/avatar.png' }).reply(200, png, { headers });
    assert.deepEqual((await remoteFile(config, `${origin}/harlem/avatar.png`)).data, png);
    pool.intercept({ path: '/harlem/redirect.png' }).reply(302, '', { headers: { location: '/harlem/avatar.png' } });
    pool.intercept({ path: '/harlem/avatar.png' }).reply(200, png, { headers });
    assert.deepEqual((await remoteFile(config, `${origin}/harlem/redirect.png`)).data, png);
    pool.intercept({ path: '/harlem/unsafe.png' }).reply(302, '', { headers: { location: 'http://169.254.169.254/credentials' } });
    await assert.rejects(remoteFile(config, `${origin}/harlem/unsafe.png`), /private or internal address/);
    pool.intercept({ path: '/harlem/unsafe-dns.png' }).reply(302, '', { headers: { location: 'https://private.example.invalid/avatar.png' } });
    await assert.rejects(remoteFile(config, `${origin}/harlem/unsafe-dns.png`), /private or internal address/);
  }
  transport.assertNoPendingInterceptors();
  assert.equal(dns.mock.callCount(), modes.length);
  assert.equal(unsafe.mock.callCount(), 0);
});

it('preserves member PNG processing and curator permissions without allowing member-supplied URLs or metadata', async (t) => {
  const unsafe = rejectUnsafeFetch(t);
  for (const { config } of modes) {
    const media = mediaOf(config);
    const req = request(config, 'members');
    req.file = { name: 'avatar.png', mimetype: 'image/png', data: png, size: png.length };
    assert.equal(await media.access.create({ req, slug: 'media' }), true);
    assert.equal(await media.access.update({ req, slug: 'media' }), false);
    assert.equal(await media.access.delete({ req, slug: 'media' }), false);
    const input = { alt: 'Avatar', url: 'http://169.254.169.254/', filename: 'fake.png', prefix: 'other', source: 'nypl' };
    const hook = media.hooks.beforeOperation[0]!;
    const args = await hook({ req, operation: 'create', args: { data: input }, collection: media } as never) as { data: Record<string, unknown> };
    assert.deepEqual(args.data, { alt: 'Avatar' });
    const dir = await mkdtemp(path.join(tmpdir(), 'harlem-avatar-test-'));
    try {
      const generated = await generateFileData({
        collection: { config: { ...media, upload: { ...media.upload, staticDir: dir } } },
        config, data: args.data, operation: 'create', overwriteExistingFiles: true, req,
      });
      assert.equal(generated.data.mimeType, 'image/png');
      assert.equal(generated.data.width, 1);
      assert.equal(generated.data.height, 1);
      for (const validate of media.hooks.beforeValidate) {
        await validate({ data: generated.data, req, operation: 'create', collection: media } as never);
      }
      assert.deepEqual(generated.files[0]!.buffer, png);
    } finally { await rm(dir, { recursive: true, force: true }); }
    req.file = undefined;
    assert.equal(await media.access.create({ req, slug: 'media' }), false);
    const curator = request(config);
    for (const access of [media.access.create, media.access.update, media.access.delete]) {
      assert.equal(await access({ req: curator, slug: 'media' }), true);
    }
  }
  assert.equal(unsafe.mock.callCount(), 0);
});

it('preserves Bunny CDN URLs under the configured prefix without adding a URL-upload allowlist', async (t) => {
  const unsafe = rejectUnsafeFetch(t);
  for (const { config, enabled } of modes) {
    const media = mediaOf(config);
    if (enabled) {
      const urlField = media.fields.find((field) => 'name' in field && field.name === 'url');
      assert.ok(urlField && 'hooks' in urlField);
      let value: unknown;
      for (const hook of urlField.hooks?.afterRead ?? []) {
        value = await hook({ value, data: { filename: 'avatar.png', prefix: 'harlem' }, req: request(config), collection: media } as never);
      }
      assert.equal(value, 'https://cdn.example.invalid/harlem/avatar.png');
    }
    for (const identity of ['members', 'users'] as const) for (const source of [
      'https://arbitrary.example.invalid/avatar.png', 'http://127.0.0.1/private',
    ]) {
      const req = request(config, identity, `https://harlem.example.invalid/payload-api/media/paste-url?src=${encodeURIComponent(source)}`);
      await assert.rejects(pasteURLHandler(req), identity === 'members' ? { status: 403 } : /require upload.pasteURL.allowList/);
    }
  }
  assert.equal(unsafe.mock.callCount(), 0);
});
