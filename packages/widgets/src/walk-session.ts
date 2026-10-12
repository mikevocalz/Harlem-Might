import { WIDGET_SCHEMA_VERSION, type WalkSession, type WalkSummary } from './contracts.ts';

export const WALK_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
export const MAX_WALK_STOPS = 100;

function validInstant(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value.replace(/Z$/, value.includes('.') ? 'Z' : '.000Z');
}

function validIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(id => typeof id === 'string' && WALK_ID_PATTERN.test(id));
}

/** Validate untrusted snapshots before using them, including cached/native input. */
export function validateWalkSession(value: unknown): asserts value is WalkSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid walk session');
  const s = value as Record<string, unknown>;
  const keys = ['schemaVersion', 'sessionId', 'walkId', 'walkSlug', 'walkTitle', 'stopIds',
    'completedStopIds', 'status', 'revision', 'startedAt', 'updatedAt'];
  if (Object.keys(s).some(key => !keys.includes(key)) || Object.keys(s).length !== keys.length
    || s.schemaVersion !== WIDGET_SCHEMA_VERSION
    || typeof s.sessionId !== 'string' || !WALK_ID_PATTERN.test(s.sessionId)
    || typeof s.walkId !== 'string' || !WALK_ID_PATTERN.test(s.walkId)
    || typeof s.walkSlug !== 'string' || !WALK_ID_PATTERN.test(s.walkSlug)
    || typeof s.walkTitle !== 'string' || !s.walkTitle.trim() || s.walkTitle.length > 300
    || !validIds(s.stopIds) || s.stopIds.length < 2 || s.stopIds.length > MAX_WALK_STOPS
    || new Set(s.stopIds).size !== s.stopIds.length || !validIds(s.completedStopIds)
    || typeof s.status !== 'string' || !['active', 'paused', 'completed', 'stopped'].includes(s.status)
    || !Number.isSafeInteger(s.revision) || (s.revision as number) < 0
    || !validInstant(s.startedAt) || !validInstant(s.updatedAt)
    || Date.parse(s.updatedAt) < Date.parse(s.startedAt)) throw new Error('Invalid walk session');
  if (s.completedStopIds.length > s.stopIds.length
    || !s.completedStopIds.every((id, index) => id === (s.stopIds as string[])[index])
    || (s.status === 'completed') !== (s.completedStopIds.length === s.stopIds.length)) {
    throw new Error('Walk progress must be a confirmed ordered prefix');
  }
  // Each confirmation advances the revision; pausing or stopping needs another command.
  const minimumRevision = s.completedStopIds.length + (s.status === 'paused' || s.status === 'stopped' ? 1 : 0);
  if ((s.revision as number) < minimumRevision) {
    throw new Error('Walk revision cannot precede confirmed progress or status');
  }
}

export function beginWalk(walk: WalkSummary, sessionId: string, now: string): WalkSession {
  if (!walk || walk.published !== true) throw new Error('Cannot begin an unpublished walk');
  const session: WalkSession = {
    schemaVersion: WIDGET_SCHEMA_VERSION,
    sessionId, walkId: walk.id, walkSlug: walk.slug, walkTitle: walk.title,
    stopIds: [...walk.stopIds], completedStopIds: [], status: 'active',
    revision: 0, startedAt: now, updatedAt: now,
  };
  validateWalkSession(session);
  return session;
}

export function nextStopId(session: WalkSession): string | null {
  validateWalkSession(session);
  return session.status === 'stopped' ? null : session.stopIds[session.completedStopIds.length] ?? null;
}

function validateUpdate(session: WalkSession, now: string): void {
  validateWalkSession(session);
  if (!validInstant(now) || Date.parse(now) < Date.parse(session.updatedAt)) {
    throw new Error('Stale or invalid walk update');
  }
  if (session.revision === Number.MAX_SAFE_INTEGER) throw new Error('Walk revision exhausted');
}

function changeState(session: WalkSession, status: WalkSession['status'], now: string): WalkSession {
  return {...session, status, revision: session.revision + 1, updatedAt: now};
}

export function pauseWalk(session: WalkSession, now: string): WalkSession {
  validateUpdate(session, now);
  return session.status === 'active' ? changeState(session, 'paused', now) : session;
}

export function resumeWalk(session: WalkSession, now: string): WalkSession {
  validateUpdate(session, now);
  return session.status === 'paused' ? changeState(session, 'active', now) : session;
}

/** Terminal cancellation; it can never be resumed or merged back into an active walk. */
export function stopWalk(session: WalkSession, now: string): WalkSession {
  validateUpdate(session, now);
  return session.status === 'active' || session.status === 'paused' ? changeState(session, 'stopped', now) : session;
}

/** Only explicit user confirmation completes a stop. Arrival signals are advisory. */
export function confirmStop(session: WalkSession, stopId: string, now: string): WalkSession {
  validateUpdate(session, now);
  if (session.completedStopIds.includes(stopId)) return session;
  if (session.status !== 'active') throw new Error('Walk is not active');
  if (nextStopId(session) !== stopId) throw new Error('Cannot skip an unvisited stop');
  const completedStopIds = [...session.completedStopIds, stopId];
  return {
    ...session, completedStopIds,
    status: completedStopIds.length === session.stopIds.length ? 'completed' : 'active',
    revision: session.revision + 1, updatedAt: now,
  };
}

/** Only reconcile linear histories. A divergent snapshot needs authoritative refresh. */
export function reconcileWalkSessions(a: WalkSession, b: WalkSession): WalkSession {
  validateWalkSession(a);
  validateWalkSession(b);
  if (a.sessionId !== b.sessionId || a.walkId !== b.walkId || a.startedAt !== b.startedAt
    || a.walkSlug !== b.walkSlug || a.walkTitle !== b.walkTitle
    || JSON.stringify(a.stopIds) !== JSON.stringify(b.stopIds)) {
    throw new Error('Cannot reconcile different routes or sessions');
  }
  if (a.revision === b.revision) {
    if (a.status !== b.status || a.updatedAt !== b.updatedAt
      || JSON.stringify(a.completedStopIds) !== JSON.stringify(b.completedStopIds)) {
      throw new Error('Conflicting walk revision; refresh the authoritative session');
    }
    return a;
  }
  const older = a.revision < b.revision ? a : b;
  const newer = older === a ? b : a;
  if (newer.completedStopIds.length < older.completedStopIds.length
    || Date.parse(newer.updatedAt) < Date.parse(older.updatedAt)
    || (['stopped', 'completed'].includes(older.status) && newer.status !== older.status)) {
    throw new Error('Conflicting walk history; refresh the authoritative session');
  }
  return newer;
}
