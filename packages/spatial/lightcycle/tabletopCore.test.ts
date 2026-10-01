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
