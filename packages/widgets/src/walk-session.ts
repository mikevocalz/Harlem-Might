import { WIDGET_SCHEMA_VERSION, type WalkSession, type WalkSummary } from './contracts.js';

function validInstant(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function validateSession(s: WalkSession): void {
  if (!s.sessionId || !s.walkId || s.stopIds.length < 2 || !validInstant(s.updatedAt)) {
    throw new Error('Invalid walk session');
  }
  if (s.completedStopIds.length > s.stopIds.length ||
    !s.completedStopIds.every((id, index) => id === s.stopIds[index])) {
    throw new Error('Walk progress must be a confirmed ordered prefix');
  }
}

export function beginWalk(walk: WalkSummary, sessionId: string, now: string): WalkSession {
  if (!walk.published || walk.stopIds.length < 2 ||
      new Set(walk.stopIds).size !== walk.stopIds.length ||
      !sessionId || !validInstant(now)) {
    throw new Error('Cannot begin a walk from invalid or unpublished route data');
  }
  return {
    schemaVersion: WIDGET_SCHEMA_VERSION,
    sessionId, walkId: walk.id, walkSlug: walk.slug, walkTitle: walk.title,
    stopIds: [...walk.stopIds], completedStopIds: [], status: 'active',
    revision: 0, startedAt: now, updatedAt: now,
  };
}

export function nextStopId(session: WalkSession): string | null {
  validateSession(session);
  return session.stopIds[session.completedStopIds.length] ?? null;
}

function changeState(session: WalkSession, status: WalkSession['status'], now: string): WalkSession {
  validateSession(session);
  if (!validInstant(now)) throw new Error('Invalid timestamp');
  if (Date.parse(now) < Date.parse(session.updatedAt)) throw new Error('Stale walk update');
  return {...session, status, revision: session.revision + 1, updatedAt: now};
}

export function pauseWalk(session: WalkSession, now: string): WalkSession {
  if (session.status === 'completed') return session;
  return session.status === 'paused' ? session : changeState(session, 'paused', now);
}

export function resumeWalk(session: WalkSession, now: string): WalkSession {
  if (session.status === 'completed') return session;
  return session.status === 'active' ? session : changeState(session, 'active', now);
}

/**
 * Must be called only after explicit user confirmation or a separately
 * validated arrival event. Location permission alone must never complete a stop.
 */
export function confirmStop(session: WalkSession, stopId: string, now: string): WalkSession {
  validateSession(session);
  if (session.completedStopIds.includes(stopId)) return session; // idempotent re-delivery
  if (session.status !== 'active') throw new Error('Walk is not active');
  if (nextStopId(session) !== stopId) throw new Error('Cannot skip an unvisited stop');
  if (!validInstant(now) || Date.parse(now) < Date.parse(session.updatedAt)) {
    throw new Error('Stale or invalid confirmation');
  }
  const completedStopIds = [...session.completedStopIds, stopId];
  return {
    ...session, completedStopIds,
    status: completedStopIds.length === session.stopIds.length ? 'completed' : 'active',
    revision: session.revision + 1, updatedAt: now,
  };
}

/**
 * Merge paired-device snapshots from one session without losing confirmed
 * progress. On conflicting equal progress prefer highest revision; if tied,
 * the last updated record. Mismatched route definitions require a server
 * refresh instead of silently reconciling incompatible routes.
 */
export function reconcileWalkSessions(a: WalkSession, b: WalkSession): WalkSession {
  validateSession(a);
  validateSession(b);
  if (a.sessionId !== b.sessionId || a.walkId !== b.walkId ||
      a.stopIds.join('|') !== b.stopIds.join('|')) {
    throw new Error('Cannot reconcile different routes or sessions');
  }
  if (a.completedStopIds.length !== b.completedStopIds.length) {
    return a.completedStopIds.length > b.completedStopIds.length ? a : b;
  }
  if (a.revision !== b.revision) return a.revision > b.revision ? a : b;
  return Date.parse(a.updatedAt) >= Date.parse(b.updatedAt) ? a : b;
}
