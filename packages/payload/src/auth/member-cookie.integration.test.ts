import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Socket } from 'node:net';
import { after, mock, test } from 'node:test';
import { betterAuth } from 'better-auth';
import { createBetterAuthPlugin, payloadAdapter } from '@delmaredigital/payload-better-auth';
import { buildConfig, getPayload, handleEndpoints } from 'payload';
import type { DatabaseAdapter, Where } from 'payload';
import { Members } from '../collections/Members.ts';
import { SavedPlaces } from '../collections/SavedPlaces.ts';
import { Users } from '../collections/Users.ts';
import { AUTH_BASE_PATH, PAYLOAD_API_ROUTE, betterAuthOptions } from './options.ts';
import { memberAuthCollections } from './member-collections.ts';

// Offline request integration against the pinned Better Auth 1.7.7, Payload 4,
// and payload-better-auth implementations. Keep signing, getSession, the plugin
// endpoint proxy, payloadAdapter, Payload auth strategies and REST operations real.
// Only the final DB interface is replaced. This is not SQL/transport/browser QA.
// Contracts inspected: Payload createPayloadRequestFromWebRequest/handleEndpoints;
// payload-better-auth src/plugin/index.ts and src/adapter/index.ts; Better Auth
// dist/api/routes/{sign-up,session,sign-out}.mjs and dist/cookies/index.mjs.
// getPayload otherwise tries a development HMR WebSocket even with DB disabled.
const previousHMR = process.env.DISABLE_PAYLOAD_HMR;
process.env.DISABLE_PAYLOAD_HMR = 'true';
const forbiddenAttempts: string[] = [];
const forbidden = () => {
  forbiddenAttempts.push('network, database connection or email attempted');
  throw new Error('Network, database connections and email are forbidden in offline cookie integration');
};
mock.method(globalThis, 'fetch', forbidden);
mock.method(Socket.prototype, 'connect', forbidden);
after(() => {
  try { assert.deepEqual(forbiddenAttempts, [], 'forbidden I/O must fail even if a library catches its error'); }
  finally {
    mock.restoreAll();
    if (previousHMR === undefined) delete process.env.DISABLE_PAYLOAD_HMR;
    else process.env.DISABLE_PAYLOAD_HMR = previousHMR;
  }
});

const origin = 'http://harlem-cookie.test';
const authPath = `${PAYLOAD_API_ROUTE}${AUTH_BASE_PATH}`;
type Row = Record<string, unknown> & { id: number };
type Input = { collection: string; where?: Where; id?: number | string; data?: Record<string, unknown>; limit?: number; page?: number };
type Call = { operation: string; collection: string; where?: Where; data?: Record<string, unknown> };
const allowedFields: Record<string, string[]> = {
  members: ['id', 'email'], users: ['id', 'email'], accounts: ['id', 'user', 'providerId', 'accountId'],
  sessions: ['id', 'token', 'user'], 'saved-places': ['id', 'member', 'place'], places: ['id'],
  'payload-locked-documents': ['document.relationTo', 'document.value'], 'payload-preferences': ['key'],
};

