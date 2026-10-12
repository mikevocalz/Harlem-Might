import {
  LIGHTCYCLE_ARENA_HALF,
  type LightCycleDerezEvent,
  type LightCycleMatchConfig,
  type LightCycleMatchState,
  type LightCyclePlayerId,
  type LightCyclePoint,
  type LightCycleRiderState,
  type LightCycleTrailSegment,
} from './tabletopCore.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

function isPlayerId(value: unknown): value is LightCyclePlayerId {
  return value === 'p1' || value === 'p2';
}

function isPoint(value: unknown): value is LightCyclePoint {
  return isRecord(value) &&
    isInteger(value.x, -LIGHTCYCLE_ARENA_HALF, LIGHTCYCLE_ARENA_HALF) &&
    isInteger(value.z, -LIGHTCYCLE_ARENA_HALF, LIGHTCYCLE_ARENA_HALF);
}

function isAxisAligned(from: LightCyclePoint, to: LightCyclePoint) {
  return from.x === to.x || from.z === to.z;
}

function isConfig(value: unknown): value is LightCycleMatchConfig {
  return isRecord(value) &&
    (value.roundsToWin === 3 || value.roundsToWin === 5 || value.roundsToWin === 7) &&
    isInteger(value.baseStepUnits, 1) &&
    isInteger(value.boostStepUnits, 1) &&
    isInteger(value.boostDrainPerTick) &&
    isInteger(value.boostRegenPerTick) &&
    isInteger(value.turnCooldownTicks) &&
    isInteger(value.countdownTicks) &&
    isInteger(value.roundOverTicks);
}

function isRider(
  value: unknown,
  id: LightCyclePlayerId,
  config: LightCycleMatchConfig,
  tick: number,
): value is LightCycleRiderState {
  return isRecord(value) &&
    value.id === id &&
    typeof value.name === 'string' &&
    // Names are normalized to at most 16 code points by the deterministic core.
    value.name.length <= 32 && Array.from(value.name).length <= 16 &&
    isPoint(value.position) &&
    isPoint(value.segmentStart) &&
    isAxisAligned(value.position, value.segmentStart) &&
    isInteger(value.direction, 0, 3) &&
    typeof value.alive === 'boolean' &&
    isInteger(value.energy, 0, 1000) &&
    isInteger(value.speedUnitsPerTick, 0, Math.max(config.baseStepUnits, config.boostStepUnits)) &&
    isInteger(value.turnCooldownTicks, 0, config.turnCooldownTicks) &&
    isInteger(value.wheelAngleMilliRad, 0, Math.round(Math.PI * 2 * 1000) - 1) &&
    (value.lastTurn === -1 || value.lastTurn === 0 || value.lastTurn === 1) &&
    isInteger(value.lastTurnTick, -1, tick);
}

function isTrail(
  value: unknown,
  tick: number,
  nextTrailId: number,
): value is LightCycleTrailSegment {
  return isRecord(value) &&
    isInteger(value.id, 1, nextTrailId - 1) &&
    isPlayerId(value.owner) &&
    isPoint(value.from) &&
    isPoint(value.to) &&
    isAxisAligned(value.from, value.to) &&
    isInteger(value.createdTick, 0, tick);
}

function isDerezEvent(value: unknown, tick: number): value is LightCycleDerezEvent {
  return isRecord(value) &&
    isPlayerId(value.playerId) &&
    isInteger(value.tick, 0, tick) &&
    isPoint(value.point) &&
    (value.cause === 'boundary' || value.cause === 'own-trail' ||
      value.cause === 'opponent-trail' || value.cause === 'head-on' ||
      value.cause === 'head-swap' || value.cause === 'crossing') &&
    (value.byPlayerId === null || isPlayerId(value.byPlayerId)) &&
    isInteger(value.seed, 0, 0xffff_ffff);
}

/**
 * The native race and Rive scoreboard consume the same complete host snapshot.
 * Reject truncated or malformed payloads before geometry, effects or text reach
 * native consumers. This checks the wire shape and core numeric ranges, without
 * mutating, normalizing or advancing the authoritative state. It accepts positive
 * integer movement rates and nonnegative integer timers/rates, including zero
 * timers and boost rates below the base speed. This is a shape/range boundary,
 * not an anti-cheat validator or a substitute for transport payload limits.
 */
export function isLightCycleMatchState(value: unknown): value is LightCycleMatchState {
  if (!isRecord(value) || !isConfig(value.config) ||
    !isInteger(value.tick) || !isInteger(value.round, 1) ||
    !isInteger(value.seed, Number.MIN_SAFE_INTEGER) ||
    !isInteger(value.countdownTicks, 0, value.config.countdownTicks) ||
    !isInteger(value.roundOverTicks, 0, value.config.roundOverTicks) ||
    !isInteger(value.nextTrailId, 1) ||
    (value.phase !== 'countdown' && value.phase !== 'running' &&
      value.phase !== 'round-over' && value.phase !== 'match-over') ||
    !isRecord(value.riders) ||
    !isRider(value.riders.p1, 'p1', value.config, value.tick) ||
    !isRider(value.riders.p2, 'p2', value.config, value.tick) ||
    !isRecord(value.scores) ||
    !isInteger(value.scores.p1, 0, value.config.roundsToWin) ||
    !isInteger(value.scores.p2, 0, value.config.roundsToWin) ||
    (value.roundWinner !== null && value.roundWinner !== 'draw' && !isPlayerId(value.roundWinner)) ||
    (value.matchWinner !== null && !isPlayerId(value.matchWinner)) ||
    !Array.isArray(value.trails) || value.trails.length > value.nextTrailId - 1 ||
    !Array.isArray(value.derezEvents) || value.derezEvents.length > 2
  ) return false;

  // for...of also checks sparse entries, which Array.every would silently skip.
  for (const trail of value.trails) {
    if (!isTrail(trail, value.tick, value.nextTrailId)) return false;
  }
  for (const event of value.derezEvents) {
    if (!isDerezEvent(event, value.tick)) return false;
  }
  return true;
}

export function readLightCycleMatchState(value: unknown): LightCycleMatchState | null {
  return isLightCycleMatchState(value) ? value : null;
}
