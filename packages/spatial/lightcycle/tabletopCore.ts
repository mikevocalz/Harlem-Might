export const LIGHTCYCLE_FIXED_HZ = 60;
export const LIGHTCYCLE_FIXED_STEP_MS = 1000 / LIGHTCYCLE_FIXED_HZ;
export const LIGHTCYCLE_UNIT_SCALE = 1000;
export const LIGHTCYCLE_ARENA_HALF = 24 * LIGHTCYCLE_UNIT_SCALE;

export type LightCyclePlayerId = 'p1' | 'p2';
export type LightCycleDirection = 0 | 1 | 2 | 3;
export type LightCycleTurn = -1 | 0 | 1;
export type LightCyclePhase =
  | 'countdown'
  | 'running'
  | 'round-over'
  | 'match-over';
export type LightCycleCrashCause =
  | 'boundary'
  | 'own-trail'
  | 'opponent-trail'
  | 'head-on'
  | 'head-swap'
  | 'crossing';

export type LightCyclePoint = { x: number; z: number };

export type LightCycleTrailSegment = {
  id: number;
  owner: LightCyclePlayerId;
  from: LightCyclePoint;
  to: LightCyclePoint;
  createdTick: number;
};

export type LightCycleRiderState = {
  id: LightCyclePlayerId;
  name: string;
  position: LightCyclePoint;
  segmentStart: LightCyclePoint;
  direction: LightCycleDirection;
  alive: boolean;
  energy: number;
  speedUnitsPerTick: number;
  turnCooldownTicks: number;
  wheelAngleMilliRad: number;
  lastTurn: LightCycleTurn;
  lastTurnTick: number;
};

export type LightCycleDerezEvent = {
  playerId: LightCyclePlayerId;
  tick: number;
  point: LightCyclePoint;
  cause: LightCycleCrashCause;
  byPlayerId: LightCyclePlayerId | null;
  seed: number;
};

export type LightCycleMatchConfig = {
  roundsToWin: 3 | 5 | 7;
  baseStepUnits: number;
  boostStepUnits: number;
  boostDrainPerTick: number;
  boostRegenPerTick: number;
  turnCooldownTicks: number;
  countdownTicks: number;
  roundOverTicks: number;
};

export type LightCycleTickInput = {
  turn?: LightCycleTurn;
  boost?: boolean;
};

export type LightCycleTickInputs = Partial<
  Record<LightCyclePlayerId, LightCycleTickInput>
>;

export type LightCycleMatchState = {
  config: LightCycleMatchConfig;
  phase: LightCyclePhase;
  tick: number;
  round: number;
  seed: number;
  countdownTicks: number;
  roundOverTicks: number;
  nextTrailId: number;
  riders: Record<LightCyclePlayerId, LightCycleRiderState>;
  trails: LightCycleTrailSegment[];
  scores: Record<LightCyclePlayerId, number>;
  roundWinner: LightCyclePlayerId | 'draw' | null;
  matchWinner: LightCyclePlayerId | null;
  derezEvents: LightCycleDerezEvent[];
};

export type LightCycleInputEvent = {
  playerId: LightCyclePlayerId;
  sequence: number;
  targetTick: number;
  command: 'TURN_LEFT' | 'TURN_RIGHT' | 'BOOST_DOWN' | 'BOOST_UP';
};

export const DEFAULT_LIGHTCYCLE_CONFIG: LightCycleMatchConfig = {
  roundsToWin: 5,
  baseStepUnits: 140,
  boostStepUnits: 224,
  boostDrainPerTick: 12,
  boostRegenPerTick: 4,
  turnCooldownTicks: 3,
  countdownTicks: LIGHTCYCLE_FIXED_HZ * 3,
  roundOverTicks: Math.round(LIGHTCYCLE_FIXED_HZ * 1.25),
};

const PLAYER_IDS: LightCyclePlayerId[] = ['p1', 'p2'];
const TAU_MILLIRAD = Math.round(Math.PI * 2 * 1000);
const WHEEL_RADIUS_UNITS = 380;