function memoryDatabase() {
  const rows = new Map(Object.keys(allowedFields).map(slug => [slug, new Map<number, Row>()]));
  rows.get('places')!.set(21, { id: 21 });
  rows.get('places')!.set(22, { id: 22 });
  const calls: Call[] = [];
  const violations: string[] = [];
  const versions: { collection: string; parent: number; version: Record<string, unknown> }[] = [];
  const fail = (message: string): never => { violations.push(message); throw new Error(message); };
  function validateWhere(collection: string, where: Where = {}) {
    for (const [field, condition] of Object.entries(where)) {
      if (field === 'and' || field === 'or') {
        if (!Array.isArray(condition)) fail(`Malformed ${field} predicate`);
        for (const child of condition as Where[]) validateWhere(collection, child);
        continue;
      }
      if (!allowedFields[collection]?.includes(field)) fail(`Unsupported ${collection} query field ${field}`);
      if (!condition || Array.isArray(condition) || typeof condition !== 'object') return fail('Malformed field predicate');
      const operator = Object.keys(condition).join(',');
      if (operator === 'in' && ['id', 'document.value', 'key'].includes(field) && Array.isArray(condition.in)) continue;
      if (operator !== 'equals') fail(`Unsupported query operator for ${collection}.${field}`);
    }
  }
  function matches(collection: string, row: Row, where: Where = {}): boolean {
    return Object.entries(where).every(([field, condition]) => {
      if (field === 'and' || field === 'or') {
        assert.ok(Array.isArray(condition));
        return field === 'and' ? condition.every(item => matches(collection, row, item)) : condition.some(item => matches(collection, row, item));
      }
      assert.ok(!Array.isArray(condition));
      if ('in' in condition) {
        assert.ok(Array.isArray(condition.in));
        return condition.in.includes(row[field]);
      }
      // Payload's numeric adapter receives string ID predicates from HTTP and
      // Better Auth. Model only SERIAL equality, never permissive loose equality.
      const value = condition.equals;
      return typeof row[field] === 'number' && typeof value === 'string' && /^\d+$/.test(value)
        ? row[field] === Number(value) : row[field] === value;
    });
  }
  function select(operation: string, input: Input) {
    validateWhere(input.collection, input.where);
    const table = rows.get(input.collection);
    if (!table) return fail(`Unsupported collection ${input.collection}`);
    calls.push({ operation, collection: input.collection, where: structuredClone(input.where), data: structuredClone(input.data) });
    return [...table.values()].filter(row => matches(input.collection, row, input.where));
  }
  const guardedMethods = new Map<PropertyKey, (...args: unknown[]) => Promise<unknown>>();
  const adapter = new Proxy({
    name: 'offline-cookie-fixture', defaultIDType: 'number', packageName: 'offline-test-only',
    init: undefined, connect: forbidden,
    destroy: async () => {
      // Synthetic password hashes, tokens and secrets are never persisted.
      for (const table of rows.values()) table.clear();
      versions.length = 0;
      calls.length = 0;
    },
    beginTransaction: async () => null,
    bulkOperationsSingleTransaction: false,
    find: async (input: Input) => {
      const docs = select('find', input);
      const limit = input.limit || docs.length || 10;
      return { docs: structuredClone(docs.slice(0, limit)), totalDocs: docs.length, totalPages: 1, page: 1,
        pagingCounter: 1, hasNextPage: false, hasPrevPage: false, nextPage: null, prevPage: null, limit };
    },
    findOne: async (input: Input) => structuredClone(select('findOne', input)[0] ?? null),
    create: async (input: Input) => {
      select('create', input);
      const table = rows.get(input.collection)!;
      const id = Math.max(0, ...table.keys()) + 1;
      const row = { ...structuredClone(input.data), id };
      table.set(id, row);
      return structuredClone(row);
    },
    updateOne: async (input: Input) => {
      const candidates = select('updateOne', input);
      const row = input.id === undefined ? candidates[0] : rows.get(input.collection)!.get(Number(input.id));
      assert.ok(row);
      const updated = { ...row, ...structuredClone(input.data) };
      rows.get(input.collection)!.set(row.id, updated);
      return structuredClone(updated);
    },
    deleteOne: async (input: Input) => {
      const row = select('deleteOne', input)[0];
      assert.ok(row);
      rows.get(input.collection)!.delete(row.id);
      return structuredClone(row);
    },
    deleteMany: async (input: Input) => {
      const docs = select('deleteMany', input);
      for (const row of docs) rows.get(input.collection)!.delete(row.id);
      return structuredClone(docs);
    },
    deleteVersions: async (input: Input) => {
      assert.ok(rows.has(input.collection));
      assert.deepEqual(Object.keys(input.where ?? {}), ['parent']);
      calls.push({ operation: 'deleteVersions', collection: input.collection, where: structuredClone(input.where) });
    },
    createVersion: async (input: { collectionSlug: string; parent: number; versionData: Record<string, unknown> }) => {
      assert.ok(rows.has(input.collectionSlug));
      const version = { collection: input.collectionSlug, parent: input.parent, version: structuredClone(input.versionData) };
      versions.push(version);
      return structuredClone(version);
    },
    findVersions: async (input: Input) => {
      assert.ok(rows.has(input.collection));
      assert.equal(input.page, 101, 'only version-retention housekeeping is implemented');
      return { docs: [] };
    },
  }, {
    get(target, key) {
      if (!(key in target)) return fail(`Unexpected database operation: ${String(key)}`);
      const value = Reflect.get(target, key);
      if (typeof value !== 'function') return value;
      if (!guardedMethods.has(key)) guardedMethods.set(key, async (...args: unknown[]) => {
        try { return await value.apply(target, args); }
        catch (error) {
          violations.push(`Database fixture rejected ${String(key)}`);
          throw error;
        }
      });
      return guardedMethods.get(key);
    },
  }) as unknown as DatabaseAdapter;
  return { adapter, calls, rows, versions, violations };
}

