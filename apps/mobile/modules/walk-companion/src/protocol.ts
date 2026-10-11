/** Private, ephemeral paired-device projection. Never pass a session object here. */
export interface CompanionSnapshot {
  schemaVersion: 1;
  handoffId: string;
  sessionId: string;
  revision: number;
  status: 'active' | 'paused' | 'completed' | 'stopped';
  walkTitle: string;
  nextStopId: string | null;
  nextStopTitle: string | null;
  completedCount: number;
  totalStops: number;
  updatedAt: string;
  expiresAt: string;
  routeState: 'ready' | 'offline' | 'unavailable';
  instruction: string | null;
  hapticsEnabled: boolean;
}

export interface CompanionCommand {
  schemaVersion: 1;
  commandId: string;
  sessionId: string;
  handoffId: string;
  expectedRevision: number;
  type: 'pause' | 'resume' | 'stop' | 'confirm-stop';
  confirmed?: true;
  stopId?: string;
}

export const MAX_HANDOFF_AGE_MS = 5 * 60 * 1000;
const snapshotKeys = new Set([
  'schemaVersion', 'handoffId', 'sessionId', 'revision', 'status', 'walkTitle',
  'nextStopId', 'nextStopTitle', 'completedCount', 'totalStops', 'updatedAt',
  'expiresAt', 'routeState', 'instruction', 'hapticsEnabled',
]);
const commandKeys = new Set([
  'schemaVersion', 'commandId', 'sessionId', 'handoffId', 'expectedRevision',
  'type', 'confirmed', 'stopId',
]);
const text = (v: unknown, max = 160): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function isCompanionSnapshot(value: unknown, now = Date.now()): value is CompanionSnapshot {
  if (!object(value) || Object.keys(value).some(key => !snapshotKeys.has(key))) return false;
  const s = value;
  if (s.schemaVersion !== 1 || !text(s.handoffId) || !text(s.sessionId) || !integer(s.revision) ||
    !text(s.walkTitle) || typeof s.status !== 'string' || !['active', 'paused', 'completed', 'stopped'].includes(s.status) ||
    !integer(s.completedCount) || !integer(s.totalStops) || s.totalStops < 1 || s.totalStops > 100 ||
    s.completedCount > s.totalStops || typeof s.hapticsEnabled !== 'boolean' ||
    typeof s.routeState !== 'string' || !['ready', 'offline', 'unavailable'].includes(s.routeState) ||
    !(s.nextStopId === null || text(s.nextStopId)) || !(s.nextStopTitle === null || text(s.nextStopTitle)) ||
    (s.nextStopId === null) !== (s.nextStopTitle === null) ||
    !(s.instruction === null || text(s.instruction, 500)) || !text(s.updatedAt) || !text(s.expiresAt)) return false;
  if ((s.status === 'completed') !== (s.completedCount === s.totalStops) ||
    (s.nextStopId !== null) !== (s.status === 'active' || s.status === 'paused') ||
    (s.routeState !== 'ready' && s.instruction !== null)) return false;
  const minimumRevision = s.completedCount + (s.status === 'paused' || s.status === 'stopped' ? 1 : 0);
  if (s.revision < minimumRevision) return false;
  const updated = Date.parse(s.updatedAt), expires = Date.parse(s.expiresAt);
  return Number.isFinite(now) && Number.isFinite(updated) && Number.isFinite(expires) &&
    updated <= now + 30_000 && expires > now && expires > updated &&
    expires - updated <= MAX_HANDOFF_AGE_MS && now - updated <= MAX_HANDOFF_AGE_MS;
}

export function isCompanionCommand(value: unknown): value is CompanionCommand {
  if (!object(value) || Object.keys(value).some(key => !commandKeys.has(key))) return false;
  const c = value;
  return c.schemaVersion === 1 && text(c.commandId) && text(c.sessionId) && text(c.handoffId) &&
    integer(c.expectedRevision) && typeof c.type === 'string' && ['pause', 'resume', 'stop', 'confirm-stop'].includes(c.type) &&
    (c.confirmed === undefined || c.confirmed === true) &&
    (!['stop', 'confirm-stop'].includes(c.type) || c.confirmed === true) &&
    (c.type === 'confirm-stop' ? text(c.stopId) : c.stopId === undefined);
}
