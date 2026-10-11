import assert from 'node:assert/strict';
import test from 'node:test';
import { applyWalkCommand, validateWalkCommand, walkCommandFingerprint, WalkRevisionConflict } from './walk-commands.ts';
import type { WalkCommand } from './walk-commands.ts';
import { beginWalk, confirmStop, nextStopId, reconcileWalkSessions, stopWalk, validateWalkSession } from './walk-session.ts';

const now = '2026-10-11T00:00:00.000Z';
const later = '2026-10-11T00:00:01.000Z';
const walk = { id: '12', slug: 'harlem', title: 'Harlem', stopIds: ['1', '2'], published: true, sourceUrl: 'https://example.com' };
const start: WalkCommand = { schemaVersion: 1, commandId: 'c1', sessionId: 's1', expectedRevision: null, type: 'start', walkId: '12' };
const command = (type: 'pause' | 'resume', expectedRevision = 0): Extract<WalkCommand, { type: 'pause' | 'resume' }> => ({ schemaVersion: 1, commandId: type, sessionId: 's1', expectedRevision, type });

test('versioned commands enforce exact keys, IDs, explicit confirmation and revisions at runtime', () => {
  validateWalkCommand(start);
  for (const bad of [null, [], {}, {...start, schemaVersion: 2}, {...start, memberId: 1},
    {...start, token: 'secret'}, {...start, expectedRevision: 0}, {...start, walkId: '../walk'},
    {...start, commandId: ''}, {...command('pause'), expectedRevision: -1},
    {...command('pause'), expectedRevision: 1.2}, {...command('pause'), expectedRevision: NaN},
    {...command('pause'), expectedRevision: Number.MAX_SAFE_INTEGER + 1},
    {...command('pause'), type: 'confirm-stop', stopId: '1'},
    {...command('pause'), type: 'stop', confirmed: false},
    {...command('pause'), type: 'stop', confirmed: true, stopId: '1'},
  ]) assert.throws(() => validateWalkCommand(bad));
  assert.equal(walkCommandFingerprint(start), walkCommandFingerprint({...start}));
});

test('runtime snapshots reject malformed, extra, inconsistent or future data even on no-op paths', () => {
  const session = beginWalk(walk, 's1', now);
  for (const bad of [{...session, schemaVersion: 2}, {...session, token: 'secret'}, {...session, revision: -1},
    {...session, stopIds: ['1', '1']}, {...session, completedStopIds: ['2']},
    {...session, completedStopIds: ['1', '2']}, {...session, status: 'completed'},
    {...session, updatedAt: '2026-02-30T00:00:00Z'}, {...session, updatedAt: '2026-10-10T00:00:00Z'},
    {...session, startedAt: 'yesterday'}, {...session, status: 'invented'},
  ]) assert.throws(() => validateWalkSession(bad));
  assert.throws(() => applyWalkCommand({...session, revision: -1}, command('resume'), later));
});

test('start/pause/resume/stop and explicit ordered confirmation preserve revision semantics', () => {
  const s = applyWalkCommand(null, start, now, walk);
  assert.equal(s.revision, 0);
  assert.equal(applyWalkCommand(s, start, later), s);
  const paused = applyWalkCommand(s, command('pause'), later);
  assert.equal(paused.revision, 1);
  assert.equal(applyWalkCommand(paused, command('pause', 1), later), paused);
  assert.throws(() => applyWalkCommand(paused, command('resume'), later), WalkRevisionConflict);
  const resumed = applyWalkCommand(paused, command('resume', 1), later);
  const stopped = applyWalkCommand(resumed, { ...command('pause', 2), type: 'stop', confirmed: true }, later);
  assert.equal(stopped.status, 'stopped');
  assert.equal(nextStopId(stopped), null);
  assert.equal(applyWalkCommand(stopped, command('resume', 3), later), stopped);
  assert.equal(stopWalk(stopped, later), stopped);
  assert.throws(() => confirmStop(stopped, '1', later));
  assert.throws(() => applyWalkCommand(null, start, now, {...walk, published: false}));
  assert.throws(() => applyWalkCommand(s, {...command('pause'), sessionId: 'other'}, later));
});

test('reconciliation never revives a cancelled session or guesses equal-revision conflicts', () => {
  const s = beginWalk(walk, 's1', now);
  const stopped = stopWalk(s, later);
  const progressed = confirmStop(s, '1', later);
  assert.equal(reconcileWalkSessions(s, stopped), stopped);
  assert.throws(() => reconcileWalkSessions(stopped, progressed));
  assert.throws(() => reconcileWalkSessions(stopped, {...progressed, revision: 2}));
  assert.throws(() => reconcileWalkSessions(progressed, {...s, revision: 2, updatedAt: later}));
  assert.throws(() => reconcileWalkSessions(s, {...s, stopIds: ['1', '3']}));
});
