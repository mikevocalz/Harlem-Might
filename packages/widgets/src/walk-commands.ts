import type { WalkSession, WalkSummary } from './contracts.ts';
import { WALK_ID_PATTERN, beginWalk, confirmStop, pauseWalk, resumeWalk, stopWalk, validateWalkSession } from './walk-session.ts';

/** Commands are private, ephemeral transport; never add them to public widget feeds. */
export const WALK_COMMAND_SCHEMA_VERSION = 1 as const;
interface CommandBase {
  schemaVersion: typeof WALK_COMMAND_SCHEMA_VERSION;
  commandId: string;
  sessionId: string;
}
export type WalkCommand = CommandBase & (
  | { type: 'start'; expectedRevision: null; walkId: string }
  | { type: 'pause' | 'resume'; expectedRevision: number }
  | { type: 'stop'; expectedRevision: number; confirmed: true }
  | { type: 'confirm-stop'; expectedRevision: number; stopId: string; confirmed: true }
);
export interface WalkCommandResponse {
  schemaVersion: typeof WALK_COMMAND_SCHEMA_VERSION;
  session: WalkSession;
  /** The exact command was already accepted; session is the latest authoritative state. */
  replayed: boolean;
}

export class WalkRevisionConflict extends Error {
  constructor() { super('Refresh the authoritative walk before sending a new command'); }
}

export function validateWalkCommand(value: unknown): asserts value is WalkCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid walk command');
  const c = value as Record<string, unknown>;
  const common = ['schemaVersion', 'commandId', 'sessionId', 'expectedRevision', 'type'];
  const extras = c.type === 'start' ? ['walkId'] : c.type === 'stop' ? ['confirmed']
    : c.type === 'confirm-stop' ? ['stopId', 'confirmed'] : [];
  const keys = [...common, ...extras];
  if (Object.keys(c).length !== keys.length || Object.keys(c).some(key => !keys.includes(key))
    || c.schemaVersion !== WALK_COMMAND_SCHEMA_VERSION
    || typeof c.type !== 'string' || !['start', 'pause', 'resume', 'stop', 'confirm-stop'].includes(c.type)
    || typeof c.commandId !== 'string' || !WALK_ID_PATTERN.test(c.commandId)
    || typeof c.sessionId !== 'string' || !WALK_ID_PATTERN.test(c.sessionId)
    || (c.type === 'start' ? c.expectedRevision !== null
      : !Number.isSafeInteger(c.expectedRevision) || (c.expectedRevision as number) < 0)
    || (c.type === 'start' && (typeof c.walkId !== 'string' || !WALK_ID_PATTERN.test(c.walkId)))
    || (c.type === 'confirm-stop' && (typeof c.stopId !== 'string' || !WALK_ID_PATTERN.test(c.stopId)))
    || ((c.type === 'stop' || c.type === 'confirm-stop') && c.confirmed !== true)) {
    throw new Error('Invalid walk command');
  }
}

/** Stable, bounded identity for duplicate detection; excludes no user-supplied fields. */
export function walkCommandFingerprint(command: WalkCommand): string {
  validateWalkCommand(command);
  return JSON.stringify(Object.keys(command).sort().map(key => [key, command[key as keyof WalkCommand]]));
}

/** Pure state transition. Transport must deduplicate command IDs before applying it. */
export function applyWalkCommand(
  session: WalkSession | null, command: WalkCommand, now: string, walk?: WalkSummary,
): WalkSession {
  validateWalkCommand(command);
  if (session) validateWalkSession(session);
  if (session && session.sessionId !== command.sessionId) throw new Error('Wrong walk session');
  if (command.type === 'start') {
    if (session) {
      if (session.walkId !== command.walkId) throw new Error('Session already belongs to another walk');
      return session;
    }
    if (!walk || walk.id !== command.walkId) throw new Error('Published walk required');
    return beginWalk(walk, command.sessionId, now);
  }
  if (!session) throw new Error('Walk session not found');
  if (session.revision !== command.expectedRevision) throw new WalkRevisionConflict();
  switch (command.type) {
    case 'pause': return pauseWalk(session, now);
    case 'resume': return resumeWalk(session, now);
    case 'stop': return stopWalk(session, now);
    case 'confirm-stop': return confirmStop(session, command.stopId, now);
  }
}
