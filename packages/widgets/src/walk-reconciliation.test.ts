import assert from 'node:assert/strict';
import test from 'node:test';
import type { WalkSession } from './contracts.ts';
import { beginWalk, confirmStop, nextStopId, pauseWalk, reconcileWalkSessions, resumeWalk, stopWalk } from './walk-session.ts';

const now = '2026-10-13T00:00:00.000Z';
const walk = { id: 'walk', slug: 'harlem', title: 'Harlem', stopIds: ['a', 'b', 'c'], published: true, sourceUrl: 'https://example.com' };
const start = () => beginWalk(walk, 'session', now);
const key = (session: WalkSession) => `${session.revision}:${session.status}:${session.completedStopIds.length}`;

function commands(session: WalkSession): WalkSession[] {
  const results = [pauseWalk(session, now), resumeWalk(session, now), stopWalk(session, now)];
  const next = nextStopId(session);
  if (session.status === 'active' && next) results.push(confirmStop(session, next, now));
  return results.filter((result) => result.revision > session.revision);
}

function reachableFrom(session: WalkSession, maximumRevision: number): Map<string, WalkSession> {
  const found = new Map([[key(session), session]]);
  const queue = [session];
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index]!;
    if (current.revision >= maximumRevision) continue;
    for (const next of commands(current)) {
      if (!found.has(key(next))) { found.set(key(next), next); queue.push(next); }
    }
  }
  return found;
}

function rejectsBoth(a: WalkSession, b: WalkSession) {
  assert.throws(() => reconcileWalkSessions(a, b), /Conflicting walk history/);
  assert.throws(() => reconcileWalkSessions(b, a), /Conflicting walk history/);
}

test('reconciliation rejects a branch that cannot resume and confirm within its revision gap', () => {
  const initial = start();
  const paused = pauseWalk(initial, now);
  const progressed = confirmStop(confirmStop(initial, 'a', now), 'b', now);
  rejectsBoth(paused, progressed);
});

test('reconciliation rejects extra progress that exceeds the revision gap', () => {
  const initial = start();
  const cycled = resumeWalk(pauseWalk(initial, now), now);
  const finished = confirmStop(confirmStop(confirmStop(initial, 'a', now), 'b', now), 'c', now);
  rejectsBoth(cycled, finished);
});

test('reconciliation rejects incompatible pause/resume parity from public histories', () => {
  const initial = start();
  const paused = pauseWalk(initial, now);
  const progressedAndPaused = pauseWalk(confirmStop(initial, 'a', now), now);
  rejectsBoth(paused, progressedAndPaused);
});

test('reconciliation rejects later terminal revisions, including greater stopped progress', () => {
  const initial = start();
  rejectsBoth(stopWalk(initial, now), stopWalk(confirmStop(initial, 'a', now), now));
  const finish = (session: WalkSession) => confirmStop(confirmStop(confirmStop(session, 'a', now), 'b', now), 'c', now);
  rejectsBoth(finish(initial), finish(resumeWalk(pauseWalk(initial, now), now)));
});

test('stopping from either active or paused state permits both revision parities', () => {
  for (const older of [start(), pauseWalk(start(), now)]) {
    let active = older.status === 'paused' ? resumeWalk(older, now) : older;
    for (let cycles = 0; cycles < 3; cycles++) {
      for (const newer of [stopWalk(active, now), stopWalk(pauseWalk(active, now), now)]) {
        assert.equal(reconcileWalkSessions(older, newer), newer);
        assert.equal(reconcileWalkSessions(newer, older), newer);
      }
      active = resumeWalk(pauseWalk(active, now), now);
    }
  }
});

test('reconciliation agrees with exhaustive public-command reachability across bounded histories', () => {
  const states = [...reachableFrom(start(), 10).values()];
  for (const older of states) {
    const reachable = reachableFrom(older, 10);
    for (const newer of states) {
      if (newer.revision <= older.revision) continue;
      const message = `${key(older)} -> ${key(newer)}`;
      if (reachable.has(key(newer))) {
        assert.equal(reconcileWalkSessions(older, newer), newer, message);
        assert.equal(reconcileWalkSessions(newer, older), newer, message);
      } else {
        assert.throws(() => reconcileWalkSessions(older, newer), /Conflicting walk history/, message);
        assert.throws(() => reconcileWalkSessions(newer, older), /Conflicting walk history/, message);
      }
    }
  }
});

test('large valid revision gaps are checked without replaying commands', () => {
  const initial = start();
  const resumed = { ...initial, revision: Number.MAX_SAFE_INTEGER - 1 };
  assert.equal(reconcileWalkSessions(initial, resumed), resumed);
  rejectsBoth(initial, { ...initial, revision: Number.MAX_SAFE_INTEGER });
  assert.equal(reconcileWalkSessions(initial, { ...resumed, status: 'paused', revision: Number.MAX_SAFE_INTEGER }).status, 'paused');
});
