'use client';

export const GRID_ARENA_HALF = 27;
export const GRID_ARENA_SIZE = GRID_ARENA_HALF * 2;
export const GRID_CELL = 3;
export const GRID_MATCH_WINS = 3;

export type GridTurn = -1 | 0 | 1;
export type GridRaceRoundPhase = 'countdown' | 'running' | 'round-over' | 'match-over';
export type GridRiderId = 'player' | 'rival-a' | 'rival-b' | 'rival-c';
export type GridRoundWinner = 'player' | 'grid' | null;

export type GridPoint = {
  x: number;
  z: number;
};

export type GridTrailSegment = {
  id: number;
  owner: GridRiderId;
  from: GridPoint;
  to: GridPoint;
};

export type GridRiderState = {
  id: GridRiderId;
  label: string;
  position: GridPoint;
  segmentStart: GridPoint;
  direction: 0 | 1 | 2 | 3;
  alive: boolean;
  energy: number;
  speed: number;
  turnCooldown: number;
  decisionTimer: number;
};

export type GridRaceSimulation = {
  phase: GridRaceRoundPhase;
  round: number;
  countdown: number;
  roundTimer: number;
  elapsed: number;
  tick: number;
  seed: number;
  nextTrailId: number;
  winner: GridRoundWinner;
  matchWinner: GridRoundWinner;
  scores: {
    player: number;
    grid: number;
  };
  riders: Record<GridRiderId, GridRiderState>;
  trails: GridTrailSegment[];
};

export type GridRaceInput = {
  turn: GridTurn;
  boost: boolean;
};

const BASE_SPEED = 7.2;
const BOOST_MULTIPLIER = 1.72;
const BOOST_DRAIN = 0.42;
const BOOST_REGEN = 0.2;
const TURN_COOLDOWN = 0.14;
const TURN_GRACE = 0.72;
const HIT_RADIUS = 0.22;
const HEAD_RADIUS = 0.58;
const PROBE_STEP = 0.5;
const PROBE_DISTANCE = 10;
const COUNTDOWN_SECONDS = 3;
const ROUND_OVER_SECONDS = 2.25;

const RIDER_IDS: GridRiderId[] = ['player', 'rival-a', 'rival-b', 'rival-c'];
const RIVAL_IDS: GridRiderId[] = ['rival-a', 'rival-b', 'rival-c'];