async function fixture() {
  const db = memoryDatabase();
  let adapterInitializations = 0;
  const config = await buildConfig({
    secret: randomBytes(48).toString('hex'), telemetry: false,
    email: () => ({ name: 'offline-no-mail', defaultFromAddress: 'no-reply@harlem.test', defaultFromName: 'Offline test', sendEmail: forbidden }),
    admin: { user: 'users' }, routes: { api: PAYLOAD_API_ROUTE },
    typescript: { autoGenerate: false }, cors: [origin], csrf: [origin],
    db: { name: 'offline-cookie-fixture', defaultIDType: 'number', init: () => { adapterInitializations++; return db.adapter; } },
    collections: [Users, Members, SavedPlaces,
      { slug: 'media', fields: [] }, { slug: 'places', access: { read: () => true }, fields: [] }],
    plugins: [memberAuthCollections(), createBetterAuthPlugin({
      authBasePath: AUTH_BASE_PATH, autoInjectAdminComponents: false,
      createAuth: payload => betterAuth({ ...betterAuthOptions,
        baseURL: origin, trustedOrigins: [origin], secret: randomBytes(48).toString('hex'),
        database: payloadAdapter({ payloadClient: payload }),
      }),
    })],
  });
  const key = `offline-member-cookie-${randomUUID()}`;
  const payload = await getPayload({ config, key, disableDBConnect: true, disableOnInit: true });
  // Invoke this fixture's real plugin lifecycle after safe cached initialization.
  await config.onInit?.(payload);
  async function request(path: string, options: { method?: string; cookie?: string; body?: unknown; headers?: Record<string, string> } = {}) {
    const headers = new Headers({ origin, ...options.headers });
    if (options.cookie) headers.set('cookie', options.cookie);
    if (options.body !== undefined) headers.set('content-type', 'application/json');
    const response = await handleEndpoints({ config, payloadInstanceCacheKey: key,
      request: new Request(`${origin}${path}`, { method: options.method ?? 'GET', headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body) }),
    });
    assert.equal(adapterInitializations, 1, 'handler reuses only the preinitialized offline instance');
    assert.deepEqual(forbiddenAttempts, []);
    assert.deepEqual(db.violations, [], 'no unexpected DB operation may be swallowed by auth or REST error handling');
    return response;
  }
  async function signUp(label: string) {
    const password = randomBytes(24).toString('base64url');
    const response = await request(`${authPath}/sign-up/email`, { method: 'POST',
      body: { email: `${label}@member.test`, name: label, password } });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    const sessionCookie = response.headers.getSetCookie().find(value => value.startsWith('better-auth.session_token='));
    assert.ok(sessionCookie, 'real signup returns a signed session cookie through the Payload proxy');
    return { id: Number(body.user.id), password, cookie: sessionCookie.split(';')[0]!, setCookie: sessionCookie };
  }
  return { ...db, payload, request, signUp, close: async () => {
    try {
      assert.equal(adapterInitializations, 1);
      assert.deepEqual(db.violations, []);
      assert.deepEqual(forbiddenAttempts, []);
    } finally { await payload.destroy(); }
  } };
}

const savedPath = `${PAYLOAD_API_ROUTE}/saved-places`;

test('anonymous REST reads and writes fail before saved-place DB access', async () => {
  const context = await fixture();
  try {
    for (const [method, path, body] of [
      ['GET', savedPath], ['GET', `${savedPath}/1`],
      ['POST', savedPath, { member: 1, place: 21 }],
      ['PATCH', `${savedPath}/1`, { member: 1, place: 22 }], ['DELETE', `${savedPath}/1`],
    ] as const) {
      const response = await context.request(path, { method, body });
      assert.equal(response.status, 403, `${method} ${path}`);
    }
    assert.deepEqual(context.calls, []);
  } finally { await context.close(); }
});

