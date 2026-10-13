import type { HarlemSpecsFrame, SpecsPresentation, SpecsSceneNode } from './experience.ts';

/**
 * Session-bounded transport contract for the Specs Mobile Kit adapter.
 * This is NOT a BLE connection and does not replace transport authentication.
 */
export interface SpecsHandoffSnapshot {
  schemaVersion: 1;
  handoffId: string;
  sessionId: string;
  revision: number;
  issuedAtMs: number;
  expiresAtMs: number;
  presentation: SpecsPresentation;
}

export interface SpecsHandoffCommand {
  schemaVersion: 1;
  handoffId: string;
  sessionId: string;
  commandId: string;
  expectedRevision: number;
  targetId: string;
  action: string;
  /** Explicit confirmation belongs to the trusted app; not generated from a gesture alone. */
  confirmed?: true;
}

export const MAX_SPECS_HANDOFF_BYTES = 12_288;
export const MAX_SPECS_HANDOFF_AGE_MS = 60_000;
export const MAX_SPECS_COMMANDS_PER_HANDOFF = 128;
const SNAPSHOT_KEYS = new Set(['schemaVersion', 'handoffId', 'sessionId', 'revision', 'issuedAtMs', 'expiresAtMs', 'presentation']);
const COMMAND_KEYS = new Set(['schemaVersion', 'handoffId', 'sessionId', 'commandId', 'expectedRevision', 'targetId', 'action', 'confirmed']);
const NODE_KEYS = new Set(['id', 'kind', 'parentId', 'position', 'rotation', 'scale', 'text', 'source', 'visible']);
const KINDS = new Set(['group', 'panel', 'text', 'image', 'model']);

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, max = 128): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function safeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** JS-only UTF-8 bound: works in Node, Hermes and Lens without Buffer. */
function utf8ByteLength(value: string): number {
  let length = 0;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    length += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return length;
}

function boundedWire(value: unknown): boolean {
  try {
    const json = JSON.stringify(value);
    return typeof json === 'string' && utf8ByteLength(json) <= MAX_SPECS_HANDOFF_BYTES;
  } catch {
    return false;
  }
}

function vec(value: unknown, length: number): boolean {
  return Array.isArray(value) && value.length === length &&
    value.every(v => typeof v === 'number' && Number.isFinite(v));
}

function validNode(value: unknown, seen: Set<string>): value is SpecsSceneNode {
  if (!object(value) || Object.keys(value).some(key => !NODE_KEYS.has(key)) ||
      !text(value.id, 80) || typeof value.kind !== 'string' || !KINDS.has(value.kind)) return false;
  if (value.parentId !== undefined && (!text(value.parentId, 80) || !seen.has(value.parentId))) return false;
  if (value.position !== undefined && !vec(value.position, 3)) return false;
  if (value.scale !== undefined && !vec(value.scale, 3)) return false;
  if (value.rotation !== undefined && !vec(value.rotation, 4)) return false;
  if (value.text !== undefined && (typeof value.text !== 'string' || value.text.length > 160)) return false;
  // Sources are logical registered asset IDs; external URLs cannot enter Lens assets.
  if (value.source !== undefined && (!text(value.source, 128) || (value.source as string).includes('://'))) return false;
  if (value.kind === 'model' && !text(value.source, 128)) return false;
  if (value.source !== undefined && value.kind !== 'image' && value.kind !== 'model') return false;
  if (value.text !== undefined && value.kind !== 'text') return false;
  if (value.visible !== undefined && typeof value.visible !== 'boolean') return false;
  return true;
}

function validAction(action: unknown): action is string {
  if (!text(action, 256)) return false;
  if (['close-place', 'close-directions', 'start-navigation',
    'resume-navigation', 'end-navigation'].includes(action)) return true;
  if (!action.startsWith('place:') && !action.startsWith('directions:')) return false;
  const encoded = action.slice(action.indexOf(':') + 1);
  try {
    const decoded = decodeURIComponent(encoded);
    return decoded.length > 0 && decoded.length <= 120 &&
      encodeURIComponent(decoded) === encoded;
  } catch {
    return false;
  }
}

function validPresentation(value: unknown): value is SpecsPresentation {
  if (!object(value) || Object.keys(value).some(key => !['scene', 'targets'].includes(key)) ||
      !object(value.scene) || Object.keys(value.scene).some(key => !['version', 'nodes'].includes(key)) ||
      value.scene.version !== 1 || !Array.isArray(value.scene.nodes) || value.scene.nodes.length < 1 ||
      value.scene.nodes.length > 32 || !Array.isArray(value.targets) ||
      value.targets.length > 4) return false;
  const seen = new Set<string>();
  for (const node of value.scene.nodes) {
    if (!validNode(node, seen) || seen.has(node.id)) return false;
    seen.add(node.id);
  }
  const targets = new Set<string>();
  for (const target of value.targets) {
    if (!object(target) || Object.keys(target).some(key => !['targetId', 'action'].includes(key)) ||
        !text(target.targetId, 80) || !seen.has(target.targetId) ||
        targets.has(target.targetId) || !validAction(target.action)) return false;
    targets.add(target.targetId);
  }
  return true;
}

