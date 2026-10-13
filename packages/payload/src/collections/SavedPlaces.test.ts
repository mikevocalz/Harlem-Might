import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { Socket } from 'node:net';
import {
  buildConfig,
  createOperation,
  deleteByIDOperation,
  findByIDOperation,
  findOperation,
  updateByIDOperation,
} from 'payload';
import type { Collection, PayloadRequest, SelectType, Where } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { Members } from './Members.ts';
import { SavedPlaces } from './SavedPlaces.ts';

// Use the installed Payload sanitizer and operations, never init/getPayload or a
// real adapter connection. Unexpected database calls and transport fail closed.
// This covers the operation/adapter boundary, not real-cookie or SQL integration.
const forbidden = () => { throw new Error('Database/network access is forbidden in this offline regression'); };
mock.method(globalThis, 'fetch', forbidden);
mock.method(Socket.prototype, 'connect', forbidden);
after(() => mock.restoreAll());
const config = await buildConfig({
  secret: 'offline-saved-place-test-only',
  admin: { user: 'users' },
  db: postgresAdapter({ pool: {}, push: false }),
  collections: [
    { slug: 'users', auth: true, fields: [] },
    Members,
    SavedPlaces,
    { slug: 'media', fields: [] },
    { slug: 'places', access: { read: () => true }, fields: [] },
    { slug: 'default-protected', fields: [] },
  ],
});
const collections = Object.fromEntries(config.collections.map(collection => [collection.slug, { config: collection }])) as Record<string, Collection>;
const savedPlaces = collections['saved-places']!;
const owner = { id: 7, collection: 'members' };
const other = { id: 8, collection: 'members' };
// Deliberately overlap IDs across the curator/member identity collections.
const curator = { id: 7, collection: 'users' };
type User = typeof owner | null;
type Row = { id: number; member: number; place: number; createdAt?: string; updatedAt?: string };
type AdapterInput = { collection: string; where?: Where; id?: number; data?: Partial<Row> };
const initialRows: Row[] = [
  { id: 101, member: 7, place: 21 },
  { id: 102, member: 8, place: 22 },
];

// This fixture only interprets the exact query subset under test. Unsupported
// operators throw, and tests also assert Payload's emitted ownership predicate.
function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([field, condition]) => {
    if (field === 'and' || field === 'or') {
      assert.ok(Array.isArray(condition));
      return field === 'and'
        ? condition.every(item => matches(row, item))
        : condition.some(item => matches(row, item));
    }
    assert.ok(['id', 'member', 'place'].includes(field), `Unexpected query field: ${field}`);
    assert.ok(!Array.isArray(condition));
    assert.deepEqual(Object.keys(condition), ['equals']);
    return row[field as keyof Row] === condition.equals;
  });
}