test('real signup cookie crosses the pinned proxy, adapter and strategy into owner-scoped REST', async () => {
  const context = await fixture();
  try {
    const owner = await context.signUp('owner');
    const other = await context.signUp('other');
    assert.match(owner.setCookie, /HttpOnly/i);
    assert.match(owner.setCookie, /SameSite=Lax/i);
    assert.match(owner.setCookie, /Path=\//i);
    const accounts = [...context.rows.get('accounts')!.values()];
    const sessions = [...context.rows.get('sessions')!.values()];
    assert.deepEqual(accounts.map(row => row.user), [owner.id, other.id]);
    assert.deepEqual(sessions.map(row => row.user), [owner.id, other.id]);
    assert.equal(context.rows.get('users')!.size, 0, 'member signup never writes curator identities');
    assert.ok(accounts.every(row => typeof row.password === 'string' && row.password !== owner.password && row.password !== other.password));
    const ids: number[] = [];
    for (const [member, place] of [[owner, 21], [other, 22]] as const) {
      const response = await context.request(`${savedPath}?depth=0`, { method: 'POST', cookie: member.cookie,
        body: { member: member.id === owner.id ? other.id : owner.id, place } });
      const body = await response.json();
      assert.equal(response.status, 201, JSON.stringify(body));
      assert.equal(body.doc.member, member.id, 'owner hook replaces client-supplied ownership');
      ids.push(body.doc.id);
    }
    for (const [member, expectedID, outsider] of [[owner, ids[0], other], [other, ids[1], owner]] as const) {
      context.calls.length = 0;
      const response = await context.request(`${savedPath}?depth=0`, { cookie: member.cookie });
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).docs.map((row: Row) => row.id), [expectedID]);
      assert.deepEqual(context.calls.find(call => call.collection === 'saved-places')?.where,
        { and: [{ member: { equals: member.id } }] });
      assert.ok(context.calls.some(call => call.collection === 'members'));
      assert.ok(context.calls.some(call => call.collection === 'sessions'));
      assert.ok(context.calls.every(call => call.collection !== 'users'));
      const filtered = await context.request(`${savedPath}?depth=0&where[member][equals]=${outsider.id}`, { cookie: member.cookie });
      assert.deepEqual((await filtered.json()).docs, []);
      const self = await context.request(`${PAYLOAD_API_ROUTE}/members/me`, { cookie: member.cookie });
      const selfBody = await self.json();
      assert.equal(selfBody.user.id, member.id);
      assert.equal(selfBody.user.collection, 'members');
      assert.equal(selfBody.user._strategy, 'better-auth');
    }
    const ownID = ids[0]!;
    assert.equal((await context.request(`${savedPath}/${ownID}?depth=0`, { cookie: other.cookie })).status, 404);
    for (const method of ['PATCH', 'DELETE']) {
      assert.equal((await context.request(`${savedPath}/${ownID}?depth=0`, { method, cookie: other.cookie,
        body: method === 'PATCH' ? { member: other.id, place: 22 } : undefined })).status, 403);
    }
    const updated = await context.request(`${savedPath}/${ownID}?depth=0`, { method: 'PATCH', cookie: owner.cookie,
      body: { member: other.id, place: 22 } });
    assert.equal(updated.status, 200, await updated.clone().text());
    assert.equal((await updated.json()).doc.member, owner.id);
    assert.equal(context.rows.get('saved-places')!.get(ownID)!.member, owner.id);
    assert.equal((await context.request(`${savedPath}/${ownID}?depth=0`, { method: 'DELETE', cookie: owner.cookie })).status, 200);
    assert.deepEqual([...context.rows.get('saved-places')!.keys()], [ids[1]]);
  } finally { await context.close(); }
});

test('forged signatures and unsigned session tokens cannot reach protected collection I/O', async () => {
  const context = await fixture();
  try {
    const member = await context.signUp('tamper');
    const rawToken = [...context.rows.get('sessions')!.values()][0]!.token;
    const [name, encodedValue] = member.cookie.split('=');
    const value = decodeURIComponent(encodedValue!);
    const signatureStart = value.lastIndexOf('.') + 1;
    assert.ok(signatureStart > 0);
    const tampered = value.slice(0, signatureStart) + (value[signatureStart] === 'A' ? 'B' : 'A') + value.slice(signatureStart + 1);
    for (const cookie of [`${name}=${encodeURIComponent(tampered)}`, `${name}=${rawToken}`, `${name}=garbage`]) {
      context.calls.length = 0;
      assert.equal((await context.request(savedPath, { cookie })).status, 403);
      assert.deepEqual(context.calls, [], 'invalid signatures are rejected before any adapter lookup');
    }
    assert.equal((await context.request(savedPath, { cookie: member.cookie })).status, 200);
  } finally { await context.close(); }
});

