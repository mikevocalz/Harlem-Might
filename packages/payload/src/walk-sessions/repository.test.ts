import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { BasePayload, buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { WalkSessions } from '../collections/WalkSessions.ts';
import { WALK_SESSIONS_SCHEMA_SQL } from './schema.ts';
import { createWalkSessionRepository } from './repository.ts';
import { executeWalkCommand, readWalkSession, WalkSessionError } from './service.ts';
import type { WalkSessionDependencies } from './service.ts';

// This test never connects to an external/production database.
test('real Payload schema and PostgreSQL CAS enforce owner scope, replay and concurrent revisions', async () => {
  const config = await buildConfig({
    secret: 'test-only-not-an-auth-secret', admin: { user: 'members' },
    collections: [{ slug: 'members', auth: true, authorship: false, fields: [] }, WalkSessions],
    db: postgresAdapter({ pool: {}, schemaName: 'payload', push: false }),
  });
  const payload = await new BasePayload().init({ config, disableDBConnect: true, disableOnInit: true });
  const database = new PGlite();
  try {
    const kit = payload.db.requireDrizzleKit();
    const base = { pgSchema: payload.db.schema.pgSchema, members: payload.db.tables.members };
    const before = await kit.generateDrizzleJson(base);
    const after = await kit.generateDrizzleJson({ ...base, walk_sessions: payload.db.tables.walk_sessions });
    const actualSQL = (await kit.generateMigration(before, after)).join('\n');
    assert.equal(WALK_SESSIONS_SCHEMA_SQL, actualSQL, 'Regenerate the scoped SQL when the actual Payload schema changes');
    await database.exec('CREATE SCHEMA payload; CREATE TABLE payload.members (id serial PRIMARY KEY); INSERT INTO payload.members (id) VALUES (1), (2);');
    await database.exec(actualSQL);
    const repository = createWalkSessionRepository({ query: (text, values) => database.query(text, values) });
    const deps: WalkSessionDependencies = {
      repository, authenticate: async () => ({ memberId: 1 }), now: () => '2026-10-11T00:00:00.000Z',
      loadPublishedWalk: async () => ({ id: '12', slug: 'harlem', title: 'Harlem', stopIds: ['1', '2'], published: true, sourceUrl: 'https://example.com' }),
    };
    const start = { schemaVersion: 1, commandId: 'start', sessionId: 's1', expectedRevision: null, type: 'start', walkId: '12' };
    const starts = await Promise.all([executeWalkCommand(deps, start), executeWalkCommand(deps, start)]);
    assert.equal(starts.filter(result => result.replayed).length, 1);
    assert.equal((await database.query('SELECT * FROM payload.walk_sessions')).rows.length, 1);
    const baseCommand = { schemaVersion: 1, sessionId: 's1', expectedRevision: 0 };
    const changes = await Promise.allSettled([
      executeWalkCommand(deps, { ...baseCommand, commandId: 'pause', type: 'pause' }),
      executeWalkCommand(deps, { ...baseCommand, commandId: 'stop', type: 'stop', confirmed: true }),
    ]);
    assert.equal(changes.filter(result => result.status === 'fulfilled').length, 1);
    const failed = changes.find(result => result.status === 'rejected');
    assert.ok(failed?.status === 'rejected' && failed.reason instanceof WalkSessionError);
    assert.equal(failed.reason.code, 'revision-conflict');
    assert.equal((await readWalkSession(deps, 's1')).session.revision, 1);
    assert.equal(await repository.read(2, 's1'), null);
    deps.authenticate = async () => ({ memberId: 2 });
    assert.equal((await executeWalkCommand(deps, start)).session.revision, 0);
    assert.equal((await database.query('SELECT * FROM payload.walk_sessions')).rows.length, 2);
    // Account removal is not blocked by a new FK; orphaned sessions cannot be read.
    await database.exec('DELETE FROM payload.members WHERE id = 1');
    assert.equal(await repository.read(1, 's1'), null);
    assert.equal((await repository.read(2, 's1'))?.memberId, 2);
  } finally {
    await database.close();
    await payload.destroy();
  }
});
