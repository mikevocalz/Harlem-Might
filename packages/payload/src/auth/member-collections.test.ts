import assert from 'node:assert/strict';
import test from 'node:test';
import { BasePayload, buildConfig } from 'payload';
import type { CollectionConfig, Field } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { betterAuthStrategy } from '@delmaredigital/payload-better-auth';
import { memberAuthCollections } from './member-collections.ts';

const identities: CollectionConfig[] = [
  { slug: 'users', auth: true, fields: [] },
  { slug: 'members', fields: [{ name: 'email', type: 'email', required: true, unique: true }] },
];

function field(collection: CollectionConfig, name: string): Field {
  const value = collection.fields.find(candidate => 'name' in candidate && candidate.name === name);
  assert.ok(value, `${collection.slug}.${name} is present`);
  return value;
}

test('generated credentials and sessions belong to members and retain their secret/access controls', async () => {
  const config = await memberAuthCollections()({ collections: identities,
    secret: 'offline-collection-test-only', db: postgresAdapter({ pool: {}, push: false }),
  });
  for (const slug of ['accounts', 'sessions']) {
    const collection = config.collections!.find(item => item.slug === slug)!;
    const user = field(collection, 'user');
    assert.equal(user.type, 'relationship');
    if (user.type !== 'relationship') throw new Error('Expected relationship');
    assert.equal(user.relationTo, 'members');
    assert.equal(user.required, true);
    const secret = field(collection, slug === 'accounts' ? 'password' : 'token');
    if (!('access' in secret)) throw new Error('Expected a protected secret');
    assert.equal(await secret.access!.read!({} as never), false);
    assert.equal(await secret.access!.create!({} as never), false);
    assert.equal(await secret.access!.update!({} as never), false);
    assert.equal(await collection.access!.create!({} as never), false);
    assert.equal(await collection.access!.update!({} as never), false);
  }
  assert.equal(config.collections!.find(item => item.slug === 'users'), identities[0]);
});

test('the real Payload 4 adapter generates member foreign keys including version mirrors', async () => {
  const config = await buildConfig({
    secret: 'offline-schema-test-only', admin: { user: 'users' },
    collections: identities,
    plugins: [memberAuthCollections()],
    db: postgresAdapter({ pool: {}, schemaName: 'payload', push: false }),
  });
  const payload = await new BasePayload().init({ config, disableDBConnect: true, disableOnInit: true });
  try {
    const schema = await payload.db.requireDrizzleKit().generateDrizzleJson(payload.db.schema);
    for (const [tableName, column] of [
      ['accounts', 'user_id'], ['sessions', 'user_id'],
      ['_accounts_v', 'version_user_id'], ['_sessions_v', 'version_user_id'],
    ]) {
      const table = schema.tables[`payload.${tableName}`];
      assert.ok(table, `${tableName} exists`);
      const foreignKey = Object.values(table.foreignKeys).find((key) =>
        (key as { columnsFrom: string[] }).columnsFrom.includes(column!)) as { tableTo: string } | undefined;
      assert.equal(foreignKey?.tableTo, 'members', `${tableName}.${column} references members`);
    }
  } finally { await payload.destroy(); }
});

test('the pinned auth strategy retains Payload 4 authentication metadata', async () => {
  const strategy = betterAuthStrategy({ usersCollection: 'members' });
  const result = await strategy.authenticate({
    headers: new Headers(), canSetHeaders: false,
    payload: {
      betterAuth: { api: { getSession: async () => ({
        response: { user: { id: '7' }, session: { id: '1', userId: '7' } }, headers: new Headers(),
      }) } },
      find: async (input: { collection: string }) => {
        assert.equal(input.collection, 'members');
        return { docs: [{ id: 7, email: 'member@example.test' }] };
      },
    },
  } as never);
  assert.equal(result.user?.collection, 'members');
  assert.equal(result.user?._strategy, 'better-auth');
});