test('expired server sessions invalidate genuine cookies', async () => {
  const context = await fixture();
  try {
    const member = await context.signUp('expired');
    // Fault injection changes only the stored expiry of a genuinely issued token.
    const session = [...context.rows.get('sessions')!.values()][0]!;
    session.expiresAt = new Date(Date.now() - 60_000).toISOString();
    context.calls.length = 0;
    const response = await context.request(savedPath, { cookie: member.cookie });
    assert.equal(response.status, 403);
    assert.ok(context.calls.some(call => call.collection === 'sessions'));
    assert.ok(context.calls.every(call => call.collection !== 'saved-places'));
    assert.equal(context.rows.get('sessions')!.size, 0, 'Better Auth removes expired sessions');
    // The pinned Payload strategy loop drops an anonymous strategy's clearing
    // headers when local-jwt subsequently returns { user: null }. Denial stays
    // intact. Assert cookie clearing only on the real Better Auth endpoint,
    // whose Response headers survive the proxy; do not patch the dependency.

    const sessionResponse = await context.request(`${authPath}/get-session`, { cookie: member.cookie });
    assert.equal(await sessionResponse.json(), null);
    assert.ok(sessionResponse.headers.getSetCookie().some(cookie => cookie.includes('session_token=') && /Max-Age=0/i.test(cookie)));
  } finally { await context.close(); }
});

test('logout revokes the persisted session and replaying its original cookie fails', async () => {
  const context = await fixture();
  try {
    const owner = await context.signUp('logout');
    const other = await context.signUp('still-signed-in');
    const response = await context.request(`${authPath}/sign-out`, { method: 'POST', cookie: owner.cookie, body: {} });
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal((await response.json()).success, true);
    assert.ok(response.headers.getSetCookie().some(cookie => cookie.includes('session_token=') && /Max-Age=0/i.test(cookie)));
    assert.deepEqual([...context.rows.get('sessions')!.values()].map(row => row.user), [other.id]);
    assert.equal((await context.request(savedPath, { cookie: owner.cookie })).status, 403);
    assert.equal((await context.request(savedPath, { cookie: other.cookie })).status, 200);
  } finally { await context.close(); }
});

test('member REST writes cannot change verified identity or another member profile', async () => {
  const context = await fixture();
  try {
    const owner = await context.signUp('profile');
    const other = await context.signUp('other-profile');
    const path = `${PAYLOAD_API_ROUTE}/members`;
    assert.equal((await context.request(`${path}?depth=0`, { method: 'POST', cookie: owner.cookie,
      body: { email: 'injected@member.test', name: 'Injected' } })).status, 403);
    const response = await context.request(`${path}/${owner.id}?depth=0`, { method: 'PATCH', cookie: owner.cookie,
      body: { name: 'Updated name', email: 'forged@member.test', emailVerified: true } });
    assert.equal(response.status, 200, await response.clone().text());
    const member = context.rows.get('members')!.get(owner.id)!;
    assert.equal(member.name, 'Updated name');
    assert.equal(member.email, 'profile@member.test');
    assert.equal(member.emailVerified, false);
    assert.equal((await context.request(`${path}/${other.id}?depth=0`, { method: 'PATCH', cookie: owner.cookie,
      body: { name: 'Stolen profile' } })).status, 403);
    assert.equal(context.rows.get('members')!.get(other.id)!.name, 'other-profile');
  } finally { await context.close(); }
});

