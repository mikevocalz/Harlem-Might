import assert from 'node:assert/strict';
import { it } from 'node:test';
import { beginWalk } from '@acme/widgets';
import { createMemberJourneyTransport } from './member-transport.ts';
const command = { schemaVersion: 1 as const, commandId: 'pause', sessionId: 'session', expectedRevision: 0, type: 'pause' as const };
const session = beginWalk({ id: '7', slug: 'history', title: 'History', published: true, stopIds: ['1','2'], sourceUrl: 'https://example.org' }, 'session', '2026-10-01T12:00:00.000Z');
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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
