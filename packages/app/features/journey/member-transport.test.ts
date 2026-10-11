import assert from 'node:assert/strict';
import { it } from 'node:test';
import { beginWalk } from '@acme/widgets';
import type { WalkRecord } from '../../content/records.ts';
import { createJourneyController, JourneyConflict, JourneyIdentityChanged } from './controller.ts';
import { createMemberJourneyTransport } from './member-transport.ts';
const command = { schemaVersion: 1 as const, commandId: 'pause', sessionId: 'session', expectedRevision: 0, type: 'pause' as const };
const session = beginWalk({ id: '7', slug: 'history', title: 'History', published: true, stopIds: ['1','2'], sourceUrl: 'https://example.org' }, 'session', '2026-10-01T12:00:00.000Z');
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
it('checks the same cookie owner before each member command, never sends when account changed', async () => {
  let owner = 'A'; let writes = 0;
  const transport = createMemberJourneyTransport('', async (_url, init) => {
    assert.equal(init?.credentials, 'include');
    if (init?.method === 'POST') { writes++; return response({ schemaVersion: 1, session }); }
    return response({ user: { id: owner } });
  });
  assert.equal(await transport.identity(), 'member'); owner = 'B';
  await assert.rejects(transport.send(command), /login changed/); assert.equal(writes, 0);
});
it('auth outage is not treated as an anonymous login', async () => {
  const transport = createMemberJourneyTransport('', async () => response({}, 503));
  await assert.rejects(transport.identity(), /check your login/);
});
it('revision conflict exposes authoritative state without automatic replay', async () => {
  let writes = 0;
  const transport = createMemberJourneyTransport('', async (_url, init) => init?.method === 'POST' ? (writes++, response({ schemaVersion: 1, code: 'revision-conflict', session }, 409)) : response({ user: { id: 'A' } }));
  await transport.identity(); await assert.rejects(transport.send(command), /another device/); assert.equal(writes, 1);
});

for (const status of [401, 403]) {
  for (const body of ['<html>Sign in</html>', '']) {
    it(`revokes identity for ${status} with ${body ? 'HTML' : 'an empty body'} without parsing it`, async () => {
      const rejected = new Response(body, { status });
      let parses = 0;
      rejected.json = async () => { parses++; throw new SyntaxError('Invalid JSON'); };
      const transport = createMemberJourneyTransport('', async (_url, init) => init?.method === 'POST' ? rejected : response({ user: { id: 'A' } }));
      await transport.identity();
      await assert.rejects(transport.send(command), JourneyIdentityChanged);
      assert.equal(parses, 0);
    });
  }
}

for (const status of [502, 503, 409]) {
  it(`reports a safe save error for a malformed ${status} response`, async () => {
    const transport = createMemberJourneyTransport('', async (_url, init) => init?.method === 'POST' ? new Response('<html>Gateway error</html>', { status }) : response({ user: { id: 'A' } }));
    await transport.identity();
    await assert.rejects(transport.send(command), { message: 'Could not save your walk. Reconnect and try again.' });
  });
}

for (const body of ['<html>Proxy response</html>', '', 'null', '[]', '{}']) {
  it(`reports an unsupported response for malformed success body ${JSON.stringify(body)}`, async () => {
    const transport = createMemberJourneyTransport('', async (_url, init) => init?.method === 'POST' ? new Response(body) : response({ user: { id: 'A' } }));
    await transport.identity();
    await assert.rejects(transport.send(command), { message: 'Unsupported walk response.' });
  });
}

for (const status of [200, 409]) {
  it(`validates session structure and identity for ${status} responses`, async () => {
    let result = { ...session, sessionId: 'other-session' };
    const transport = createMemberJourneyTransport('', async (_url, init) => init?.method === 'POST' ? response({ schemaVersion: 1, code: 'revision-conflict', session: result }, status) : response({ user: { id: 'A' } }));
    await transport.identity();
    await assert.rejects(transport.send(command), { message: 'The service returned a different walk session.' });
    result = { ...session, revision: -1 };
    await assert.rejects(transport.send(command), { message: 'Invalid walk session' });
    result = session;
    if (status === 409) await assert.rejects(transport.send(command), error => error instanceof JourneyConflict && error.session.sessionId === session.sessionId);
    else assert.deepEqual(await transport.send(command), session);
  });
}

for (const malformed of [false, true]) {
  it(`preserves identity revocation while a ${malformed ? 'malformed' : 'valid'} command body is pending`, async () => {
    const reading = deferred<void>();
    const body = deferred<unknown>();
    const pendingResponse = response({});
    pendingResponse.json = () => { reading.resolve(); return body.promise; };
    const transport = createMemberJourneyTransport('', async (_url, init) => init?.method === 'POST' ? pendingResponse : response({ user: { id: 'A' } }));
    await transport.identity();
    const pending = transport.send(command);
    await reading.promise;
    transport.invalidateIdentity!();
    if (malformed) body.reject(new SyntaxError('Invalid JSON'));
    else body.resolve({ schemaVersion: 1, session });
    await assert.rejects(pending, JourneyIdentityChanged);
  });
}

for (const status of [401, 403]) {
  it(`clears controller state and routing effects on a non-JSON ${status} command response`, async () => {
    const walk: WalkRecord = { id: 7, slug: 'history', title: 'History', summary: 'A sourced walk.', distanceMeters: 500, durationMinutes: 10, startDescription: 'Apollo', endDescription: 'Sylvia', images: [], updatedAt: session.startedAt, stops: [{ position: 1, place: { id: 1, slug: 'apollo', name: 'Apollo' } }, { position: 2, place: { id: 2, slug: 'sylvia', name: 'Sylvia' } }], sources: [{ label: 'Archive', url: 'https://example.org', accessedAt: session.startedAt }] };
    let rejectCommand = false; let clears = 0; const removed: string[] = [];
    const transport = createMemberJourneyTransport('', async (_url, init) => {
      if (init?.method !== 'POST') return response({ user: { id: 'A' } });
      if (rejectCommand) return new Response(status === 401 ? '<html>Sign in</html>' : '', { status });
      const start = JSON.parse(String(init.body));
      return response({ schemaVersion: 1, session: { ...session, sessionId: start.sessionId } });
    });
    const controller = createJourneyController({
      transport,
      storage: { getString() { return undefined; }, set() {}, remove(key) { removed.push(key); } },
      readers: { getWalk: async () => ({ status: 'ok', data: walk }), getPlace: async () => ({ status: 'not-found' }), listStories: async () => ({ status: 'ok', data: [] }) },
      onClear() { clears++; },
    });
    await controller.begin(walk.slug);
    const active = controller.getSnapshot().session!;
    assert.ok(active);
    controller.cacheRoute({ schemaVersion: 1, stopId: '1', generatedAt: session.startedAt, distanceM: 500, durationS: 600, instructions: ['Continue walking'] });
    rejectCommand = true;
    assert.equal(await controller.dispatch({ ...command, sessionId: active.sessionId }), false);
    const state = controller.getSnapshot();
    assert.equal(state.session, null);
    assert.equal(state.plan, null);
    assert.equal(state.mode, null);
    assert.equal(state.synopsis, null);
    assert.equal(state.busy, false);
    assert.match(state.error!, /login changed/);
    assert.equal(clears, 1);
    assert.deepEqual(removed, ['anonymous-walk-v1']);
    assert.equal(transport.matchesIdentity!('A'), false);
  });
}
