import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beforeValidateTraverseFields, buildConfig } from 'payload';
import type { BasePayload, Field, PayloadRequest } from 'payload';
import { payloadAdapter } from '@delmaredigital/payload-better-auth';
import { betterAuthOptions } from '../auth/options.ts';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { Pages } from '../collections/Pages.ts';
import { Members } from '../collections/Members.ts';

const config = await buildConfig({
  secret: 'offline-access-test-only', admin: { user: 'users' },
  collections: [{ slug: 'users', auth: true, fields: [] }, Pages, Members, { slug: 'media', fields: [] }],
  db: postgresAdapter({ pool: {}, push: false }),
});
const pages = config.collections.find((collection) => collection.slug === 'pages')!;
const members = config.collections.find((collection) => collection.slug === 'members')!;
const request = (user: unknown) => ({ user, context: {}, payload: { config }, t: (key: string) => key }) as unknown as PayloadRequest;
const member = { id: 7, collection: 'members' };
const curator = { id: 1, collection: 'users' };

for (const user of [null, member, { id: 2, collection: 'other' }]) {
  test(`non-curator ${user?.collection ?? 'anonymous'} can read only published pages`, async () => {
    assert.deepEqual(await pages.access.read({ req: request(user), slug: 'pages' }), { published: { equals: true } });
    for (const operation of ['create', 'update', 'delete'] as const) {
      assert.equal(await pages.access[operation]({ req: request(user), slug: 'pages' }), false);
    }
  });
}

test('curators retain draft reads and editorial writes, while new pages default to unpublished', async () => {
  for (const operation of ['read', 'create', 'update', 'delete'] as const) {
    assert.equal(await pages.access[operation]({ req: request(curator), slug: 'pages' }), true);
  }
  const published = pages.fields.find((field) => 'name' in field && field.name === 'published');
  assert.ok(published && published.type === 'checkbox');
  assert.equal(published.defaultValue, false);
});

const fields = members.fields.filter((field) => 'name' in field && ['email', 'emailVerified', 'name', 'avatar', 'preferences'].includes(field.name));
const previous = { email: 'original@example.test', emailVerified: false, name: 'Original', avatar: null as number | null, preferences: { reducedMotion: false } };
const changes = (): typeof previous => ({ email: 'changed@example.test', emailVerified: true, name: 'Updated', avatar: 9, preferences: { reducedMotion: true } });
async function processedUpdate(overrideAccess: boolean) {
  const data = changes();
  await beforeValidateTraverseFields({
    collection: members, context: {}, data, doc: previous, fields: fields as Field[], global: null,
    operation: 'update', overrideAccess, parentIndexPath: '', parentPath: '', parentSchemaPath: '',
    req: request(member), siblingData: data, siblingDoc: previous,
  });
  return data;
}

test('real Payload field access rejects direct identity changes without blocking profile edits', async () => {
  const data = await processedUpdate(false);
  assert.equal(data.email, previous.email);
  assert.equal(data.emailVerified, previous.emailVerified);
  assert.equal(data.name, 'Updated');
  assert.equal(data.avatar, 9);
  assert.deepEqual(data.preferences, { reducedMotion: true, stepFreeDefault: false });
});

test('trusted Better Auth override writes can still change identity fields', async () => {
  const data = await processedUpdate(true);
  assert.equal(data.email, 'changed@example.test');
  assert.equal(data.emailVerified, true);
});

test('identity fields cannot be supplied to a direct REST create operation', async () => {
  for (const name of ['email', 'emailVerified']) {
    const field = fields.find((field) => 'name' in field && field.name === name)!;
    assert.ok('access' in field && field.access?.create);
    assert.equal(await field.access.create({ req: request(member) } as never), false);
  }
  assert.equal(await members.access.create({ req: request(null), slug: 'members' }), false);
});


test('the installed Better Auth adapter uses trusted member identity writes', async () => {
  let updates = 0;
  const payload = {
    config,
    db: { name: 'postgres' },
    update: async (input: { collection: string; id: number; overrideAccess: boolean; data: Record<string, unknown> }) => {
      updates++;
      assert.equal(input.collection, 'members');
      assert.equal(input.id, 7);
      assert.equal(input.overrideAccess, true);
      assert.equal(input.data.email, 'changed@example.test');
      assert.equal(input.data.emailVerified, true);
      const data = await processedUpdate(input.overrideAccess);
      return { id: 7, ...data };
    },
  } as unknown as BasePayload;
  const adapter = payloadAdapter({ payloadClient: payload, adapterConfig: { dbType: 'postgres' } })(betterAuthOptions);
  const result = await adapter.update<{ email: string; emailVerified: boolean }>({
    model: 'user', where: [{ field: 'id', value: '7' }],
    update: { email: 'changed@example.test', emailVerified: true },
  });
  assert.equal(updates, 1);
  assert.equal(result?.email, 'changed@example.test');
  assert.equal(result?.emailVerified, true);
});

test('member profile access still restricts direct updates to the current member', async () => {
  assert.deepEqual(await members.access.update({ req: request(member), slug: 'members' }), { id: { equals: 7 } });
  assert.equal(await members.access.update({ req: request(null), slug: 'members' }), false);
  assert.equal(await members.access.update({ req: request(curator), slug: 'members' }), false);
});
