import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LIGHTCYCLE_ARENA_HALF,
  advanceLightCycleMatch,
  createLightCycleMatch,
  lightCycleStateHash,
  startLightCycleRoundImmediately,
  type LightCycleMatchState,
} from './tabletopCore.ts';

function running(): LightCycleMatchState {
  return startLightCycleRoundImmediately(
    createLightCycleMatch({
      seed: 42,
      names: { p1: 'Michael', p2: 'Alex' },
      config: { countdownTicks: 1, roundOverTicks: 1 },
    }),
  );
}

function setRider(
  state: LightCycleMatchState,
  id: 'p1' | 'p2',
  x: number,
  z: number,
  direction: 0 | 1 | 2 | 3,
) {
  const rider = state.riders[id];
  rider.position = { x, z };
  rider.segmentStart = { x, z };
  rider.direction = direction;
}

describe('deterministic tabletop light-cycle core', () => {
  it('uses persistent trails after a player derezzes', () => {
    let state = running();
    state.trails.push({
      id: 1,
      owner: 'p2',
      from: { x: -1000, z: 0 },
      to: { x: 1000, z: 0 },
      createdTick: 1,
    });
    state.nextTrailId = 2;
    setRider(state, 'p1', 0, 400, 0);
    setRider(state, 'p2', 10_000, 10_000, 1);

    state = advanceLightCycleMatch(state, {});
    state = advanceLightCycleMatch(state, {});
    state = advanceLightCycleMatch(state, {});

    assert.equal(state.riders.p1.alive, false);
    assert.ok(state.trails.some((segment) => segment.owner === 'p2'));
  });

  it('kills a cycle at the arena boundary', () => {
    let state = running();
    setRider(state, 'p1', LIGHTCYCLE_ARENA_HALF - 50, 0, 1);
    setRider(state, 'p2', 0, 10_000, 3);
    state = advanceLightCycleMatch(state, {});
    assert.equal(state.riders.p1.alive, false);
    assert.equal(state.derezEvents[0]?.cause, 'boundary');
    assert.equal(state.riders.p1.position.x, LIGHTCYCLE_ARENA_HALF);
  });

  it('detects an opponent trail with a swept boosted move', () => {
    let state = running();
    state.config.boostStepUnits = 1000;
    state.trails.push({
      id: 1,
      owner: 'p2',
      from: { x: 0, z: -1000 },
      to: { x: 0, z: 1000 },
      createdTick: 1,
    });
    state.nextTrailId = 2;
    setRider(state, 'p1', -500, 0, 1);
    setRider(state, 'p2', 10_000, 10_000, 1);

    state = advanceLightCycleMatch(state, { p1: { boost: true } });
    assert.equal(state.riders.p1.alive, false);
    assert.equal(state.riders.p1.position.x, 0);
    assert.equal(state.derezEvents[0]?.cause, 'opponent-trail');
  });

  it('resolves a head swap as a draw without player-order bias', () => {
    let state = running();
    state.config.baseStepUnits = 1000;
    setRider(state, 'p1', -500, 0, 1);
    setRider(state, 'p2', 500, 0, 3);
    state = advanceLightCycleMatch(state, {});
    assert.equal(state.riders.p1.alive, false);
    assert.equal(state.riders.p2.alive, false);
    assert.equal(state.roundWinner, 'draw');
    assert.equal(state.scores.p1, 0);
    assert.equal(state.scores.p2, 0);
    assert.ok(state.derezEvents.every((event) => event.cause === 'head-on' || event.cause === 'head-swap'));
  });

  it('resolves a perpendicular crossing by arrival time', () => {
    let state = running();
    state.config.baseStepUnits = 1000;
    state.config.boostStepUnits = 1600;
    setRider(state, 'p1', -800, 0, 1);
    setRider(state, 'p2', 0, -800, 2);
    state = advanceLightCycleMatch(state, { p1: { boost: true } });

    assert.equal(state.riders.p1.alive, true);
    assert.equal(state.riders.p2.alive, false);
    assert.equal(state.derezEvents[0]?.cause, 'opponent-trail');
    assert.equal(state.derezEvents[0]?.byPlayerId, 'p1');
  });

  it('resolves equal-time perpendicular crossings as a draw', () => {
    let state = running();
    state.config.baseStepUnits = 1000;
    setRider(state, 'p1', -500, 0, 1);
    setRider(state, 'p2', 0, -500, 2);
    state = advanceLightCycleMatch(state);
    assert.equal(state.roundWinner, 'draw');
    assert.deepEqual(state.derezEvents.map(({ cause, point }) => ({ cause, point })), [
      { cause: 'crossing', point: { x: 0, z: 0 } },
      { cause: 'crossing', point: { x: 0, z: 0 } },
    ]);
  });

  it('also gives the second rider precedence when it reaches the crossing first', () => {
    let state = running();
    state.config.baseStepUnits = 1000;
    state.config.boostStepUnits = 1600;
    setRider(state, 'p1', -800, 0, 1);
    setRider(state, 'p2', 0, -800, 2);
    state = advanceLightCycleMatch(state, { p2: { boost: true } });
    assert.equal(state.riders.p1.alive, false);
    assert.equal(state.riders.p2.alive, true);
    assert.equal(state.derezEvents[0]?.cause, 'opponent-trail');
    assert.equal(state.derezEvents[0]?.byPlayerId, 'p2');
  });

  for (const blockedId of ['p1', 'p2'] as const) {
    for (const trailOwner of ['p1', 'p2'] as const) {
      it(`does not collide riders beyond ${blockedId}'s earlier ${trailOwner} trail crash`, () => {
        const state = running();
        state.config.baseStepUnits = 1000;
        setRider(state, 'p1', -800, 0, 1);
        setRider(state, 'p2', 0, -800, 2);
        state.trails.push({
          id: 1,
          owner: trailOwner,
          from: blockedId === 'p1' ? { x: -700, z: -100 } : { x: -100, z: -700 },
          to: blockedId === 'p1' ? { x: -700, z: 100 } : { x: 100, z: -700 },
          createdTick: 0,
        });
        state.nextTrailId = 2;

        const next = advanceLightCycleMatch(state);
        const survivorId = blockedId === 'p1' ? 'p2' : 'p1';
        assert.equal(next.riders[blockedId].alive, false);
        assert.deepEqual(next.riders[blockedId].position,
          blockedId === 'p1' ? { x: -700, z: 0 } : { x: 0, z: -700 });
        assert.equal(next.riders[survivorId].alive, true);
        assert.deepEqual(next.riders[survivorId].position,
          survivorId === 'p1' ? { x: 200, z: 0 } : { x: 0, z: 200 });
        assert.equal(next.derezEvents.length, 1);
        assert.equal(next.derezEvents[0]?.cause, trailOwner === blockedId ? 'own-trail' : 'opponent-trail');
      });
    }
  }

  it('lets a reachable pair collision replace a static crash at the same distance', () => {
    const state = running();
    state.config.baseStepUnits = 1000;
    setRider(state, 'p1', -500, 0, 1);
    setRider(state, 'p2', 0, -500, 2);
    state.trails.push({ id: 1, owner: 'p1', from: { x: 0, z: 0 },
      to: { x: 0, z: 100 }, createdTick: 0 });
    state.nextTrailId = 2;

    const next = advanceLightCycleMatch(state);
    assert.equal(next.roundWinner, 'draw');
    assert.deepEqual(next.derezEvents.map(({ cause, point }) => ({ cause, point })), [
      { cause: 'crossing', point: { x: 0, z: 0 } },
      { cause: 'crossing', point: { x: 0, z: 0 } },
    ]);
  });

  it("keeps the first arrival's later static crash when only the second arrival hits its new trail", () => {
    const state = running();
    state.config.baseStepUnits = 1000;
    state.config.boostStepUnits = 1600;
    setRider(state, 'p1', -800, 0, 1);
    setRider(state, 'p2', 0, -800, 2);
    state.trails.push({ id: 1, owner: 'p1', from: { x: 500, z: -100 },
      to: { x: 500, z: 100 }, createdTick: 0 });
    state.nextTrailId = 2;
    const before = structuredClone(state);

    const next = advanceLightCycleMatch(state, { p1: { boost: true } });
    assert.deepEqual(state, before);
    assert.equal(next.roundWinner, 'draw');
    assert.deepEqual(next.derezEvents.map(({ playerId, cause, point }) => ({ playerId, cause, point })), [
      { playerId: 'p1', cause: 'own-trail', point: { x: 500, z: 0 } },
      { playerId: 'p2', cause: 'opponent-trail', point: { x: 0, z: 0 } },
    ]);
    assert.equal(next.riders.p1.energy, 988);
    assert.deepEqual(next.trails.slice(1).map(({ owner, from, to }) => ({ owner, from, to })), [
      { owner: 'p1', from: { x: -800, z: 0 }, to: { x: 500, z: 0 } },
      { owner: 'p2', from: { x: 0, z: -800 }, to: { x: 0, z: 0 } },
    ]);
  });

  it('commits both independent static crashes before deciding the round', () => {
    const state = running();
    setRider(state, 'p1', LIGHTCYCLE_ARENA_HALF - 50, 0, 1);
    setRider(state, 'p2', 0, -LIGHTCYCLE_ARENA_HALF + 100, 0);

    const next = advanceLightCycleMatch(state);
    assert.equal(next.roundWinner, 'draw');
    assert.deepEqual(next.scores, { p1: 0, p2: 0 });
    assert.deepEqual(next.derezEvents.map(({ playerId, cause, point }) => ({ playerId, cause, point })), [
      { playerId: 'p1', cause: 'boundary', point: { x: LIGHTCYCLE_ARENA_HALF, z: 0 } },
      { playerId: 'p2', cause: 'boundary', point: { x: 0, z: -LIGHTCYCLE_ARENA_HALF } },
    ]);
    assert.equal(next.trails.length, 2);
    assert.equal(next.nextTrailId, 3);
  });

  it('does not move or charge boost energy for a dead rider', () => {
    const state = running();
    setRider(state, 'p1', -70, 0, 1);
    setRider(state, 'p2', 70, 0, 3);
    state.riders.p1.alive = false;
    state.riders.p1.energy = 250;
    state.riders.p1.speedUnitsPerTick = 0;

    const next = advanceLightCycleMatch(state, { p1: { boost: true } });
    assert.deepEqual(next.riders.p1, state.riders.p1);
    assert.equal(next.riders.p2.alive, true);
    assert.deepEqual(next.riders.p2.position, { x: -70, z: 0 });
    assert.deepEqual(next.derezEvents, []);
    assert.equal(next.roundWinner, 'p2');
  });

  it('produces identical hashes from the same seed and ordered inputs', () => {
    const replay = [
      { p1: { turn: -1 as const } },
      {},
      { p2: { turn: 1 as const } },
      { p1: { boost: true } },
      {},
    ];
    let a = running();
    let b = running();
    for (const input of replay) {
      a = advanceLightCycleMatch(a, input);
      b = advanceLightCycleMatch(b, input);
    }
    assert.equal(lightCycleStateHash(a), lightCycleStateHash(b));
    assert.deepEqual(a, b);
  });
});
