import assert from 'node:assert/strict';
import test from 'node:test';
import type { WalkCommand } from '@acme/widgets/walk-commands';
import { executeWalkCommand, MAX_WALK_COMMANDS, readWalkSession, WalkSessionError } from './service.ts';
import type { StoredWalkSession, WalkSessionDependencies, WalkSessionRepository } from './service.ts';
import { verifyWalkMember } from './auth.ts';
import { handleReadWalkSession, handleWalkCommand, unsupportedWatchSession } from './http.ts';
import { WalkSessions } from '../collections/WalkSessions.ts';

const now = '2026-10-11T00:00:00.000Z';
const walk = { id: '12', slug: 'harlem', title: 'Harlem', stopIds: ['1', '2'], published: true, sourceUrl: 'https://example.com' };
const start: WalkCommand = { schemaVersion: 1, commandId: 'start', sessionId: 's1', expectedRevision: null, type: 'start', walkId: '12' };
const command = (type: 'pause' | 'resume', revision = 0): WalkCommand => ({ schemaVersion: 1, commandId: type, sessionId: 's1', expectedRevision: revision, type });
const key = (memberId: number, sessionId: string) => `${memberId}:${sessionId}`;

function fixture() {
  const rows = new Map<string, StoredWalkSession>();
  let memberId: number | null = 1;
  let published = true;
  const repository: WalkSessionRepository = {
    async read(member, session) { return structuredClone(rows.get(key(member, session)) ?? null); },
    async insert(record) {
      const id = key(record.memberId, record.session.sessionId);
      if (rows.has(id)) return false;
      rows.set(id, structuredClone(record)); return true;
    },
    async compareAndSwap(record, expectedGeneration) {
      const id = key(record.memberId, record.session.sessionId);
      if (rows.get(id)?.generation !== expectedGeneration) return false;
      rows.set(id, structuredClone(record)); return true;
    },
  };
  const deps: WalkSessionDependencies = {
    authenticate: async () => memberId ? { memberId } : null,
    repository, now: () => now, loadPublishedWalk: async id => published && id === walk.id ? walk : null,
  };
  return { deps, rows, setMember: (id: number | null) => { memberId = id; }, unpublish: () => { published = false; } };
}
const hasCode = (code: string) => (error: unknown) => error instanceof WalkSessionError && error.code === code;

test('owner-scoped start is idempotent, cross-device duplicate returns latest state', async () => {
  const { deps, rows } = fixture();
  const results = await Promise.all([executeWalkCommand(deps, start), executeWalkCommand(deps, start)]);
  assert.equal(rows.size, 1);
  assert.equal(results.filter(result => result.replayed).length, 1);
  const paused = await executeWalkCommand(deps, command('pause'));
  assert.equal(paused.session.revision, 1);
  const repeatedStart = await executeWalkCommand(deps, start);
  assert.equal(repeatedStart.replayed, true);
  assert.equal(repeatedStart.session.status, 'paused');
  await assert.rejects(executeWalkCommand(deps, {...start, walkId: '13'}), hasCode('command-id-conflict'));
});