function fixture(user: User, rows = initialRows) {
  const stored = new Map(rows.map(row => [row.id, structuredClone(row)]));
  const calls: { operation: string; where?: Where; data?: Partial<Row> }[] = [];
  const versions: { parent: number; version: Partial<Row> }[] = [];
  const housekeeping: string[] = [];
  const record = (operation: string, input: AdapterInput) => {
    assert.equal(input.collection, 'saved-places');
    calls.push({ operation, where: structuredClone(input.where), data: structuredClone(input.data) });
  };
  const db = new Proxy({
    name: 'offline-regression-fixture',
    defaultIDType: 'number',
    find: async (input: AdapterInput) => {
      record('find', input);
      const docs = [...stored.values()].filter(row => matches(row, input.where)).map(row => structuredClone(row));
      return { docs, totalDocs: docs.length, totalPages: 1, page: 1, pagingCounter: 1, hasNextPage: false, hasPrevPage: false, nextPage: null, prevPage: null, limit: 10 };
    },
    findOne: async (input: AdapterInput) => {
      record('findOne', input);
      return structuredClone([...stored.values()].find(row => matches(row, input.where)) ?? null);
    },
    create: async (input: AdapterInput) => {
      record('create', input);
      const row = { ...input.data, id: 103 } as Row;
      stored.set(row.id, row);
      return structuredClone(row);
    },
    updateOne: async (input: AdapterInput) => {
      record('updateOne', input);
      assert.ok(input.id && stored.has(input.id));
      const row = { ...stored.get(input.id), ...input.data } as Row;
      stored.set(input.id, row);
      return structuredClone(row);
    },
    createVersion: async (input: { collectionSlug: string; parent: number; versionData: Partial<Row> }) => {
      assert.equal(input.collectionSlug, 'saved-places');
      const version = { parent: input.parent, version: structuredClone(input.versionData) };
      versions.push(version);
      return structuredClone(version);
    },
    findVersions: async (input: AdapterInput & { page: number }) => {
      assert.equal(input.collection, 'saved-places');
      assert.equal(input.page, 101, 'only the default version-retention check is expected');
      housekeeping.push('findVersions');
      return { docs: [] };
    },
    deleteVersions: async (input: AdapterInput) => {
      assert.equal(input.collection, 'saved-places');
      assert.deepEqual(input.where, { parent: { equals: 101 } });
      housekeeping.push('deleteVersions');
    },
    deleteMany: async (input: AdapterInput) => {
      if (input.collection === 'payload-locked-documents') {
        assert.deepEqual(input.where, { and: [
          { 'document.relationTo': { equals: 'saved-places' } },
          { 'document.value': { equals: 101 } },
        ] });
      } else {
        assert.equal(input.collection, 'payload-preferences');
        assert.deepEqual(input.where, { key: { in: ['collection-saved-places-101'] } });
      }
      housekeeping.push(input.collection);
      return [];
    },
    deleteOne: async (input: AdapterInput) => {
      record('deleteOne', input);
      const row = [...stored.values()].find(candidate => matches(candidate, input.where));
      assert.ok(row);
      stored.delete(row.id);
      return structuredClone(row);
    },
  }, {
    get(target, key) {
      if (!(key in target)) throw new Error(`Unexpected database access: ${String(key)}`);
      return Reflect.get(target, key);
    },
  });
  const req = {
    user, context: {}, payloadAPI: 'REST', t: (key: string) => key,
    payload: { config, collections, db, logger: { error: forbidden } },
  } as unknown as PayloadRequest;
  const options = { collection: savedPlaces, req, depth: 0, overrideAccess: false, disableTransaction: true };
  return {
    req, calls, stored, versions, housekeeping,
    create: (data: Record<string, unknown>) => createOperation<'saved-places', SelectType>({ ...options, data } as Parameters<typeof createOperation<'saved-places', SelectType>>[0]),
    read: (where?: Where) => findOperation<'saved-places', SelectType>({ ...options, where }),
    readByID: (id: number) => findByIDOperation<'saved-places', false, SelectType>({ ...options, id }),
    update: (id: number, data: Record<string, unknown>) => updateByIDOperation<'saved-places'>({ ...options, id, data }),
    delete: (id: number) => deleteByIDOperation<'saved-places', SelectType>({ ...options, id }),
  };
}

const forbiddenAccess = (error: unknown) => {
  assert.ok(error instanceof Error);
  assert.equal((error as Error & { status: number }).status, 403);
  return true;
};

for (const [label, user] of [
  ['anonymous', null],
  ['curator with matching member ID', curator],
  ['unrelated identity collection', { id: 7, collection: 'other' }],
] as const) {
  test(`${label} cannot create, read, update or delete saved places`, async () => {
    const context = fixture(user);
    for (const operation of [
      () => context.create({ member: 7, place: 21 }),
      () => context.read(),
      () => context.readByID(101),
      () => context.update(101, { member: 7, place: 22 }),
      () => context.delete(101),
    ]) await assert.rejects(operation, forbiddenAccess);
    assert.deepEqual(context.calls, [], 'access rejection happens before any adapter I/O');
    assert.deepEqual(context.versions, []);
    assert.deepEqual(context.housekeeping, []);
    assert.deepEqual([...context.stored.values()], initialRows);
  });
}