/** Reject malformed, oversized, replayable or expired snapshots. */
export function isSpecsHandoffSnapshot(value: unknown, nowMs: number): value is SpecsHandoffSnapshot {
  if (!object(value) || Object.keys(value).some(key => !SNAPSHOT_KEYS.has(key)) ||
      value.schemaVersion !== 1 || !text(value.handoffId) || !text(value.sessionId) ||
      !safeInteger(value.revision) || !safeInteger(value.issuedAtMs) ||
      !safeInteger(value.expiresAtMs) || !Number.isFinite(nowMs) ||
      value.issuedAtMs > nowMs + 2_000 || nowMs - value.issuedAtMs > MAX_SPECS_HANDOFF_AGE_MS ||
      value.expiresAtMs <= nowMs || value.expiresAtMs <= value.issuedAtMs ||
      value.expiresAtMs - value.issuedAtMs > MAX_SPECS_HANDOFF_AGE_MS ||
      !validPresentation(value.presentation) || !boundedWire(value)) return false;
  return true;
}

/** Commands are untrusted until checked against the latest accepted snapshot. */
export function isSpecsHandoffCommand(value: unknown): value is SpecsHandoffCommand {
  return object(value) && Object.keys(value).every(key => COMMAND_KEYS.has(key)) &&
    value.schemaVersion === 1 && text(value.handoffId) && text(value.sessionId) &&
    text(value.commandId) && safeInteger(value.expectedRevision) &&
    text(value.targetId, 80) && validAction(value.action) &&
    (value.confirmed === undefined || value.confirmed === true) &&
    (value.action !== 'end-navigation' || value.confirmed === true) &&
    boundedWire(value);
}

/**
 * Never sends full app records, auth state or raw route geometry via BLE.
 * SpecsNavigationKit receives a separate gated, bounded route transfer.
 */
export function createSpecsHandoffSnapshot(input: {
  frame: HarlemSpecsFrame;
  handoffId: string;
  sessionId: string;
  revision: number;
  nowMs: number;
  lifetimeMs?: number;
}): SpecsHandoffSnapshot {
  const issuedAtMs = input.nowMs;
  const expiresAtMs = issuedAtMs + (input.lifetimeMs ?? 30_000);
  const snapshot: SpecsHandoffSnapshot = {
    schemaVersion: 1,
    handoffId: input.handoffId,
    sessionId: input.sessionId,
    revision: input.revision,
    issuedAtMs,
    expiresAtMs,
    presentation: {
      scene: input.frame.scene,
      targets: input.frame.targets,
    },
  };
  if (!isSpecsHandoffSnapshot(snapshot, issuedAtMs)) {
    throw new Error('Invalid, stale or oversized Specs snapshot.');
  }
  // The caller cannot mutate an already-approved payload after authorization.
  return JSON.parse(JSON.stringify(snapshot)) as SpecsHandoffSnapshot;
}

/**
 * Application-side replay and revision gate. Owner identity and permissions
 * must be checked by the app/transport BEFORE this gate is used.
 */
export class SpecsHandoffGate {
  private current: SpecsHandoffSnapshot | null = null;
  private readonly seen = new Set<string>();

  offer(snapshot: unknown, nowMs: number): boolean {
    if (!isSpecsHandoffSnapshot(snapshot, nowMs)) return false;
    if (this.current && snapshot.handoffId === this.current.handoffId &&
      snapshot.sessionId === this.current.sessionId) {
      if (snapshot.revision <= this.current.revision) return false;
    } else {
      this.seen.clear();
    }
    // Defensive copy: callers must not mutate targets after this gate accepts
    // the scene. The validator already proved the JSON shape and size.
    this.current = JSON.parse(JSON.stringify(snapshot)) as SpecsHandoffSnapshot;
    return true;
  }

  authorize(command: unknown, nowMs: number): string | null {
    const current = this.current;
    if (!current || !isSpecsHandoffSnapshot(current, nowMs) ||
      !isSpecsHandoffCommand(command) ||
      current.handoffId !== command.handoffId ||
      current.sessionId !== command.sessionId ||
      current.revision !== command.expectedRevision ||
      this.seen.has(command.commandId) ||
      this.seen.size >= MAX_SPECS_COMMANDS_PER_HANDOFF) return null;
    const permitted = current.presentation.targets.some(target =>
      target.targetId === command.targetId && target.action === command.action);
    if (!permitted) return null;
    this.seen.add(command.commandId);
    return command.action;
  }

  clear(): void {
    this.current = null;
    this.seen.clear();
  }
}