test('stale commands conflict, simultaneous confirmed progress cannot overwrite cancellation', async () => {
  const { deps } = fixture();
  await executeWalkCommand(deps, start);
  const results = await Promise.allSettled([
    executeWalkCommand(deps, {...command('pause'), commandId: 'stop', type: 'stop', confirmed: true}),
    executeWalkCommand(deps, {...command('pause'), commandId: 'confirm', type: 'confirm-stop', confirmed: true, stopId: '1'}),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = results.find(result => result.status === 'rejected');
  assert.equal(rejected?.status === 'rejected' && hasCode('revision-conflict')(rejected.reason), true);
  assert.equal((await readWalkSession(deps, 's1')).session.revision, 1);
});

test('no-op commands retain receipts without incrementing public revision or losing concurrent IDs', async () => {
  const { deps, rows } = fixture();
  await executeWalkCommand(deps, start);
  const a = command('resume');
  const b = {...a, commandId: 'second-resume'};
  await Promise.all([executeWalkCommand(deps, a), executeWalkCommand(deps, b)]);
  assert.equal(rows.get('1:s1')?.receipts.length, 3);
  assert.equal(rows.get('1:s1')?.session.revision, 0);
  assert.equal((await executeWalkCommand(deps, a)).replayed, true);
  assert.equal((await executeWalkCommand(deps, b)).replayed, true);
});

test('account switching never reads another owner or persists anonymous sessions', async () => {
  const { deps, rows, setMember } = fixture();
  await executeWalkCommand(deps, start);
  setMember(2);
  await assert.rejects(readWalkSession(deps, 's1'), hasCode('session-not-found'));
  await assert.rejects(executeWalkCommand(deps, command('pause')), hasCode('session-not-found'));
  await executeWalkCommand(deps, start);
  assert.equal(rows.size, 2);
  setMember(null);
  await assert.rejects(readWalkSession(deps, 's1'), hasCode('sign-in-required'));
  await assert.rejects(executeWalkCommand(deps, start), hasCode('sign-in-required'));
  assert.equal(rows.size, 2);
});

test('revocation between lookup and mutation fails closed; replay also needs current login', async () => {
  const { deps, rows, setMember } = fixture();
  const load = deps.loadPublishedWalk;
  deps.loadPublishedWalk = async id => { setMember(null); return load(id); };
  await assert.rejects(executeWalkCommand(deps, start), hasCode('sign-in-required'));
  assert.equal(rows.size, 0);
  setMember(1); deps.loadPublishedWalk = load;
  await executeWalkCommand(deps, start);
  setMember(null);
  await assert.rejects(executeWalkCommand(deps, start), hasCode('sign-in-required'));
});

test('logout and account changes during storage reads cannot disclose reads, replays or conflicts', async (t) => {
  for (const member of [null, 2]) {
    for (const path of ['read', 'replay', 'revision-conflict', 'command-limit', 'invalid-transition', 'command-id-conflict']) {
      await t.test(`${path} after identity becomes ${member}`, async () => {
        const { deps, rows, setMember } = fixture();
        await executeWalkCommand(deps, start);
        const record = rows.get('1:s1')!;
        if (path === 'command-limit') {
          record.receipts.push(...Array.from({ length: MAX_WALK_COMMANDS - 1 }, (_, index) => ({
            commandId: `prior-${index}`, fingerprint: 'prior-accepted-command',
          })));
        }
        const read = deps.repository.read;
        deps.repository.read = async (...args) => {
          const snapshot = await read(...args);
          setMember(member);
          return snapshot;
        };
        const input = path === 'replay' ? start
          : path === 'command-id-conflict' ? { ...start, walkId: 'other' }
          : path === 'invalid-transition' ? { ...command('pause'), type: 'confirm-stop', stopId: '2', confirmed: true }
          : command('pause', path === 'revision-conflict' ? 1 : 0);
        const response = path === 'read'
          ? await handleReadWalkSession(deps, 's1')
          : await handleWalkCommand(request(input), deps, ['https://harlem.example']);
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), { schemaVersion: 1, code: 'sign-in-required' });
        assert.equal(rows.get('1:s1')?.session.revision, 0);
      });
    }
  }
});

test('revocation while writes complete cannot return a private snapshot', async (t) => {
  for (const member of [null, 2]) {
    for (const operation of ['insert', 'compareAndSwap'] as const) {
      await t.test(`${operation} after identity becomes ${member}`, async () => {
        const { deps, setMember } = fixture();
        if (operation === 'compareAndSwap') await executeWalkCommand(deps, start);
        const write = deps.repository[operation].bind(deps.repository);
        deps.repository[operation] = async (record: StoredWalkSession, generation: number = 0) => {
          const accepted = await write(record, generation);
          setMember(member);
          return accepted;
        };
        const response = await handleWalkCommand(request(operation === 'insert' ? start : command('pause')), deps, ['https://harlem.example']);
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), { schemaVersion: 1, code: 'sign-in-required' });
      });
    }
  }
});

test('the final contention read rechecks identity and validates data before returning conflict state', async (t) => {
  for (const failure of ['revoked', 'changed', 'corrupt']) {
    await t.test(failure, async () => {
      const { deps, setMember } = fixture();
      await executeWalkCommand(deps, start);
      deps.repository.compareAndSwap = async () => false;
      let reads = 0;
      const read = deps.repository.read;
      deps.repository.read = async (...args) => {
        const record = await read(...args);
        if (++reads === 4) {
          if (failure === 'corrupt') record!.session = { ...record!.session, token: 'never-expose' } as never;
          else setMember(failure === 'changed' ? 2 : null);
        }
        return record;
      };
      const response = await handleWalkCommand(request(command('pause')), deps, ['https://harlem.example']);
      assert.equal(response.status, failure === 'corrupt' ? 503 : 401);
      const body = await response.json();
      assert.equal('session' in body, false);
      assert.equal(JSON.stringify(body).includes('never-expose'), false);
    });
  }
});

