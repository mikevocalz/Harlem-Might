import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { CollectionAfterChangeHook, Config, PayloadRequest, Plugin } from 'payload';
import { bunnyStorage } from '@seshuk/payload-storage-bunny';
import { withMemberAvatarStorage } from './member-avatar-storage.ts';

// Check the installed cloud-storage orchestration with a local adapter, without
// sending bytes to Bunny, invoking an onInit hook, or connecting to a database.
const { getAfterChangeHook } = await import(new URL('./hooks/afterChange.js', import.meta.resolve('@payloadcms/plugin-cloud-storage')).href) as {
  getAfterChangeHook: (args: unknown) => CollectionAfterChangeHook;
};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK0sAAAAASUVORK5CYII=', 'base64');
const media = { slug: 'media', fields: [], upload: true };
const config = { collections: [media] } as unknown as Config;
const document = (id: number) => ({ id, alt: 'Avatar', filename: `avatar-${id}.png`, mimeType: 'image/png', width: 1, height: 1, filesize: png.length });
function request(collection = 'members') {
  const writes: unknown[] = [];
  const req = {
    user: { collection, id: 10 }, context: {},
    file: { data: png, size: png.length, name: 'avatar.png', mimetype: 'image/png' },
    payload: {
      logger: { error() {} },
      update: async (options: unknown) => {
        writes.push(options);
        if (collection !== 'users') throw new Error('Forbidden');
        return (options as { data: unknown }).data;
      },
    },
  } as unknown as PayloadRequest;
  return { req, writes };
}
const args = (req: PayloadRequest, id = 1) => ({ req, doc: document(id), data: {}, operation: 'create', collection: media }) as unknown as Parameters<CollectionAfterChangeHook>[0];
async function wrapped(hook: CollectionAfterChangeHook) {
  const plugin: Plugin = (input) => ({ ...input, collections: [{ ...media, hooks: { afterChange: [hook] } }] });
  return (await withMemberAvatarStorage(plugin)(config)).collections![0]!.hooks!.afterChange![0]!;
}
function storageHook(upload: (data: Record<string, unknown>) => Promise<unknown>) {
  return getAfterChangeHook({ collection: media, adapter: { handleUpload: ({ data }: { data: Record<string, unknown> }) => upload(data) } });
}
const bunnyRasterMetadata = async (data: Record<string, unknown>) => {
  data.bunnyData = { stream: { videoId: null } };
  return data;
};

it('completes the installed storage metadata stage for a new member PNG without granting edit access', async () => {
  const plain = request();
  await assert.rejects(async () => storageHook(bunnyRasterMetadata)(args(plain.req)), /Forbidden/);
  const { req, writes } = request();
  const originalPayload = req.payload;
  const originalUpdate = req.payload.update;
  const result = await (await wrapped(storageHook(bunnyRasterMetadata)))(args(req));
  assert.equal(result.id, 1);
  assert.equal(result.filename, 'avatar-1.png');
  assert.equal(writes.length, 0);
  assert.equal(req.payload, originalPayload);
  assert.equal(req.payload.update, originalUpdate);
  assert.equal(req.context.skipCloudStorage, undefined);
  await assert.rejects(req.payload.update({ collection: 'media', id: 1, data: { alt: 'Changed' }, req }), /Forbidden/);
});

it('does not suppress changed fields or unexpected storage metadata', async () => {
  for (const change of [
    { alt: 'Changed' }, { prefix: 'another-path' }, { source: 'wikimedia_commons' },
    { bunnyData: { stream: { videoId: 'video' } } },
    { bunnyData: { stream: { videoId: null }, extra: true } },
  ]) {
    const { req, writes } = request();
    const hook = await wrapped(storageHook(async (data) => Object.assign(data, change)));
    await assert.rejects(async () => hook(args(req)), /Forbidden/);
    assert.equal(writes.length, 1);
    assert.equal((writes[0] as { overrideAccess?: boolean }).overrideAccess, undefined);
  }
});

it('forwards other IDs, collections, external requests, and non-storage updates with normal access', async () => {
  for (const variant of ['id', 'collection', 'request', 'context']) {
    const { req, writes } = request();
    const hook = await wrapped(async ({ req: localReq, doc }) => {
      localReq.context.skipCloudStorage = variant !== 'context';
      await localReq.payload.update({
        collection: variant === 'collection' ? 'members' : 'media',
        id: variant === 'id' ? 2 : doc.id,
        data: doc,
        req: variant === 'request' ? req : localReq,
      });
      return doc;
    });
    await assert.rejects(async () => hook(args(req)), /Forbidden/);
    assert.equal(writes.length, 1);
  }
});

it('preserves curator metadata writes and existing application hooks', async () => {
  const { req, writes } = request('users');
  await (await wrapped(storageHook(bunnyRasterMetadata)))(args(req));
  assert.equal(writes.length, 1);
  let observed: PayloadRequest | undefined;
  const existing: CollectionAfterChangeHook = ({ req, doc }) => { observed = req; return doc; };
  const input = { ...config, collections: [{ ...media, hooks: { afterChange: [existing] } }] };
  const plugin: Plugin = (value) => value;
  const unchanged = (await withMemberAvatarStorage(plugin)(input)).collections![0]!.hooks!.afterChange![0]!;
  assert.equal(unchanged, existing);
  await unchanged(args(req));
  assert.equal(observed, req);
});

it('keeps concurrent member requests and document snapshots isolated', async () => {
  const pending: (() => void)[] = [];
  const hook = await wrapped(storageHook(async (data) => {
    await new Promise<void>((resolve) => pending.push(resolve));
    return bunnyRasterMetadata(data);
  }));
  const first = request();
  const second = request();
  const firstResult = hook(args(first.req, 1));
  const secondResult = hook(args(second.req, 2));
  assert.equal(pending.length, 2);
  pending[1]!();
  assert.equal((await secondResult).id, 2);
  pending[0]!();
  assert.equal((await firstResult).id, 1);
  assert.deepEqual(first.writes, []);
  assert.deepEqual(second.writes, []);
  assert.equal(first.req.context.skipCloudStorage, undefined);
  assert.equal(second.req.context.skipCloudStorage, undefined);
});

it('wraps only the configured Bunny storage hooks and preserves curator edit access', async () => {
  const access = { update: () => false };
  const configured = await withMemberAvatarStorage(bunnyStorage({
    collections: { media: { prefix: 'harlem', disablePayloadAccessControl: true } },
    storage: { apiKey: 'unit-test-placeholder', hostname: 'example.invalid', zoneName: 'test' },
  }))({ ...config, collections: [{ ...media, access }] });
  const collection = configured.collections!.find(({ slug }) => slug === 'media')!;
  assert.equal(collection.access?.update, access.update);
  assert.equal(collection.fields.some((field) => 'name' in field && field.name === 'bunnyData'), false);
  assert.equal(collection.hooks?.afterChange?.length, 2);
});