const DIRECTIONS: GridPoint[] = [
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const distance = (a: GridPoint, b: GridPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const copyPoint = (point: GridPoint): GridPoint => ({ x: point.x, z: point.z });

function hash01(value: number) {
  const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function makeRider(
  id: GridRiderId,
  label: string,
  position: GridPoint,
  direction: GridRiderState['direction'],
  decisionTimer = 0.2,
): GridRiderState {
  return {
    id,
    label,
    position: copyPoint(position),
    segmentStart: copyPoint(position),
    direction,
    alive: true,
    energy: 1,
    speed: BASE_SPEED,
    turnCooldown: 0,
    decisionTimer,
  };
}

function createRound(
  round: number,
  scores: GridRaceSimulation['scores'],
  seed: number,
): GridRaceSimulation {
  return {
    phase: 'countdown',
    round,
    countdown: COUNTDOWN_SECONDS,
    roundTimer: 0,
    elapsed: 0,
    tick: 0,
    seed,
    nextTrailId: 1,
    winner: null,
    matchWinner: null,
    scores: { ...scores },
    riders: {
      player: makeRider('player', 'YOU', { x: 0, z: 18 }, 0),
      'rival-a': makeRider('rival-a', 'ORANGE', { x: -15, z: -15 }, 1, 0.08),
      'rival-b': makeRider('rival-b', 'GOLD', { x: 15, z: -9 }, 3, 0.14),
      'rival-c': makeRider('rival-c', 'WHITE', { x: 9, z: 15 }, 2, 0.22),
    },
    trails: [],
  };
}

export function createGridRaceSimulation(seed = 1982): GridRaceSimulation {
  return createRound(1, { player: 0, grid: 0 }, seed);
}

export function restartGridRace(simulation: GridRaceSimulation): GridRaceSimulation {
  return createRound(1, { player: 0, grid: 0 }, simulation.seed + 101);
}

function cloneSimulation(simulation: GridRaceSimulation): GridRaceSimulation {
  return {
    ...simulation,
    scores: { ...simulation.scores },
    riders: {
      player: {
        ...simulation.riders.player,
        position: copyPoint(simulation.riders.player.position),
        segmentStart: copyPoint(simulation.riders.player.segmentStart),
      },
      'rival-a': {
        ...simulation.riders['rival-a'],
        position: copyPoint(simulation.riders['rival-a'].position),
        segmentStart: copyPoint(simulation.riders['rival-a'].segmentStart),
      },
      'rival-b': {
        ...simulation.riders['rival-b'],
        position: copyPoint(simulation.riders['rival-b'].position),
        segmentStart: copyPoint(simulation.riders['rival-b'].segmentStart),
      },
      'rival-c': {
        ...simulation.riders['rival-c'],
        position: copyPoint(simulation.riders['rival-c'].position),
        segmentStart: copyPoint(simulation.riders['rival-c'].segmentStart),
      },
    },
    trails: simulation.trails.map((segment) => ({
      ...segment,
      from: copyPoint(segment.from),
      to: copyPoint(segment.to),
    })),
  };
}

function directionVector(direction: GridRiderState['direction']) {
  return DIRECTIONS[direction] ?? DIRECTIONS[0]!;
}

function turnedDirection(direction: GridRiderState['direction'], turn: GridTurn) {
  if (turn === 0) return direction;
  const next = (direction + (turn > 0 ? 1 : 3)) % 4;
  return next as GridRiderState['direction'];
}

function segmentLength(segment: Pick<GridTrailSegment, 'from' | 'to'>) {
  return distance(segment.from, segment.to);
}

function commitTrail(simulation: GridRaceSimulation, rider: GridRiderState) {
  const segment: GridTrailSegment = {
    id: simulation.nextTrailId++,
    owner: rider.id,
    from: copyPoint(rider.segmentStart),
    to: copyPoint(rider.position),
  };

  if (segmentLength(segment) > 0.08) {
    simulation.trails.push(segment);
  }
  rider.segmentStart = copyPoint(rider.position);
}

function applyTurn(
  simulation: GridRaceSimulation,
  rider: GridRiderState,
  turn: GridTurn,
) {
  if (turn === 0 || rider.turnCooldown > 0 || !rider.alive) return;
  commitTrail(simulation, rider);
  rider.direction = turnedDirection(rider.direction, turn);
  rider.turnCooldown = TURN_COOLDOWN;
}

function activeTrailFor(rider: GridRiderState, syntheticId: number): GridTrailSegment | null {
  if (!rider.alive || distance(rider.segmentStart, rider.position) <= 0.08) return null;
  return {
    id: syntheticId,
    owner: rider.id,
    from: copyPoint(rider.segmentStart),
    to: copyPoint(rider.position),
  };
}

export function getActiveTrailSegments(simulation: GridRaceSimulation) {
  const result: GridTrailSegment[] = [];
  RIDER_IDS.forEach((id, index) => {
    const segment = activeTrailFor(simulation.riders[id], -100 - index);
    if (segment) result.push(segment);
  });
  return result;
}

function isInsideArena(point: GridPoint, padding = 0) {
  const limit = GRID_ARENA_HALF - padding;
  return Math.abs(point.x) < limit && Math.abs(point.z) < limit;
}

function pointNearSegment(point: GridPoint, segment: GridTrailSegment, padding: number) {
  const minX = Math.min(segment.from.x, segment.to.x) - padding;
  const maxX = Math.max(segment.from.x, segment.to.x) + padding;
  const minZ = Math.min(segment.from.z, segment.to.z) - padding;
  const maxZ = Math.max(segment.from.z, segment.to.z) + padding;

  if (Math.abs(segment.from.x - segment.to.x) < 0.001) {
    return Math.abs(point.x - segment.from.x) <= padding && point.z >= minZ && point.z <= maxZ;
  }

  return Math.abs(point.z - segment.from.z) <= padding && point.x >= minX && point.x <= maxX;
}

function latestTrailId(simulation: GridRaceSimulation, riderId: GridRiderId) {
  for (let index = simulation.trails.length - 1; index >= 0; index -= 1) {
    if (simulation.trails[index]?.owner === riderId) return simulation.trails[index]!.id;
  }
  return null;
}

function collisionSegments(simulation: GridRaceSimulation) {
  return [...simulation.trails, ...getActiveTrailSegments(simulation)];
}

function pointBlocked(
  simulation: GridRaceSimulation,
  rider: GridRiderState,
  point: GridPoint,
  padding = HIT_RADIUS,
) {
  if (!isInsideArena(point, padding)) return true;

  const latestOwnId = latestTrailId(simulation, rider.id);
  for (const segment of collisionSegments(simulation)) {
    if (segment.owner === rider.id && segment.id < 0) continue;

    if (
      segment.owner === rider.id &&
      segment.id === latestOwnId &&
      distance(point, segment.to) < TURN_GRACE
    ) {
      continue;
    }

    if (pointNearSegment(point, segment, padding)) return true;
  }

  for (const otherId of RIDER_IDS) {
    if (otherId === rider.id) continue;
    const other = simulation.riders[otherId];
    if (other.alive && distance(point, other.position) <= HEAD_RADIUS) return true;
  }

  return false;
}

function pathBlocked(
  simulation: GridRaceSimulation,
  rider: GridRiderState,
  from: GridPoint,
  to: GridPoint,
) {
  const travel = distance(from, to);
  const steps = Math.max(1, Math.ceil(travel / 0.12));

  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    const point = {
      x: from.x + (to.x - from.x) * t,
      z: from.z + (to.z - from.z) * t,
    };
    if (pointBlocked(simulation, rider, point)) return true;
  }

  return false;
}

function freeDistance(
  simulation: GridRaceSimulation,
  rider: GridRiderState,
  direction: GridRiderState['direction'],
) {
  const vector = directionVector(direction);
  for (let travel = PROBE_STEP; travel <= PROBE_DISTANCE; travel += PROBE_STEP) {
    const point = {
      x: rider.position.x + vector.x * travel,
      z: rider.position.z + vector.z * travel,
    };
    if (pointBlocked(simulation, rider, point, HIT_RADIUS * 1.35)) return travel - PROBE_STEP;
  }
  return PROBE_DISTANCE;
}

function chooseAiTurn(simulation: GridRaceSimulation, rider: GridRiderState): GridTurn {
  if (!rider.alive || rider.turnCooldown > 0) return 0;

  const forward = freeDistance(simulation, rider, rider.direction);
  const leftDirection = turnedDirection(rider.direction, -1);
  const rightDirection = turnedDirection(rider.direction, 1);
  const left = freeDistance(simulation, rider, leftDirection);
  const right = freeDistance(simulation, rider, rightDirection);

  if (forward < 2.8) {
    if (left < 0.5 && right < 0.5) return 0;
    if (Math.abs(left - right) < 0.35) {
      return hash01(simulation.seed + simulation.tick * 7 + rider.id.charCodeAt(6)) > 0.5 ? 1 : -1;
    }
    return left > right ? -1 : 1;
  }

  if (rider.decisionTimer > 0) return 0;

  const player = simulation.riders.player;
  const leftVector = directionVector(leftDirection);
  const rightVector = directionVector(rightDirection);
  const leftAfter = {
    x: rider.position.x + leftVector.x * 4,
    z: rider.position.z + leftVector.z * 4,
  };
  const rightAfter = {
    x: rider.position.x + rightVector.x * 4,
    z: rider.position.z + rightVector.z * 4,
  };
  const currentDistance = distance(rider.position, player.position);
  const leftHunts = distance(leftAfter, player.position) + 0.75 < currentDistance;
  const rightHunts = distance(rightAfter, player.position) + 0.75 < currentDistance;
  const huntRoll = hash01(simulation.seed * 3 + simulation.tick * 11 + rider.id.charCodeAt(6));

  if (huntRoll > 0.7 && (leftHunts || rightHunts)) {
    if (leftHunts && left > 4.5 && (!rightHunts || left >= right)) return -1;
    if (rightHunts && right > 4.5) return 1;
  }

  const wanderRoll = hash01(simulation.seed * 5 + simulation.tick * 13 + rider.id.charCodeAt(6));
  if (wanderRoll > 0.91) {
    if (left > 5.5 && left >= right) return -1;
    if (right > 5.5) return 1;
  }

  return 0;
}

function motionPathsIntersect(a0: GridPoint, a1: GridPoint, b0: GridPoint, b1: GridPoint) {
  const aHorizontal = Math.abs(a0.z - a1.z) < 0.001;
  const bHorizontal = Math.abs(b0.z - b1.z) < 0.001;

  if (aHorizontal && bHorizontal) {
    if (Math.abs(a0.z - b0.z) > HEAD_RADIUS) return false;
    const aMin = Math.min(a0.x, a1.x);
    const aMax = Math.max(a0.x, a1.x);
    const bMin = Math.min(b0.x, b1.x);
    const bMax = Math.max(b0.x, b1.x);
    return Math.max(aMin, bMin) <= Math.min(aMax, bMax) + HEAD_RADIUS;
  }

  if (!aHorizontal && !bHorizontal) {
    if (Math.abs(a0.x - b0.x) > HEAD_RADIUS) return false;
    const aMin = Math.min(a0.z, a1.z);
    const aMax = Math.max(a0.z, a1.z);
    const bMin = Math.min(b0.z, b1.z);
    const bMax = Math.max(b0.z, b1.z);
    return Math.max(aMin, bMin) <= Math.min(aMax, bMax) + HEAD_RADIUS;
  }

  const horizontal0 = aHorizontal ? a0 : b0;
  const horizontal1 = aHorizontal ? a1 : b1;
  const vertical0 = aHorizontal ? b0 : a0;
  const vertical1 = aHorizontal ? b1 : a1;

  const x = vertical0.x;
  const z = horizontal0.z;
  return (
    x >= Math.min(horizontal0.x, horizontal1.x) - HEAD_RADIUS &&
    x <= Math.max(horizontal0.x, horizontal1.x) + HEAD_RADIUS &&
    z >= Math.min(vertical0.z, vertical1.z) - HEAD_RADIUS &&
    z <= Math.max(vertical0.z, vertical1.z) + HEAD_RADIUS
  );
}

function finishRound(simulation: GridRaceSimulation, winner: Exclude<GridRoundWinner, null>) {
  simulation.phase = 'round-over';
  simulation.roundTimer = ROUND_OVER_SECONDS;
  simulation.winner = winner;
  simulation.scores[winner] += 1;
}

export function advanceGridRace(
  current: GridRaceSimulation,
  input: GridRaceInput,
  dt: number,
): GridRaceSimulation {
  const simulation = cloneSimulation(current);
  const safeDt = Math.min(Math.max(dt, 0), 0.1);
  simulation.elapsed += safeDt;
  simulation.tick += 1;

  if (simulation.phase === 'match-over') return simulation;

  if (simulation.phase === 'countdown') {
    simulation.countdown = Math.max(0, simulation.countdown - safeDt);
    if (simulation.countdown <= 0) {
      simulation.phase = 'running';
    }
    return simulation;
  }

  if (simulation.phase === 'round-over') {
    simulation.roundTimer = Math.max(0, simulation.roundTimer - safeDt);
    if (simulation.roundTimer > 0) return simulation;

    if (simulation.scores.player >= GRID_MATCH_WINS || simulation.scores.grid >= GRID_MATCH_WINS) {
      simulation.phase = 'match-over';
      simulation.matchWinner = simulation.scores.player >= GRID_MATCH_WINS ? 'player' : 'grid';
      return simulation;
    }

    return createRound(simulation.round + 1, simulation.scores, simulation.seed + 17);
  }

  const player = simulation.riders.player;
  player.turnCooldown = Math.max(0, player.turnCooldown - safeDt);
  applyTurn(simulation, player, input.turn);

  for (const rivalId of RIVAL_IDS) {
    const rider = simulation.riders[rivalId];
    rider.turnCooldown = Math.max(0, rider.turnCooldown - safeDt);
    rider.decisionTimer = Math.max(0, rider.decisionTimer - safeDt);
    const aiTurn = chooseAiTurn(simulation, rider);
    if (aiTurn !== 0) {
      applyTurn(simulation, rider, aiTurn);
      rider.decisionTimer = 0.18 + hash01(simulation.seed + simulation.tick + rivalId.charCodeAt(6)) * 0.28;
    } else if (rider.decisionTimer <= 0) {
      rider.decisionTimer = 0.12 + hash01(simulation.seed * 2 + simulation.tick * 3 + rivalId.charCodeAt(6)) * 0.22;
    }
  }

  const starts = new Map<GridRiderId, GridPoint>();
  const nextPositions = new Map<GridRiderId, GridPoint>();
  const crashed = new Set<GridRiderId>();

  for (const riderId of RIDER_IDS) {
    const rider = simulation.riders[riderId];
    if (!rider.alive) continue;

    const forwardClearance = freeDistance(simulation, rider, rider.direction);
    const aiBoost =
      riderId !== 'player' &&
      rider.energy > 0.3 &&
      forwardClearance > 6.5 &&
      hash01(simulation.seed + simulation.tick * 0.07 + riderId.charCodeAt(6)) > 0.58;
    const boosting = riderId === 'player' ? input.boost && rider.energy > 0.02 : aiBoost;

    rider.energy = clamp01(
      rider.energy + (boosting ? -BOOST_DRAIN : BOOST_REGEN) * safeDt,
    );
    const aiDifficulty =
      riderId === 'player' ? 1 : 1 + Math.min(0.14, (simulation.round - 1) * 0.025);
    rider.speed = BASE_SPEED * aiDifficulty * (boosting ? BOOST_MULTIPLIER : 1);

    const vector = directionVector(rider.direction);
    const start = copyPoint(rider.position);
    const next = {
      x: rider.position.x + vector.x * rider.speed * safeDt,
      z: rider.position.z + vector.z * rider.speed * safeDt,
    };

    starts.set(riderId, start);
    nextPositions.set(riderId, next);

    if (pathBlocked(simulation, rider, start, next)) {
      crashed.add(riderId);
    }
  }

  const movingIds = RIDER_IDS.filter((id) => simulation.riders[id].alive);
  for (let a = 0; a < movingIds.length; a += 1) {
    for (let b = a + 1; b < movingIds.length; b += 1) {
      const aId = movingIds[a]!;
      const bId = movingIds[b]!;
      const a0 = starts.get(aId);
      const a1 = nextPositions.get(aId);
      const b0 = starts.get(bId);
      const b1 = nextPositions.get(bId);
      if (!a0 || !a1 || !b0 || !b1) continue;

      if (distance(a1, b1) <= HEAD_RADIUS || motionPathsIntersect(a0, a1, b0, b1)) {
        crashed.add(aId);
        crashed.add(bId);
      }
    }
  }

  for (const riderId of movingIds) {
    const rider = simulation.riders[riderId];
    const next = nextPositions.get(riderId);
    if (!next) continue;
    rider.position = next;
  }

  for (const riderId of crashed) {
    const rider = simulation.riders[riderId];
    commitTrail(simulation, rider);
    rider.alive = false;
    rider.speed = 0;
  }

  if (crashed.size > 0) {
    const deadRivals = new Set(
      RIVAL_IDS.filter((id) => !simulation.riders[id].alive),
    );
    simulation.trails = simulation.trails.filter(
      (segment) => segment.owner === 'player' || !deadRivals.has(segment.owner),
    );
  }

  if (!simulation.riders.player.alive) {
    finishRound(simulation, 'grid');
    return simulation;
  }

  if (RIVAL_IDS.every((id) => !simulation.riders[id].alive)) {
    finishRound(simulation, 'player');
  }

  return simulation;
}