test('start loads authoritative published route; arbitrary identities, route data and fields rejected', async () => {
  const { deps, rows, unpublish } = fixture();
  for (const input of [{...start, owner: 2}, {...start, stopIds: ['fake']}, {...start, latitude: 42}]) {
    await assert.rejects(executeWalkCommand(deps, input), hasCode('invalid-command'));
  }
  unpublish();
  await assert.rejects(executeWalkCommand(deps, start), hasCode('published-walk-not-found'));
  assert.equal(rows.size, 0);
});

test('verified auth bypasses cookie cache, rejects expiration/revocation/forged owner and bearer handoff', async () => {
  let returned: unknown = { user: { id: '1' }, session: { userId: '1', expiresAt: new Date(Date.now() + 60000) } };
  let calls = 0;
  const auth = { api: { getSession: async (input: { query: unknown }) => {
    calls++; assert.deepEqual(input.query, { disableCookieCache: true, disableRefresh: true }); return returned;
  } } };
  assert.deepEqual(await verifyWalkMember(auth, new Headers()), { memberId: 1 });
  returned = null;
  assert.equal(await verifyWalkMember(auth, new Headers()), null);
  returned = { user: { id: '2' }, session: { userId: '1', expiresAt: new Date(Date.now() + 60000) } };
  assert.equal(await verifyWalkMember(auth, new Headers()), null);
  returned = { user: { id: '1' }, session: { userId: '1', expiresAt: new Date(0) } };
  assert.equal(await verifyWalkMember(auth, new Headers()), null);
  assert.equal(await verifyWalkMember(auth, new Headers({ authorization: 'Bearer never-accepted' })), null);
  assert.equal(calls, 4);
});

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://harlem.example/payload-api/walk-sessions/command', {
    method: 'POST', headers: { origin: 'https://harlem.example', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
}

test('HTTP rejects CSRF, malformed/oversized input, keeps responses private and never leaks errors', async () => {
  const { deps } = fixture();
  const origins = ['https://harlem.example'];
  assert.equal((await handleWalkCommand(request(start, { origin: 'https://evil.example' }), deps, origins)).status, 403);
  assert.equal((await handleWalkCommand(request(start, { origin: '' }), deps, origins)).status, 403);
  assert.equal((await handleWalkCommand(request(start, { 'content-type': 'text/plain' }), deps, origins)).status, 415);
  assert.equal((await handleWalkCommand(request({ data: 'x'.repeat(4096) }), deps, origins)).status, 413);
  for (const body of ['{', new Uint8Array([0xff])]) {
    const malformed = new Request('https://harlem.example', { method: 'POST',
      headers: { origin: origins[0]!, 'content-type': 'application/json' }, body });
    assert.equal((await handleWalkCommand(malformed, deps, origins)).status, 400);
  }
  const ok = await handleWalkCommand(request(start), deps, origins);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'private, no-store');
  await handleWalkCommand(request(command('pause')), deps, origins);
  const conflict = await handleWalkCommand(request(command('resume')), deps, origins);
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).session.revision, 1);
  deps.authenticate = async () => { throw new Error('database-password=secret'); };
  const failure = await handleReadWalkSession(deps, 's1');
  assert.equal(failure.status, 503);
  assert.equal((await failure.text()).includes('secret'), false);
});

test('independent watch access fails closed; private collection has no alternate CRUD', async () => {
  for (let i = 0; i < 2; i++) {
    const response = unsupportedWatchSession();
    assert.equal(response.status, 501);
    assert.equal((await response.json()).code, 'watch-session-unsupported');
  }
  assert.equal(WalkSessions.endpoints, false);
  assert.equal(WalkSessions.graphQL, false);
  for (const access of Object.values(WalkSessions.access!)) assert.equal(access({} as never), false);
});


test('bounded receipt ledger never forgets commands and reserves a final explicit stop', async () => {
  const { deps, rows } = fixture();
  await executeWalkCommand(deps, start);
  const record = rows.get('1:s1')!;
  record.receipts.push(...Array.from({length: MAX_WALK_COMMANDS - 1}, (_, index) => ({
    commandId: `prior-${index}`, fingerprint: 'prior-accepted-command',
  })));
  assert.equal((await executeWalkCommand(deps, start)).replayed, true);
  await assert.rejects(executeWalkCommand(deps, command('pause')), hasCode('command-limit'));
  const stop = { ...command('pause'), type: 'stop', commandId: 'last-stop', confirmed: true };
  assert.equal((await executeWalkCommand(deps, stop)).session.status, 'stopped');
  assert.equal((await executeWalkCommand(deps, stop)).replayed, true);
  assert.equal(rows.get('1:s1')?.receipts.length, MAX_WALK_COMMANDS + 1);
});
