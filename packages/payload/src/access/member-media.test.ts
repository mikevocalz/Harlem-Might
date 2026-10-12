import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { PayloadRequest } from 'payload';
import { curatorOnly } from './editorial.ts';
import { memberMediaCreate, stripMemberMediaMetadata, validateMemberMedia } from './member-media.ts';

const member = { id: 1, collection: 'members' };
const curator = { id: 2, collection: 'users' };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK0sAAAAASUVORK5CYII=', 'base64');
const file = (data = png, mimetype = 'image/png') => ({ data, size: data.length, name: 'avatar.png', mimetype });
const request = (user: unknown, upload?: ReturnType<typeof file>) => ({
  user, file: upload, query: {}, context: {}, t: (key: string) => key,
  payload: { config: { upload: {}, routes: { api: '/payload-api' } }, logger: { warn() {}, error() {} } },
}) as unknown as PayloadRequest;
const create = (req: PayloadRequest) => memberMediaCreate({ req, slug: 'media' });
const validate = (req: PayloadRequest, data: Record<string, unknown>) => validateMemberMedia({ req, data, operation: 'create' } as Parameters<typeof validateMemberMedia>[0]);

it('keeps curator uploads and media writes while denying anonymous and member editorial writes', async () => {
  assert.equal(await create(request(curator)), true);
  assert.equal(await create(request(curator, file(Buffer.from('editorial document'), 'application/pdf'))), true);
  assert.equal(await create(request(null, file())), false);
  assert.equal(await create(request({ collection: 'other' }, file())), false);
  for (const user of [member, null]) assert.equal(await curatorOnly({ req: request(user), slug: 'media' }), false);
  assert.equal(await curatorOnly({ req: request(curator), slug: 'media' }), true);
});

it('requires a member raster upload rather than metadata, SVG, documents, or empty files', async () => {
  assert.equal(await create(request(member, file())), true);
  assert.equal(await create(request(member)), false);
  for (const mime of ['image/svg+xml', 'text/html', 'application/pdf', 'application/octet-stream']) {
    assert.equal(await create(request(member, file(Buffer.from('not an avatar'), mime))), false);
  }
  assert.equal(await create(request(member, file(Buffer.alloc(0)))), false);
});

// Exercise the pinned Payload byte-detection/probe stage used before the public
// collection hook. Production imports only public APIs; this test intentionally
// checks the installed implementation ordering without a database or storage I/O.
const { generateFileData } = await import(new URL('./uploads/generateFileData.js', import.meta.resolve('payload')).href) as {
  generateFileData: (args: unknown) => Promise<{ data: Record<string, unknown> }>;
};
async function generated(req: PayloadRequest) {
  const args = await stripMemberMediaMetadata({
    req, operation: 'create', args: { data: { width: 100, height: 100, mimeType: 'image/png', alt: 'Avatar' } },
  } as unknown as Parameters<typeof stripMemberMediaMetadata>[0]) as { data: Record<string, unknown> };
  assert.equal(args.data.width, undefined);
  assert.equal(args.data.height, undefined);
  return (await generateFileData({
    collection: { config: { slug: 'media', upload: { disableLocalStorage: true, staticDir: '/unused-avatar-test' } } },
    req, data: args.data, operation: 'create', overwriteExistingFiles: true,
  })).data;
}

it('accepts an actual PNG after Payload detects bytes and probes dimensions', async () => {
  const req = request(member, file());
  const data = await generated(req);
  assert.equal(data.mimeType, 'image/png');
  assert.equal(data.width, 1);
  assert.equal(data.height, 1);
  assert.equal(await validate(req, data), data);
});

for (const [name, bytes] of [
  ['text', Buffer.from('not an image')],
  ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>')],
  ['PDF', Buffer.from('%PDF-1.7\nnot an avatar\n%%EOF')],
  ['embedded SVG in arbitrary text', Buffer.from('arbitrary text before <svg width="1" height="1"></svg>')],
  ['embedded SVG in a comment', Buffer.from('<!-- <svg width="1" height="1"> -->not XML')],
] as const) {
  it(`rejects ${name} bytes labelled image/png even with forged dimensions`, async () => {
    const req = request(member, file(bytes));
    // Neither a claimed MIME nor forged dimensions can establish raster bytes.
    assert.equal(await create(req), false);
    const data = await generated(req);
    await assert.rejects(async () => validate(req, data), /valid JPEG/);
  });
}

it('leaves curator metadata and non-photo validation behavior unchanged', async () => {
  const req = request(curator, file(Buffer.from('document'), 'application/pdf'));
  const data = { mimeType: 'application/pdf' };
  assert.equal(await validate(req, data), data);
});


it('members cannot attach editorial provenance or storage destinations to avatar creates', async () => {
  const req = request(member, file());
  const input = { alt: 'My avatar', role: 'hero', source: 'wikimedia_commons', license: 'Public domain', sourceUrl: 'https://example.invalid', credit: 'Forged', prefix: 'editorial', width: 100, height: 100 };
  const args = await stripMemberMediaMetadata({ req, operation: 'create', args: { data: input } } as unknown as Parameters<typeof stripMemberMediaMetadata>[0]) as { data: unknown };
  assert.deepEqual(args.data, { alt: 'My avatar' });
  const curatorArgs = await stripMemberMediaMetadata({ req: request(curator), operation: 'create', args: { data: input } } as unknown as Parameters<typeof stripMemberMediaMetadata>[0]) as { data: unknown };
  assert.deepEqual(curatorArgs.data, input);
});
