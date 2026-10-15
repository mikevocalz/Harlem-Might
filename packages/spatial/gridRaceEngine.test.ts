import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GRID_ARENA_HALF,
  GRID_MATCH_WINS,
  advanceGridRace,
  createGridRaceSimulation,
  getActiveTrailSegments,
  restartGridRace,
  type GridRaceInput,
  type GridRaceSimulation,
  type GridRiderId,
  type GridRiderState,
} from './gridRaceEngine.ts';

const idle: GridRaceInput = { turn: 0, boost: false };
const rivalIds = ['rival-a', 'rival-b', 'rival-c'] as const;

function running(seed = 42): GridRaceSimulation {
  const state = createGridRaceSimulation(seed);
  state.phase = 'running';
  state.countdown = 0;
  // Keep crafted collision tests independent of AI turn/boost decisions.
  for (const id of rivalIds) {
    state.riders[id].turnCooldown = 10;
    state.riders[id].decisionTimer = 10;
    state.riders[id].energy = 0;
  }
  return state;
}

function place(
  state: GridRaceSimulation,
  id: GridRiderId,
  x: number,
  z: number,
  direction: GridRiderState['direction'],
) {
  Object.assign(state.riders[id], {
    position: { x, z }, segmentStart: { x, z }, direction,
  });
}

