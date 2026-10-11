import { applyWalkCommand, validateWalkCommand, walkCommandFingerprint, WalkRevisionConflict } from '@acme/widgets/walk-commands';
import { validateWalkSession } from '@acme/widgets/walk-session';
import type { WalkCommandResponse } from '@acme/widgets/walk-commands';
import type { WalkSession, WalkSummary } from '@acme/widgets/contracts';

export interface VerifiedWalkMember { memberId: number }
export interface WalkCommandReceipt { commandId: string; fingerprint: string }
export interface StoredWalkSession {
  memberId: number;
  session: WalkSession;
  /** Internal CAS sequence also advances for acknowledged no-op commands. */
  generation: number;
  receipts: WalkCommandReceipt[];
}
export interface WalkSessionRepository {
  read(memberId: number, sessionId: string): Promise<StoredWalkSession | null>;
  insert(record: StoredWalkSession): Promise<boolean>;
  compareAndSwap(record: StoredWalkSession, expectedGeneration: number): Promise<boolean>;
}
export interface WalkSessionDependencies {
  /** Must revalidate the current request against the auth database; never accept body identity. */
  authenticate(): Promise<VerifiedWalkMember | null>;
  repository: WalkSessionRepository;
  loadPublishedWalk(walkId: string): Promise<WalkSummary | null>;
  now(): string;
}
export class WalkSessionError extends Error {
  readonly status: number;
  readonly code: string;
  readonly session?: WalkSession;
  constructor(status: number, code: string, session?: WalkSession) {
    super(code);
    this.status = status;
    this.code = code;
    this.session = session;
  }
}

// Bound per-session storage without forgetting old command IDs. A final stop is reserved.
export const MAX_WALK_COMMANDS = 1024;
const validId = /^[A-Za-z0-9_-]{1,128}$/;

async function requireMember(deps: WalkSessionDependencies): Promise<number> {
  const member = await deps.authenticate();
  if (!member || !Number.isSafeInteger(member.memberId) || member.memberId <= 0) {
    throw new WalkSessionError(401, 'sign-in-required');
  }
  return member.memberId;
}

async function requireSameMember(deps: WalkSessionDependencies, memberId: number): Promise<void> {
  if (await requireMember(deps) !== memberId) throw new WalkSessionError(401, 'sign-in-required');
}

function validateStored(record: StoredWalkSession | null, memberId: number, sessionId: string): void {
  if (!record) return;
  validateWalkSession(record.session);
  if (record.memberId !== memberId || record.session.sessionId !== sessionId
    || !Number.isSafeInteger(record.generation) || record.generation < 0
    || !Array.isArray(record.receipts) || record.receipts.length > MAX_WALK_COMMANDS + 1
    || new Set(record.receipts.map(receipt => receipt.commandId)).size !== record.receipts.length
    || record.receipts.some(receipt => !validId.test(receipt.commandId)
      || typeof receipt.fingerprint !== 'string' || receipt.fingerprint.length > 2048)) {
    throw new WalkSessionError(503, 'session-unavailable');
  }
}

async function readOwnedSession(deps: WalkSessionDependencies, memberId: number, sessionId: string): Promise<StoredWalkSession | null> {
  const record = await deps.repository.read(memberId, sessionId);
  // Storage I/O can outlive the login that authorized it. This applies to all
  // private snapshots, including replay and conflict responses on the last retry.
  await requireSameMember(deps, memberId);
  validateStored(record, memberId, sessionId);
  return record;
}

export async function readWalkSession(deps: WalkSessionDependencies, sessionId: string): Promise<WalkCommandResponse> {
  const memberId = await requireMember(deps);
  if (!validId.test(sessionId)) throw new WalkSessionError(400, 'invalid-session-id');
  const record = await readOwnedSession(deps, memberId, sessionId);
  if (!record) throw new WalkSessionError(404, 'session-not-found');
  return { schemaVersion: 1, session: record.session, replayed: false };
}

export async function executeWalkCommand(deps: WalkSessionDependencies, input: unknown): Promise<WalkCommandResponse> {
  const memberId = await requireMember(deps);
  try { validateWalkCommand(input); } catch { throw new WalkSessionError(400, 'invalid-command'); }
  const command = input;
  const fingerprint = walkCommandFingerprint(command);
  let record = await readOwnedSession(deps, memberId, command.sessionId);
  for (let attempt = 0; attempt < 3; attempt++) {
    const receipt = record?.receipts.find(item => item.commandId === command.commandId);
    if (receipt) {
      if (receipt.fingerprint !== fingerprint) throw new WalkSessionError(409, 'command-id-conflict');
      return { schemaVersion: 1, session: record!.session, replayed: true };
    }
    if (record && (record.receipts.length > MAX_WALK_COMMANDS
      || (record.receipts.length === MAX_WALK_COMMANDS && command.type !== 'stop'))) {
      throw new WalkSessionError(409, 'command-limit', record.session);
    }
    if (command.type !== 'start' && !record) throw new WalkSessionError(404, 'session-not-found');
    const walk = !record && command.type === 'start' ? await deps.loadPublishedWalk(command.walkId) : undefined;
    if (!record && !walk) throw new WalkSessionError(404, 'published-walk-not-found');
    let session: WalkSession;
    try {
      session = applyWalkCommand(record?.session ?? null, command, deps.now(), walk ?? undefined);
    } catch (error) {
      if (error instanceof WalkRevisionConflict) throw new WalkSessionError(409, 'revision-conflict', record!.session);
      throw new WalkSessionError(409, 'invalid-transition', record?.session);
    }
    const next: StoredWalkSession = {
      memberId, session, generation: record ? record.generation + 1 : 0,
      receipts: [...(record?.receipts ?? []), { commandId: command.commandId, fingerprint }],
    };
    // Recheck after I/O, immediately before mutation. A revoked login cannot replay a queued command.
    await requireSameMember(deps, memberId);
    const accepted = record
      ? await deps.repository.compareAndSwap(next, record.generation)
      : await deps.repository.insert(next);
    // An already committed write is not undone, but a revoked request must not
    // receive its private result. The receipt makes a later authorized retry safe.
    await requireSameMember(deps, memberId);
    if (accepted) return { schemaVersion: 1, session, replayed: false };
    record = await readOwnedSession(deps, memberId, command.sessionId);
  }
  throw new WalkSessionError(409, 'revision-conflict', record?.session);
}