for (const user of [owner, other]) {
  test(`member ${user.id} reads only their rows, even when supplying another owner filter`, async () => {
    const context = fixture(user);
    const result = await context.read();
    assert.deepEqual(result.docs.map(row => row.id), [user.id === 7 ? 101 : 102]);
    assert.deepEqual(context.calls[0]?.where, { and: [{ member: { equals: user.id } }] });
    const outsider = user.id === 7 ? 8 : 7;
    const filtered = await context.read({ member: { equals: outsider } });
    assert.deepEqual(filtered.docs, []);
    assert.deepEqual(context.calls[1]?.where, { and: [{ member: { equals: outsider } }, { member: { equals: user.id } }] });
  });
}

test('owner can read, update and delete their row through real operations', async () => {
  const context = fixture(owner);
  assert.equal((await context.readByID(101)).member, 7);
  const updated = await context.update(101, { place: 23 });
  assert.equal(updated.member, 7);
  assert.equal(updated.place, 23);
  const deleted = await context.delete(101);
  assert.equal(deleted.id, 101);
  assert.equal(context.stored.has(101), false);
  assert.deepEqual(context.stored.get(102), initialRows[1]);
  for (const call of context.calls.filter(call => call.operation === 'findOne')) {
    assert.deepEqual(call.where, { and: [{ id: { equals: 101 } }, { member: { equals: 7 } }] });
  }
});

test('other member cannot read, update or delete an existing owner row by ID', async () => {
  const context = fixture(other);
  await assert.rejects(() => context.readByID(101), { status: 404 });
  for (const operation of [
    () => context.update(101, { member: 8, place: 23 }),
    () => context.delete(101),
  ]) await assert.rejects(operation, forbiddenAccess);
  assert.equal(context.calls.length, 3);
  for (const call of context.calls) {
    assert.equal(call.operation, 'findOne');
    assert.deepEqual(call.where, { and: [{ id: { equals: 101 } }, { member: { equals: 8 } }] });
  }
  assert.deepEqual([...context.stored.values()], initialRows);
});

for (const [label, member] of [
  ['omitted', undefined], ['another member', 8], ['null', null], ['malformed', { forged: true }],
] as const) {
  test(`create stamps the request owner when the submitted member is ${label}`, async () => {
    const context = fixture(owner);
    const result = await context.create({ ...(member === undefined ? {} : { member }), place: 21 });
    assert.equal(result.member, 7);
    assert.equal(result.place, 21);
    assert.equal(context.stored.get(103)?.member, 7);
    assert.deepEqual(context.calls.map(call => call.operation), ['create']);
    assert.equal(context.calls[0]?.data?.member, 7);
    assert.equal(context.versions[0]?.version.member, 7);
  });
  test(`update cannot transfer ownership when the submitted member is ${label}`, async () => {
    const context = fixture(owner);
    const result = await context.update(101, { ...(member === undefined ? {} : { member }), place: 23 });
    assert.equal(result.member, 7);
    assert.equal(result.place, 23);
    assert.equal(context.stored.get(101)?.member, 7);
    assert.equal(context.versions[0]?.version.member, 7);
    assert.deepEqual(context.stored.get(102), initialRows[1]);
  });
}

test('owner injection does not bypass required place validation', async () => {
  const context = fixture(owner);
  await assert.rejects(() => context.create({ member: 8 }), error => {
    assert.equal((error as { status: number }).status, 400);
    assert.deepEqual((error as { data: { errors: { path: string }[] } }).data.errors.map(item => item.path), ['place']);
    return true;
  });
  assert.deepEqual(context.calls, []);
});

test('Payload 4 default access remains curator-only for an omitted access config', async () => {
  const collection = collections['default-protected']!.config;
  for (const operation of ['create', 'read', 'update', 'delete'] as const) {
    for (const user of [null, owner, curator]) {
      assert.equal(await collection.access[operation]({ req: fixture(user).req, slug: collection.slug }), user === curator);
    }
  }
});


test('the configured Better Auth member identity owns saves without a client-supplied owner', async () => {
  const auth = collections.members!.config.auth;
  assert.ok(auth && auth.strategies);
  const strategy = auth.strategies.find(item => item.name === 'better-auth');
  assert.ok(strategy);
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
  const context = fixture(result.user as User);
  const saved = await context.create({ place: 21 });
  assert.equal(saved.member, 7);
  assert.deepEqual((await context.read()).docs.map(row => row.id), [101, 103]);
});