function advanceUntil(
  state: GridRaceSimulation,
  phase: GridRaceSimulation['phase'],
) {
  for (let index = 0; index < 100 && state.phase !== phase; index += 1) {
    state = advanceGridRace(state, idle, 0.1);
  }
  assert.equal(state.phase, phase);
  return state;
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function winRound(winner: 'player' | 'grid', scores = { player: 0, grid: 0 }) {
  const state = running();
  state.scores = { ...scores };
  if (winner === 'player') {
    for (const id of rivalIds) state.riders[id].alive = false;
  } else {
    place(state, 'player', GRID_ARENA_HALF - 0.3, 0, 1);
  }
  return advanceGridRace(state, idle, 0.1);
}

describe('grid race countdown and deterministic stepping', () => {
  it('creates independent seeded rounds with the shipped spawn layout', () => {
    const state = createGridRaceSimulation(42);
    assert.equal(state.seed, 42);
    assert.equal(state.round, 1);
    assert.equal(state.phase, 'countdown');
    assert.equal(state.countdown, 3);
    assert.deepEqual(state.scores, { player: 0, grid: 0 });
    assert.deepEqual(state.riders.player.position, { x: 0, z: 18 });
    assert.equal(state.riders.player.direction, 0);
    assert.deepEqual(state.trails, []);
    assert.equal(createGridRaceSimulation().seed, 1982);
    const other = createGridRaceSimulation(42);
    state.riders.player.position.x = 100;
    state.scores.player = 2;
    assert.equal(other.riders.player.position.x, 0);
    assert.equal(other.scores.player, 0);
  });

  it('counts down for three seconds without moving, turning or spending boost', () => {
    let state = createGridRaceSimulation(42);
    const initialRiders = structuredClone(state.riders);
    for (let index = 0; index < 29; index += 1) {
      state = advanceGridRace(state, { turn: 1, boost: true }, 0.1);
    }
    assert.equal(state.phase, 'countdown');
    assert.ok(Math.abs(state.countdown - 0.1) < 1e-12);
    assert.deepEqual(state.riders, initialRiders);
    state = advanceGridRace(state, { turn: 1, boost: true }, 0.1);
    assert.equal(state.phase, 'running');
    assert.equal(state.countdown, 0);
    assert.deepEqual(state.riders, initialRiders);
    state = advanceGridRace(state, idle, 0.1);
    assert.equal(state.riders.player.position.z, 17.28);
  });

  it('caps long frames at 0.1 seconds and clamps negative countdown deltas to zero', () => {
    const state = running();
    assert.deepEqual(advanceGridRace(state, idle, 20), advanceGridRace(state, idle, 0.1));
    const countdown = createGridRaceSimulation();
    assert.deepEqual(advanceGridRace(countdown, idle, -1), advanceGridRace(countdown, idle, 0));
    assert.equal(advanceGridRace(countdown, idle, -1).countdown, 3);
  });

  it('replays real AI decisions identically for each fixed seed and input sequence', () => {
    const replay = (seed: number) => {
      let state = createGridRaceSimulation(seed);
      const frames: GridRaceSimulation[] = [];
      for (let tick = 0; tick < 180; tick += 1) {
        state = advanceGridRace(state, {
          turn: tick % 41 === 0 ? 1 : tick % 37 === 0 ? -1 : 0,
          boost: tick % 13 < 5,
        }, 1 / 30);
        frames.push(state);
      }
      return frames;
    };
    for (const seed of [42, 1982, 2026]) assert.deepEqual(replay(seed), replay(seed));
  });
});

describe('grid race turns, boost and immutable snapshots', () => {
  it('commits the previous trail when turning and enforces the turn cooldown', () => {
    const state = running();
    place(state, 'player', 0, 0, 0);
    state.riders.player.segmentStart = { x: 0, z: 3 };
    const turned = advanceGridRace(state, { turn: 1, boost: false }, 0.05);
    assert.equal(turned.riders.player.direction, 1);
    assert.equal(turned.riders.player.alive, true, 'the most recent corner has turn grace');
    assert.deepEqual(turned.trails, [{
      id: 1, owner: 'player', from: { x: 0, z: 3 }, to: { x: 0, z: 0 },
    }]);
    assert.deepEqual(turned.riders.player.segmentStart, { x: 0, z: 0 });
    const held = advanceGridRace(turned, { turn: 1, boost: false }, 0.05);
    assert.equal(held.riders.player.direction, 1);
    assert.equal(held.trails.length, 1);
    const ready = advanceGridRace(held, { turn: -1, boost: false }, 0.1);
    assert.equal(ready.riders.player.direction, 0);
    assert.equal(ready.trails.length, 2);
  });

  it('wraps both turn directions and ignores turn input on a dead player', () => {
    const left = running();
    assert.equal(advanceGridRace(left, { turn: -1, boost: false }, 0.01).riders.player.direction, 3);
    left.riders.player.direction = 3;
    assert.equal(advanceGridRace(left, { turn: 1, boost: false }, 0.01).riders.player.direction, 0);
    left.riders.player.alive = false;
    assert.equal(advanceGridRace(left, { turn: 1, boost: false }, 0.01).riders.player.direction, 3);
  });

  it('boosts at the shipped speed and drains energy without going below zero', () => {
    const state = running();
    place(state, 'player', 0, 0, 1);
    const boosted = advanceGridRace(state, { turn: 0, boost: true }, 0.1);
    assert.equal(boosted.riders.player.speed, 7.2 * 1.72);
    assert.equal(boosted.riders.player.position.x, 7.2 * 1.72 * 0.1);
    assert.equal(boosted.riders.player.energy, 1 - 0.42 * 0.1);
    state.riders.player.energy = 0.021;
    assert.equal(advanceGridRace(state, { turn: 0, boost: true }, 0.1).riders.player.energy, 0);
  });

  it('requires energy above 0.02 to boost and regenerates up to one', () => {
    for (const energy of [0, 0.02]) {
      const state = running();
      state.riders.player.energy = energy;
      const next = advanceGridRace(state, { turn: 0, boost: true }, 0.1);
      assert.equal(next.riders.player.speed, 7.2);
      assert.equal(next.riders.player.energy, energy + 0.2 * 0.1);
    }
    const state = running();
    state.riders.player.energy = 0.999;
    assert.equal(advanceGridRace(state, idle, 0.1).riders.player.energy, 1);
  });

  it('never mutates the supplied simulation or input, including nested trail points', () => {
    const state = running();
    state.trails.push({ id: 1, owner: 'player', from: { x: -4, z: 0 }, to: { x: 4, z: 0 } });
    state.nextTrailId = 2;
    const before = structuredClone(state);
    const input = freezeDeep({ turn: 1, boost: true } satisfies GridRaceInput);
    const next = advanceGridRace(freezeDeep(state), input, 0.1);
    assert.deepEqual(state, before);
    assert.notEqual(next, state);
    assert.notEqual(next.scores, state.scores);
    for (const id of ['player', ...rivalIds] as const) {
      assert.notEqual(next.riders[id], state.riders[id]);
      assert.notEqual(next.riders[id].position, state.riders[id].position);
      assert.notEqual(next.riders[id].segmentStart, state.riders[id].segmentStart);
    }
    next.trails[0]!.from.x = 99;
    next.trails[0]!.to.z = 99;
    assert.deepEqual(state, before);
    assert.deepEqual(input, { turn: 1, boost: true });
  });

  it('returns detached active trails only for living riders with a nontrivial trail', () => {
    const state = running();
    place(state, 'player', 0, 0, 0);
    state.riders.player.segmentStart = { x: 0, z: 3 };
    state.riders['rival-a'].segmentStart.x -= 3;
    state.riders['rival-a'].alive = false;
    state.riders['rival-b'].segmentStart.x += 0.01;
    const trails = getActiveTrailSegments(freezeDeep(state));
    assert.deepEqual(trails, [{ id: -100, owner: 'player', from: { x: 0, z: 3 }, to: { x: 0, z: 0 } }]);
    trails[0]!.from.x = 99;
    trails[0]!.to.x = 99;
    assert.equal(state.riders.player.segmentStart.x, 0);
    assert.equal(state.riders.player.position.x, 0);
  });
});

describe('grid race swept and simultaneous collisions', () => {
  for (const [x, z, direction] of [
    [GRID_ARENA_HALF - 0.3, 0, 1], [-GRID_ARENA_HALF + 0.3, 0, 3],
    [0, GRID_ARENA_HALF - 0.3, 2], [0, -GRID_ARENA_HALF + 0.3, 0],
  ] as const) {
    it(`crashes at the arena boundary in direction ${direction}`, () => {
      const state = running();
      place(state, 'player', x, z, direction);
      const next = advanceGridRace(state, idle, 0.1);
      assert.equal(next.riders.player.alive, false);
      assert.equal(next.riders.player.speed, 0);
      assert.equal(next.winner, 'grid');
      assert.deepEqual(next.scores, { player: 0, grid: 1 });
    });
  }

  for (const owner of ['player', 'rival-a'] as const) {
    it(`detects a swept boosted crossing of a committed ${owner} trail`, () => {
      const state = running();
      place(state, 'player', -0.6, 0, 1);
      state.trails = [{ id: 1, owner, from: { x: 0, z: -3 }, to: { x: 0, z: 3 } }];
      state.nextTrailId = 2;
      const next = advanceGridRace(state, { turn: 0, boost: true }, 0.1);
      assert.ok(next.riders.player.position.x > 0.22, 'the endpoint has passed the trail');
      assert.equal(next.riders.player.alive, false);
      assert.equal(next.winner, 'grid');
    });
  }

  it('collides with a living rival active trail before it is committed', () => {
    const state = running();
    place(state, 'player', -0.6, 0, 1);
    place(state, 'rival-a', 0, 5, 2);
    state.riders['rival-a'].segmentStart = { x: 0, z: -5 };
    const next = advanceGridRace(state, { turn: 0, boost: true }, 0.1);
    assert.equal(next.riders.player.alive, false);
    assert.equal(next.riders['rival-a'].alive, true);
  });

  it('does not collide with its own growing active trail', () => {
    const state = running();
    place(state, 'player', 0, 0, 1);
    state.riders.player.segmentStart = { x: -3, z: 0 };
    assert.equal(advanceGridRace(state, idle, 0.1).riders.player.alive, true);
  });

  for (const rivalId of rivalIds) {
    for (const vertical of [false, true]) {
      it(`resolves a ${vertical ? 'vertical' : 'horizontal'} head swap with ${rivalId} simultaneously`, () => {
        const state = running();
        place(state, 'player', vertical ? 0 : -0.35, vertical ? -0.35 : 0, vertical ? 2 : 1);
        place(state, rivalId, vertical ? 0 : 0.35, vertical ? 0.35 : 0, vertical ? 0 : 3);
        const next = advanceGridRace(state, idle, 0.1);
        const axis = vertical ? 'z' : 'x';
        assert.ok(next.riders.player.position[axis] > next.riders[rivalId].position[axis]);
        assert.equal(next.riders.player.alive, false);
        assert.equal(next.riders[rivalId].alive, false);
        assert.equal(next.winner, 'grid');
        assert.deepEqual(next.scores, { player: 0, grid: 1 });
      });
    }
  }

  it('detects swept simultaneous perpendicular crossings even when both endpoints are clear', () => {
    for (const rotate of [false, true]) {
      const state = running();
      place(state, 'player', rotate ? 0 : -0.65, rotate ? -0.65 : 0, rotate ? 2 : 1);
      place(state, 'rival-a', rotate ? -0.65 : 0, rotate ? 0 : -0.65, rotate ? 1 : 2);
      // Seed 42 boosts rival-a here, matching the player's crossing time.
      state.riders['rival-a'].energy = 1;
      const next = advanceGridRace(state, { turn: 0, boost: true }, 0.1);
      const player = next.riders.player;
      const rival = next.riders['rival-a'];
      assert.equal(rival.energy, 1 - 0.42 * 0.1);
      assert.ok(Math.hypot(player.position.x - rival.position.x, player.position.z - rival.position.z) > 0.58);
      assert.equal(player.alive, false);
      assert.equal(rival.alive, false);
      assert.equal(next.winner, 'grid');
    }
  });

  it('lets separated parallel riders survive', () => {
    const state = running();
    place(state, 'player', 0, 0, 1);
    place(state, 'rival-a', 0, 1, 1);
    const next = advanceGridRace(state, idle, 0.1);
    assert.equal(next.riders.player.alive, true);
    assert.equal(next.riders['rival-a'].alive, true);
    assert.equal(next.phase, 'running');
  });

  it('awards the grid when the last rival and player crash on the same tick', () => {
    const state = running();
    state.riders['rival-b'].alive = false;
    state.riders['rival-c'].alive = false;
    place(state, 'player', -0.35, 0, 1);
    place(state, 'rival-a', 0.35, 0, 3);
    const next = advanceGridRace(state, idle, 0.1);
    assert.equal(next.riders.player.alive, false);
    assert.equal(next.riders['rival-a'].alive, false);
    assert.equal(next.winner, 'grid');
    assert.deepEqual(next.scores, { player: 0, grid: 1 });
  });

  it('removes crashed rival trails while retaining player and living rival trails', () => {
    const state = running();
    place(state, 'rival-a', GRID_ARENA_HALF - 0.3, 0, 1);
    state.trails = [
      { id: 1, owner: 'rival-a', from: { x: -8, z: 0 }, to: { x: -8, z: 3 } },
      { id: 2, owner: 'player', from: { x: -6, z: 0 }, to: { x: -6, z: 3 } },
      { id: 3, owner: 'rival-b', from: { x: -4, z: 0 }, to: { x: -4, z: 3 } },
    ];
    state.nextTrailId = 4;
    const next = advanceGridRace(state, idle, 0.1);
    assert.equal(next.riders['rival-a'].alive, false);
    assert.deepEqual(next.trails.map(({ owner }) => owner), ['player', 'rival-b']);
    assert.equal(next.phase, 'running');
  });
});

describe('grid race round and match lifetime', () => {
  for (const winner of ['player', 'grid'] as const) {
    it(`awards ${winner} exactly once and starts a fresh round after the result delay`, () => {
      const won = winRound(winner);
      assert.equal(won.phase, 'round-over');
      assert.equal(won.roundTimer, 2.25);
      assert.equal(won.winner, winner);
      assert.equal(won.scores[winner], 1);
      assert.equal(won.matchWinner, null);
      let state = won;
      for (let index = 0; index < 22; index += 1) {
        state = advanceGridRace(state, { turn: 1, boost: true }, 0.1);
      }
      assert.equal(state.phase, 'round-over');
      assert.deepEqual(state.scores, won.scores);
      assert.deepEqual(state.riders, won.riders);
      state = advanceGridRace(state, idle, 0.1);
      assert.deepEqual(state, {
        ...createGridRaceSimulation(won.seed + 17), round: 2, scores: won.scores,
      });
    });

    it(`finishes the match after ${GRID_MATCH_WINS} ${winner} wins and cannot score again`, () => {
      const scores = { player: 1, grid: 1 };
      scores[winner] = GRID_MATCH_WINS - 1;
      const won = winRound(winner, scores);
      assert.equal(won.scores[winner], GRID_MATCH_WINS);
      assert.equal(won.phase, 'round-over');
      const finished = advanceUntil(won, 'match-over');
      assert.equal(finished.matchWinner, winner);
      assert.equal(finished.winner, winner);
      const next = advanceGridRace(finished, { turn: 1, boost: true }, 0.1);
      assert.equal(next.phase, 'match-over');
      assert.deepEqual(next.scores, finished.scores);
      assert.deepEqual(next.riders, finished.riders);
      assert.deepEqual(next.trails, finished.trails);
    });
  }

  it('restarts a completed match with empty scores, full energy and a new deterministic seed', () => {
    const state = advanceUntil(winRound('grid', { player: 1, grid: 2 }), 'match-over');
    const before = structuredClone(state);
    assert.deepEqual(restartGridRace(freezeDeep(state)), createGridRaceSimulation(state.seed + 101));
    assert.deepEqual(state, before);
  });
});