const DIRECTIONS: Record<LightCycleDirection, LightCyclePoint> = {
  0: { x: 0, z: -1 },
  1: { x: 1, z: 0 },
  2: { x: 0, z: 1 },
  3: { x: -1, z: 0 },
};

function point(x: number, z: number): LightCyclePoint {
  return { x, z };
}

function copyPoint(value: LightCyclePoint): LightCyclePoint {
  return { x: value.x, z: value.z };
}

function assertInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must stay an integer; got ${value}`);
  }
}

function makeRider(
  id: LightCyclePlayerId,
  name: string,
  position: LightCyclePoint,
  direction: LightCycleDirection,
  config: LightCycleMatchConfig,
): LightCycleRiderState {
  return {
    id,
    name,
    position: copyPoint(position),
    segmentStart: copyPoint(position),
    direction,
    alive: true,
    energy: 1000,
    speedUnitsPerTick: config.baseStepUnits,
    turnCooldownTicks: 0,
    wheelAngleMilliRad: 0,
    lastTurn: 0,
    lastTurnTick: -1,
  };
}

function roundSpawns(round: number) {
  const z = round % 2 === 1 ? -8_000 : 8_000;
  return {
    p1: { position: point(-12_000, z), direction: 1 as LightCycleDirection },
    p2: { position: point(12_000, -z), direction: 3 as LightCycleDirection },
  };
}

function createRound(
  round: number,
  names: Record<LightCyclePlayerId, string>,
  scores: Record<LightCyclePlayerId, number>,
  seed: number,
  config: LightCycleMatchConfig,
): LightCycleMatchState {
  const spawns = roundSpawns(round);
  return {
    config,
    phase: 'countdown',
    tick: 0,
    round,
    seed,
    countdownTicks: config.countdownTicks,
    roundOverTicks: 0,
    nextTrailId: 1,
    riders: {
      p1: makeRider('p1', names.p1, spawns.p1.position, spawns.p1.direction, config),
      p2: makeRider('p2', names.p2, spawns.p2.position, spawns.p2.direction, config),
    },
    trails: [],
    scores: { ...scores },
    roundWinner: null,
    matchWinner: null,
    derezEvents: [],
  };
}

export function createLightCycleMatch(options?: {
  seed?: number;
  names?: Partial<Record<LightCyclePlayerId, string>>;
  config?: Partial<LightCycleMatchConfig>;
}): LightCycleMatchState {
  const config = { ...DEFAULT_LIGHTCYCLE_CONFIG, ...(options?.config ?? {}) };
  const names = {
    p1: normalizePlayerName(options?.names?.p1 ?? 'PLAYER 1'),
    p2: normalizePlayerName(options?.names?.p2 ?? 'PLAYER 2'),
  };
  return createRound(1, names, { p1: 0, p2: 0 }, options?.seed ?? 1982, config);
}

export function normalizePlayerName(value: string): string {
  const normalized = value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (normalized.length === 0) return '';
  return Array.from(normalized).slice(0, 16).join('');
}

function cloneState(current: LightCycleMatchState): LightCycleMatchState {
  return {
    ...current,
    config: { ...current.config },
    riders: {
      p1: {
        ...current.riders.p1,
        position: copyPoint(current.riders.p1.position),
        segmentStart: copyPoint(current.riders.p1.segmentStart),
      },
      p2: {
        ...current.riders.p2,
        position: copyPoint(current.riders.p2.position),
        segmentStart: copyPoint(current.riders.p2.segmentStart),
      },
    },
    trails: current.trails.map((segment) => ({
      ...segment,
      from: copyPoint(segment.from),
      to: copyPoint(segment.to),
    })),
    scores: { ...current.scores },
    derezEvents: current.derezEvents.map((event) => ({
      ...event,
      point: copyPoint(event.point),
    })),
  };
}

function directionVector(direction: LightCycleDirection) {
  return DIRECTIONS[direction];
}

function turnDirection(
  direction: LightCycleDirection,
  turn: LightCycleTurn,
): LightCycleDirection {
  if (turn === 0) return direction;
  return ((direction + (turn > 0 ? 1 : 3)) % 4) as LightCycleDirection;
}

function segmentLength(segment: Pick<LightCycleTrailSegment, 'from' | 'to'>) {
  return Math.abs(segment.to.x - segment.from.x) + Math.abs(segment.to.z - segment.from.z);
}

function commitTrail(state: LightCycleMatchState, rider: LightCycleRiderState) {
  const segment: LightCycleTrailSegment = {
    id: state.nextTrailId,
    owner: rider.id,
    from: copyPoint(rider.segmentStart),
    to: copyPoint(rider.position),
    createdTick: state.tick,
  };
  if (segmentLength(segment) > 0) {
    state.nextTrailId += 1;
    state.trails.push(segment);
  }
  rider.segmentStart = copyPoint(rider.position);
}

function activeTrail(
  rider: LightCycleRiderState,
  syntheticId: number,
): LightCycleTrailSegment | null {
  const segment = {
    id: syntheticId,
    owner: rider.id,
    from: copyPoint(rider.segmentStart),
    to: copyPoint(rider.position),
    createdTick: -1,
  };
  return segmentLength(segment) > 0 ? segment : null;
}

export function getLightCycleActiveTrails(state: LightCycleMatchState) {
  return PLAYER_IDS.flatMap((id, index) => {
    const segment = activeTrail(state.riders[id], -100 - index);
    return segment ? [segment] : [];
  });
}

function applyTurn(
  state: LightCycleMatchState,
  rider: LightCycleRiderState,
  turn: LightCycleTurn,
) {
  if (!rider.alive || turn === 0 || rider.turnCooldownTicks > 0) return;
  commitTrail(state, rider);
  rider.direction = turnDirection(rider.direction, turn);
  rider.turnCooldownTicks = state.config.turnCooldownTicks;
  rider.lastTurn = turn;
  rider.lastTurnTick = state.tick;
}

function inArena(value: LightCyclePoint) {
  return (
    value.x > -LIGHTCYCLE_ARENA_HALF &&
    value.x < LIGHTCYCLE_ARENA_HALF &&
    value.z > -LIGHTCYCLE_ARENA_HALF &&
    value.z < LIGHTCYCLE_ARENA_HALF
  );
}

function moveLength(from: LightCyclePoint, to: LightCyclePoint) {
  return Math.abs(to.x - from.x) + Math.abs(to.z - from.z);
}

function pointAlong(
  from: LightCyclePoint,
  to: LightCyclePoint,
  distance: number,
): LightCyclePoint {
  if (from.x !== to.x) {
    const sign = Math.sign(to.x - from.x);
    return point(from.x + sign * distance, from.z);
  }
  const sign = Math.sign(to.z - from.z);
  return point(from.x, from.z + sign * distance);
}

function intersectionDistance(
  from: LightCyclePoint,
  to: LightCyclePoint,
  segment: Pick<LightCycleTrailSegment, 'from' | 'to'>,
): number | null {
  const moveHorizontal = from.z === to.z;
  const segHorizontal = segment.from.z === segment.to.z;

  if (moveHorizontal && segHorizontal) {
    if (from.z !== segment.from.z) return null;
    const moveMin = Math.min(from.x, to.x);
    const moveMax = Math.max(from.x, to.x);
    const segMin = Math.min(segment.from.x, segment.to.x);
    const segMax = Math.max(segment.from.x, segment.to.x);
    const lo = Math.max(moveMin, segMin);
    const hi = Math.min(moveMax, segMax);
    if (lo > hi) return null;
    const candidate = to.x >= from.x ? lo : hi;
    return Math.abs(candidate - from.x);
  }

  if (!moveHorizontal && !segHorizontal) {
    if (from.x !== segment.from.x) return null;
    const moveMin = Math.min(from.z, to.z);
    const moveMax = Math.max(from.z, to.z);
    const segMin = Math.min(segment.from.z, segment.to.z);
    const segMax = Math.max(segment.from.z, segment.to.z);
    const lo = Math.max(moveMin, segMin);
    const hi = Math.min(moveMax, segMax);
    if (lo > hi) return null;
    const candidate = to.z >= from.z ? lo : hi;
    return Math.abs(candidate - from.z);
  }

  const horizontalFrom = moveHorizontal ? from : segment.from;
  const horizontalTo = moveHorizontal ? to : segment.to;
  const verticalFrom = moveHorizontal ? segment.from : from;
  const verticalTo = moveHorizontal ? segment.to : to;
  const x = verticalFrom.x;
  const z = horizontalFrom.z;

  if (
    x < Math.min(horizontalFrom.x, horizontalTo.x) ||
    x > Math.max(horizontalFrom.x, horizontalTo.x) ||
    z < Math.min(verticalFrom.z, verticalTo.z) ||
    z > Math.max(verticalFrom.z, verticalTo.z)
  ) {
    return null;
  }

  return moveHorizontal ? Math.abs(x - from.x) : Math.abs(z - from.z);
}

function boundaryCollisionDistance(from: LightCyclePoint, to: LightCyclePoint) {
  if (inArena(to)) return null;
  if (from.x !== to.x) {
    const boundary = to.x > from.x ? LIGHTCYCLE_ARENA_HALF : -LIGHTCYCLE_ARENA_HALF;
    return Math.abs(boundary - from.x);
  }
  const boundary = to.z > from.z ? LIGHTCYCLE_ARENA_HALF : -LIGHTCYCLE_ARENA_HALF;
  return Math.abs(boundary - from.z);
}

type PendingCrash = {
  distance: number;
  cause: LightCycleCrashCause;
  byPlayerId: LightCyclePlayerId | null;
};

function earliestStaticCrash(
  state: LightCycleMatchState,
  rider: LightCycleRiderState,
  from: LightCyclePoint,
  to: LightCyclePoint,
): PendingCrash | null {
  let best: PendingCrash | null = null;
  const boundary = boundaryCollisionDistance(from, to);
  if (boundary !== null) {
    best = { distance: boundary, cause: 'boundary', byPlayerId: null };
  }

  const segments = [...state.trails, ...getLightCycleActiveTrails(state)];
  for (const segment of segments) {
    if (segment.id < 0 && segment.owner === rider.id) continue;

    const distance = intersectionDistance(from, to, segment);
    if (distance === null || distance <= 0) continue;
    if (best && distance >= best.distance) continue;

    best = {
      distance,
      cause: segment.owner === rider.id ? 'own-trail' : 'opponent-trail',
      byPlayerId: segment.owner === rider.id ? rider.id : segment.owner,
    };
  }
  return best;
}

function samePoint(a: LightCyclePoint, b: LightCyclePoint) {
  return a.x === b.x && a.z === b.z;
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number) {
  return Math.max(Math.min(a0, a1), Math.min(b0, b1)) <= Math.min(Math.max(a0, a1), Math.max(b0, b1));
}

function prospectiveIntersection(
  a0: LightCyclePoint,
  a1: LightCyclePoint,
  b0: LightCyclePoint,
  b1: LightCyclePoint,
): { aDistance: number; bDistance: number; point: LightCyclePoint; collinearOpposite: boolean } | null {
  const aHorizontal = a0.z === a1.z;
  const bHorizontal = b0.z === b1.z;

  if (aHorizontal !== bHorizontal) {
    const h0 = aHorizontal ? a0 : b0;
    const h1 = aHorizontal ? a1 : b1;
    const v0 = aHorizontal ? b0 : a0;
    const v1 = aHorizontal ? b1 : a1;
    const p = point(v0.x, h0.z);
    if (
      !rangesOverlap(h0.x, h1.x, p.x, p.x) ||
      !rangesOverlap(v0.z, v1.z, p.z, p.z)
    ) {
      return null;
    }
    return {
      aDistance: moveLength(a0, p),
      bDistance: moveLength(b0, p),
      point: p,
      collinearOpposite: false,
    };
  }

  if (aHorizontal) {
    if (a0.z !== b0.z || !rangesOverlap(a0.x, a1.x, b0.x, b1.x)) return null;
    const opposite = Math.sign(a1.x - a0.x) !== Math.sign(b1.x - b0.x);
    if (!opposite) return null;
    const av = a1.x - a0.x;
    const bv = b1.x - b0.x;
    const t = (b0.x - a0.x) / (av - bv);
    if (t < 0 || t > 1) return null;
    const x = Math.round(a0.x + av * t);
    const p = point(x, a0.z);
    return { aDistance: moveLength(a0, p), bDistance: moveLength(b0, p), point: p, collinearOpposite: true };
  }

  if (a0.x !== b0.x || !rangesOverlap(a0.z, a1.z, b0.z, b1.z)) return null;
  const opposite = Math.sign(a1.z - a0.z) !== Math.sign(b1.z - b0.z);
  if (!opposite) return null;
  const av = a1.z - a0.z;
  const bv = b1.z - b0.z;
  const t = (b0.z - a0.z) / (av - bv);
  if (t < 0 || t > 1) return null;
  const z = Math.round(a0.z + av * t);
  const p = point(a0.x, z);
  return { aDistance: moveLength(a0, p), bDistance: moveLength(b0, p), point: p, collinearOpposite: true };
}

type PendingRiderMove = {
  from: LightCyclePoint;
  to: LightCyclePoint;
  distance: number;
  crash: PendingCrash | null;
};

/** Resolve only rider-to-rider collisions that both moves can reach this tick. */
function resolvePairCollision(
  a: PendingRiderMove,
  b: PendingRiderMove,
): void {
  const cross = prospectiveIntersection(a.from, a.to, b.from, b.to);
  if (
    !cross ||
    cross.aDistance > (a.crash?.distance ?? a.distance) ||
    cross.bDistance > (b.crash?.distance ?? b.distance)
  ) {
    return;
  }

  const headSwap = samePoint(a.to, b.from) && samePoint(b.to, a.from);
  if (cross.collinearOpposite || headSwap || samePoint(a.to, b.to)) {
    const cause: LightCycleCrashCause = headSwap ? 'head-swap' : 'head-on';
    a.crash = { distance: cross.aDistance, cause, byPlayerId: 'p2' };
    b.crash = { distance: cross.bDistance, cause, byPlayerId: 'p1' };
    return;
  }

  // Compare arrival fractions by integer cross multiplication, preserving determinism.
  const aArrival = cross.aDistance * b.distance;
  const bArrival = cross.bDistance * a.distance;
  if (aArrival === bArrival) {
    a.crash = { distance: cross.aDistance, cause: 'crossing', byPlayerId: 'p2' };
    b.crash = { distance: cross.bDistance, cause: 'crossing', byPlayerId: 'p1' };
    return;
  }
  if (aArrival < bArrival) {
    b.crash = { distance: cross.bDistance, cause: 'opponent-trail', byPlayerId: 'p1' };
  } else {
    a.crash = { distance: cross.aDistance, cause: 'opponent-trail', byPlayerId: 'p2' };
  }
}

function seededEventSeed(seed: number, tick: number, id: LightCyclePlayerId) {
  let value = (seed ^ Math.imul(tick + 1, 0x45d9f3b) ^ (id === 'p1' ? 0x13579bdf : 0x2468ace0)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}

function wheelAdvance(current: number, travelUnits: number) {
  const delta = Math.floor((travelUnits * 1000) / WHEEL_RADIUS_UNITS);
  return (current + delta) % TAU_MILLIRAD;
}

function finishRound(state: LightCycleMatchState, winner: LightCyclePlayerId | 'draw') {
  state.phase = 'round-over';
  state.roundWinner = winner;
  state.roundOverTicks = state.config.roundOverTicks;
  if (winner !== 'draw') state.scores[winner] += 1;
}

export function advanceLightCycleMatch(
  current: LightCycleMatchState,
  inputs: LightCycleTickInputs = {},
): LightCycleMatchState {
  const state = cloneState(current);
  state.tick += 1;
  state.derezEvents = [];

  if (state.phase === 'match-over') return state;

  if (state.phase === 'countdown') {
    state.countdownTicks = Math.max(0, state.countdownTicks - 1);
    if (state.countdownTicks === 0) state.phase = 'running';
    return state;
  }

  if (state.phase === 'round-over') {
    state.roundOverTicks = Math.max(0, state.roundOverTicks - 1);
    if (state.roundOverTicks > 0) return state;

    const winner = PLAYER_IDS.find((id) => state.scores[id] >= state.config.roundsToWin);
    if (winner) {
      state.phase = 'match-over';
      state.matchWinner = winner;
      return state;
    }

    return createRound(
      state.round + 1,
      { p1: state.riders.p1.name, p2: state.riders.p2.name },
      state.scores,
      state.seed + 17,
      state.config,
    );
  }

  for (const id of PLAYER_IDS) {
    const rider = state.riders[id];
    rider.turnCooldownTicks = Math.max(0, rider.turnCooldownTicks - 1);
    rider.lastTurn = 0;
    const requestedTurn = inputs[id]?.turn ?? 0;
    applyTurn(state, rider, requestedTurn);
  }

  const moves: Partial<Record<LightCyclePlayerId, PendingRiderMove>> = {};

  for (const id of PLAYER_IDS) {
    const rider = state.riders[id];
    if (!rider.alive) continue;

    const boostRequested = Boolean(inputs[id]?.boost);
    const boosting = boostRequested && rider.energy > 0;
    rider.energy = Math.max(
      0,
      Math.min(
        1000,
        rider.energy + (boosting ? -state.config.boostDrainPerTick : state.config.boostRegenPerTick),
      ),
    );
    rider.speedUnitsPerTick = boosting ? state.config.boostStepUnits : state.config.baseStepUnits;

    const from = copyPoint(rider.position);
    const vector = directionVector(rider.direction);
    const to = point(
      from.x + vector.x * rider.speedUnitsPerTick,
      from.z + vector.z * rider.speedUnitsPerTick,
    );
    moves[id] = {
      from,
      to,
      distance: moveLength(from, to),
      crash: earliestStaticCrash(state, rider, from, to),
    };
  }

  if (moves.p1 && moves.p2) {
    resolvePairCollision(moves.p1, moves.p2);
  }

  for (const id of PLAYER_IDS) {
    const move = moves[id];
    if (!move) continue;
    const rider = state.riders[id];
    const { from, to, distance, crash } = move;
    const travel = crash ? Math.max(0, Math.min(distance, crash.distance)) : distance;
    rider.position = pointAlong(from, to, travel);
    rider.wheelAngleMilliRad = wheelAdvance(rider.wheelAngleMilliRad, travel);
    assertInteger(rider.position.x, `${id}.position.x`);
    assertInteger(rider.position.z, `${id}.position.z`);

    if (crash) {
      commitTrail(state, rider);
      rider.alive = false;
      rider.speedUnitsPerTick = 0;
      state.derezEvents.push({
        playerId: id,
        tick: state.tick,
        point: copyPoint(rider.position),
        cause: crash.cause,
        byPlayerId: crash.byPlayerId,
        seed: seededEventSeed(state.seed, state.tick, id),
      });
    }
  }

  if (!state.riders.p1.alive || !state.riders.p2.alive) {
    if (!state.riders.p1.alive && !state.riders.p2.alive) {
      finishRound(state, 'draw');
    } else {
      finishRound(state, state.riders.p1.alive ? 'p1' : 'p2');
    }
  }

  return state;
}

export function lightCycleStateHash(state: LightCycleMatchState) {
  const chunks: (string | number)[] = [
    state.phase,
    state.tick,
    state.round,
    state.seed,
    state.scores.p1,
    state.scores.p2,
  ];
  for (const id of PLAYER_IDS) {
    const rider = state.riders[id];
    chunks.push(
      id,
      rider.position.x,
      rider.position.z,
      rider.segmentStart.x,
      rider.segmentStart.z,
      rider.direction,
      rider.alive ? 1 : 0,
      rider.energy,
    );
  }
  for (const segment of state.trails) {
    chunks.push(
      segment.id,
      segment.owner,
      segment.from.x,
      segment.from.z,
      segment.to.x,
      segment.to.z,
      segment.createdTick,
    );
  }

  const text = chunks.join('|');
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function startLightCycleRoundImmediately(state: LightCycleMatchState) {
  const next = cloneState(state);
  next.phase = 'running';
  next.countdownTicks = 0;
  return next;
}

export const __lightCycleTest = {
  intersectionDistance,
  prospectiveIntersection,
};