test('auth mount preserves configured basePath and real credential verification', async () => {
  const context = await fixture();
  try {
    assert.equal(authPath, '/payload-api/auth');
    const member = await context.signUp('routes');
    for (const wrongPath of ['/api/auth/get-session', '/auth/get-session', '/api/saved-places']) {
      assert.equal((await context.request(wrongPath, { cookie: member.cookie })).status, 404);
    }
    const session = await context.request(`${authPath}/get-session?disableCookieCache=true&disableRefresh=true`, { cookie: member.cookie });
    assert.equal(session.status, 200);
    assert.equal((await session.json()).user.id, String(member.id));
    const badPassword = await context.request(`${authPath}/sign-in/email`, { method: 'POST',
      body: { email: 'routes@member.test', password: 'a-deliberately-incorrect-test-password' } });
    assert.equal(badPassword.status, 401);
    assert.equal(badPassword.headers.getSetCookie().length, 0);
    const sessionCount = context.rows.get('sessions')!.size;
    const untrusted = await context.request(`${authPath}/sign-in/email`, { method: 'POST',
      body: { email: 'routes@member.test', password: member.password }, headers: { origin: 'http://untrusted.test' } });
    assert.equal(untrusted.status, 403);
    assert.equal(context.rows.get('sessions')!.size, sessionCount);
    const signIn = await context.request(`${authPath}/sign-in/email`, { method: 'POST',
      body: { email: 'routes@member.test', password: member.password },
      headers: { host: 'untrusted.test', 'x-forwarded-proto': 'https' } });
    assert.equal(signIn.status, 200, await signIn.clone().text());
    const cookie = signIn.headers.getSetCookie().find(value => value.startsWith('better-auth.session_token='));
    assert.ok(cookie);
    assert.equal((await context.request(savedPath, { cookie: cookie.split(';')[0] })).status, 200);
  } finally { await context.close(); }
});


test('a real curator login with a colliding numeric ID cannot access member saves', async () => {
  const context = await fixture();
  try {
    const member = await context.signUp('member-collision');
    const password = randomBytes(24).toString('base64url');
    const curator = await context.payload.create({ collection: 'users', data: { email: 'curator@harlem.test', password }, depth: 0, overrideAccess: true });
    assert.equal(curator.id, member.id, 'fixture deliberately overlaps identity IDs');
    const saved = await context.request(`${savedPath}?depth=0`, { method: 'POST', cookie: member.cookie, body: { place: 21 } });
    assert.equal(saved.status, 201);
    const savedID = (await saved.json()).doc.id;
    const login = await context.request(`${PAYLOAD_API_ROUTE}/users/login`, { method: 'POST', body: { email: 'curator@harlem.test', password } });
    assert.equal(login.status, 200, await login.clone().text());
    const cookie = login.headers.getSetCookie().find(value => value.startsWith('payload-token='))?.split(';')[0];
    assert.ok(cookie, 'the real Payload login issues a curator JWT cookie');
    const self = await context.request(`${PAYLOAD_API_ROUTE}/users/me`, { cookie });
    assert.equal((await self.json()).user.collection, 'users');
    context.calls.length = 0;
    for (const [method, path, body] of [
      ['GET', savedPath], ['GET', `${savedPath}/${savedID}`],
      ['POST', savedPath, { member: member.id, place: 22 }],
      ['PATCH', `${savedPath}/${savedID}`, { member: member.id, place: 22 }], ['DELETE', `${savedPath}/${savedID}`],
    ] as const) assert.equal((await context.request(path, { method, cookie, body })).status, 403);
    assert.ok(context.calls.every(call => call.collection !== 'saved-places'));
    assert.equal(context.rows.get('saved-places')!.size, 1);
    assert.equal((await context.request(savedPath, { cookie: member.cookie })).status, 200);
  } finally { await context.close(); }
});


test('aging valid sessions refresh through the real strategy and retain Set-Cookie on REST responses', async () => {
  const context = await fixture();
  try {
    const member = await context.signUp('refresh');
    const session = [...context.rows.get('sessions')!.values()][0]!;
    const expiry = new Date(Date.now() + 60_000).toISOString();
    session.expiresAt = expiry;
    context.calls.length = 0;
    const response = await context.request(`${savedPath}?depth=0`, { cookie: member.cookie });
    assert.equal(response.status, 200);
    const cookie = response.headers.getSetCookie().find(value => value.startsWith('better-auth.session_token='));
    assert.ok(cookie, 'session refresh cookie is forwarded by the authenticated strategy');
    assert.match(cookie, /HttpOnly/i);
    assert.ok(context.calls.some(call => call.collection === 'sessions' && call.operation === 'updateOne'));
    assert.ok(new Date(String(context.rows.get('sessions')!.get(session.id)!.expiresAt)).getTime() > new Date(expiry).getTime());
    assert.equal((await context.request(savedPath, { cookie: cookie.split(';')[0] })).status, 200);
  } finally { await context.close(); }
});
