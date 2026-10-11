import assert from 'node:assert/strict';
import { it } from 'node:test';
import { applyWalkCommand, type WalkCommand, type WalkSession } from '@acme/widgets';
import { createJourneyController } from './controller.ts';
import { createMemberJourneyTransport } from './member-transport.ts';
import { observeJourneyMemberIdentity } from './member-identity.ts';
import type { WalkRecord } from '../../content/records.ts';

const A = { id: 'A' };
const B = { id: 'B' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const walk: WalkRecord = { id: 7, slug: 'history', title: 'History', summary: 'A sourced walk.', distanceMeters: 500, durationMinutes: 10, startDescription: 'Apollo', endDescription: 'Sylvia', images: [], updatedAt: '2026-10-01T12:00:00.000Z', stops: [{ position: 1, place: { id: 1, slug: 'apollo', name: 'Apollo' } }, { position: 2, place: { id: 2, slug: 'sylvia', name: 'Sylvia' } }], sources: [{ label: 'Archive', url: 'https://example.invalid/archive', accessedAt: '2026-10-01T12:00:00.000Z' }] };
const summary = { id: '7', slug: walk.slug, title: walk.title, stopIds: ['1', '2'], published: true, sourceUrl: 'https://example.invalid/archive' };
const readers = { getWalk: async () => ({ status: 'ok' as const, data: walk }), getPlace: async () => ({ status: 'not-found' as const }), listStories: async () => ({ status: 'ok' as const, data: [] }) };
const storage = { getString() { return undefined; }, set() {}, remove() {} };
function memberSignal(controller: ReturnType<typeof createJourneyController>) {
  let listener!: (state: { member: typeof A | null }, previous: { member: typeof A | null }) => void;
  observeJourneyMemberIdentity(controller, { subscribe(fn) { listener = fn; return () => {}; } });
  return (member: typeof A | null, previous: typeof A | null = A) => listener({ member }, { member: previous });
}

it('logout revokes an initial committed member start before its delayed response returns', async () => {
  const pending = deferred<Response>(); const posted = deferred<WalkSession>();
  const transport = createMemberJourneyTransport('', async (url, init) => {
    if (String(url).endsWith('/auth/get-session')) return response({ user: A });
    const command = JSON.parse(String(init?.body)) as WalkCommand;
    const session = applyWalkCommand(null, command, new Date().toISOString(), summary);
    posted.resolve(session); return pending.promise;
  });
  const c = createJourneyController({ readers, storage, transport });
  const signal = memberSignal(c);
  const begin = c.begin(walk.slug);
  const committed = await posted.promise;
  assert.equal(c.getSnapshot().mode, null);
  signal(null);
  assert.equal(c.getSnapshot().busy, false);
  pending.resolve(response({ schemaVersion: 1, session: committed }));
  await begin;
  assert.equal(c.getSnapshot().session, null);
});

it('a cancelled identity lookup cannot replace the owner of a newer B journey even if abort is ignored', async () => {
  const delayed = deferred<Response>(); const started = deferred<void>(); let reads = 0; let server: WalkSession | null = null;
  const transport = createMemberJourneyTransport('', async (url, init) => {
    if (String(url).endsWith('/auth/get-session')) {
      if (++reads === 1) { started.resolve(); return delayed.promise; }
      return response({ user: B });
    }
    const command = JSON.parse(String(init?.body)) as WalkCommand;
    server = applyWalkCommand(server, command, new Date().toISOString(), summary);
    return response({ schemaVersion: 1, session: server });
  });
  const c = createJourneyController({ readers, storage, transport });
  const old = c.begin(walk.slug); await started.promise;
  c.clear(); await c.begin(walk.slug);
  const current = c.getSnapshot().session!;
  delayed.resolve(response({ user: A })); await old;
  assert.equal(c.getSnapshot().session?.sessionId, current.sessionId);
  assert.equal(await c.dispatch({ schemaVersion: 1, commandId: 'pause-B', sessionId: current.sessionId, expectedRevision: 0, type: 'pause' }), true);
  assert.equal(c.getSnapshot().session?.status, 'paused');
});

it('a boundary during command verification prevents a POST even if the old session body arrives afterward', async () => {
  const body = deferred<unknown>(); const verifying = deferred<void>(); let reads = 0; let posts = 0;
  const transport = createMemberJourneyTransport('', async (_url, init) => {
    if (init?.method === 'POST') { posts++; return response({}); }
    if (++reads === 2) { verifying.resolve(); return { ok: true, json: () => body.promise } as Response; }
    return response({ user: A });
  });
  await transport.identity();
  const pending = transport.send({ schemaVersion: 1, commandId: 'start-A', sessionId: 'session-A', expectedRevision: null, type: 'start', walkId: '7' });
  await verifying.promise;
  transport.invalidateIdentity!();
  body.resolve({ user: A });
  await assert.rejects(pending, /login changed/);
  assert.equal(posts, 0);
});

it('an explicit owner transition immediately clears active member state without waiting for a server read', async () => {
  const transport = createMemberJourneyTransport('', async (_url, init) => init?.method === 'POST'
    ? response({ schemaVersion: 1, session: applyWalkCommand(null, JSON.parse(String(init.body)), new Date().toISOString(), summary) })
    : response({ user: A }));
  const c = createJourneyController({ readers, storage, transport });
  const signal = memberSignal(c); await c.begin(walk.slug);
  assert.ok(c.getSnapshot().session);
  signal(B);
  assert.equal(c.getSnapshot().session, null);
});

it('identity checks invalidate uncommitted starts and do not remove an established anonymous journey', async () => {
  const delayed = deferred<'member'>(); const requested = deferred<void>(); let writes = 0;
  const c = createJourneyController({ readers, storage, transport: { identity() { requested.resolve(); return delayed.promise; }, async send() { writes++; throw new Error('must not send'); } } });
  const begin = c.begin(walk.slug); await requested.promise;
  await c.checkIdentity(); delayed.resolve('member'); await begin;
  assert.equal(writes, 0);
  assert.equal(c.getSnapshot().session, null);
  const local = createJourneyController({ readers, storage, transport: { async identity() { return 'local'; }, async send() { throw new Error('must not send'); } } });
  await local.begin(walk.slug);
  const session = local.getSnapshot().session;
  memberSignal(local)(B);
  assert.equal(local.getSnapshot().session, session);
});

it('owner signals normalize numeric IDs and ignore same-owner profile updates', () => {
  let changes = 0;
  let listener!: (state: { member: { id: string | number } | null }, previous: { member: { id: string | number } | null }) => void;
  observeJourneyMemberIdentity({ identityChanged() { changes++; } }, { subscribe(fn) { listener = fn; return () => {}; } });
  listener({ member: { id: '7' } }, { member: { id: 7 } });
  assert.equal(changes, 0);
  listener({ member: null }, { member: { id: '7' } });
  assert.equal(changes, 1);
});

it('late initial member hydration preserves a journey already verified for the same owner', async () => {
  const transport = createMemberJourneyTransport('', async (_url, init) => init?.method === 'POST'
    ? response({ schemaVersion: 1, session: applyWalkCommand(null, JSON.parse(String(init.body)), new Date().toISOString(), summary) })
    : response({ user: A }));
  const c = createJourneyController({ readers, storage, transport });
  await c.begin(walk.slug);
  const current = c.getSnapshot().session;
  assert.ok(current);
  memberSignal(c)(A, null);
  assert.equal(c.getSnapshot().session, current);
});

it('a settled signed-out mirror revokes member work even before its initial owner has hydrated', () => {
  const observed: (string | null)[] = [];
  let listener!: (state: { member: null; status: string }, previous: { member: null; status: string }) => void;
  observeJourneyMemberIdentity({ identityChanged(owner = null) { observed.push(owner); } }, { subscribe(fn) { listener = fn; return () => {}; } });
  listener({ member: null, status: 'signed-out' }, { member: null, status: 'loading' });
  assert.deepEqual(observed, [null]);
});
