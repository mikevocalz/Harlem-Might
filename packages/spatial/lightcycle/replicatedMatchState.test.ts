import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveMcpPresentation } from '../mcp/mcpBrain.ts';
import { deriveMcpVoiceCue } from '../mcp/mcpVoice.ts';
import {
  LIGHTCYCLE_ARENA_HALF,
  advanceLightCycleMatch,
  createLightCycleMatch,
  getLightCycleActiveTrails,
  lightCycleStateHash,
  startLightCycleRoundImmediately,
  type LightCycleMatchState,
  type LightCycleTickInputs,
} from './tabletopCore.ts';
import { createLightCycleScoreboardModel } from './scoreboardModel.ts';
import { createAuthoritativeSnapshot } from './sessionProtocol.ts';
import { isLightCycleMatchState, readLightCycleMatchState } from './replicatedMatchState.ts';

function roundTrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

function resultState() {
  let state = startLightCycleRoundImmediately(createLightCycleMatch());
  state = advanceLightCycleMatch(state);
  state = advanceLightCycleMatch(state, { p1: { turn: -1 } });
  while (state.phase === 'running') state = advanceLightCycleMatch(state);
  assert.ok(state.trails.length > 0);
  assert.ok(state.derezEvents.length > 0);
  return state;
}

function replaceField(state: LightCycleMatchState, path: string, value: unknown) {
  const parts = path.split('.');
  const key = parts.pop()!;
  let record = state as unknown as Record<string, unknown>;
  for (const part of parts) record = record[part] as Record<string, unknown>;
  record[key] = value;
}

const nestedFields = [
  'tick', 'round', 'seed', 'phase', 'countdownTicks', 'roundOverTicks',
  'nextTrailId', 'roundWinner', 'matchWinner', 'config', 'riders', 'scores',
  'trails', 'derezEvents',
  ...['roundsToWin', 'baseStepUnits', 'boostStepUnits', 'boostDrainPerTick',
    'boostRegenPerTick', 'turnCooldownTicks', 'countdownTicks', 'roundOverTicks']
    .map((field) => `config.${field}`),
  ...['p1', 'p2'].flatMap((id) => [
    `riders.${id}`, `scores.${id}`,
    ...['id', 'name', 'position', 'segmentStart', 'direction', 'alive', 'energy',
      'speedUnitsPerTick', 'turnCooldownTicks', 'wheelAngleMilliRad', 'lastTurn', 'lastTurnTick']
      .map((field) => `riders.${id}.${field}`),
    ...['position.x', 'position.z', 'segmentStart.x', 'segmentStart.z']
      .map((field) => `riders.${id}.${field}`),
  ]),
  ...['id', 'owner', 'from', 'to', 'createdTick', 'from.x', 'from.z', 'to.x', 'to.z']
    .map((field) => `trails.0.${field}`),
  ...['playerId', 'tick', 'point', 'cause', 'byPlayerId', 'seed', 'point.x', 'point.z']
    .map((field) => `derezEvents.0.${field}`),
];

describe('replicated LightCycle match state', () => {
  it('rejects the old shallow-guard payload and non-record roots', () => {
    for (const value of [null, undefined, false, 1, 'running', [], {
      tick: 0, round: 1, phase: 'running', config: {}, riders: {}, scores: {}, trails: [],
    }]) {
      assert.equal(isLightCycleMatchState(value), false);
      assert.equal(readLightCycleMatchState(value), null);
    }
  });

  it('requires every nested field promised by the match contract', () => {
    for (const path of nestedFields) {
      const state = resultState();
      replaceField(state, path, undefined);
      assert.equal(readLightCycleMatchState(state), null, path);
    }
  });

  it('does not coerce arrays, booleans or object values into typed fields', () => {
    const cases: [string, unknown][] = [
      ['phase', ['running']], ['phase', 'paused'], ['roundWinner', ['p1']],
      ['matchWinner', 'draw'], ['riders', []], ['scores', []], ['config', []],
      ['riders.p1', []], ['riders.p2', {}], ['riders.p1.id', 'p2'],
      ['riders.p1.id', ['p1']], ['riders.p1.name', {}], ['riders.p1.alive', 1],
      ['riders.p1.direction', '1'], ['riders.p1.lastTurn', [-1]],
      ['riders.p1.position', []], ['riders.p2.segmentStart', true],
      ['trails', {}], ['derezEvents', {}], ['trails.0', null],
      ['trails.0.owner', ['p1']], ['trails.0.from', null],
      ['derezEvents.0', []], ['derezEvents.0.playerId', 'p3'],
      ['derezEvents.0.byPlayerId', {}], ['derezEvents.0.cause', ['boundary']],
      ['derezEvents.0.cause', 'unknown'], ['derezEvents.0.point', false],
      ['config.roundsToWin', [5]], ['config.roundsToWin', 4],
    ];
    for (const [path, value] of cases) {
      const state = resultState();
      replaceField(state, path, value);
      assert.equal(readLightCycleMatchState(state), null, path);
    }
  });

  it('rejects non-finite and fractional numeric fields at every depth', () => {
    const numericFields = [
      'tick', 'round', 'seed', 'countdownTicks', 'roundOverTicks', 'nextTrailId',
      'scores.p1', 'scores.p2',
      ...['baseStepUnits', 'boostStepUnits', 'boostDrainPerTick', 'boostRegenPerTick',
        'turnCooldownTicks', 'countdownTicks', 'roundOverTicks'].map((field) => `config.${field}`),
      ...['position.x', 'position.z', 'segmentStart.x', 'segmentStart.z', 'direction',
        'energy', 'speedUnitsPerTick', 'turnCooldownTicks', 'wheelAngleMilliRad', 'lastTurnTick']
        .map((field) => `riders.p1.${field}`),
      'trails.0.id', 'trails.0.createdTick', 'trails.0.from.x', 'trails.0.to.z',
      'derezEvents.0.tick', 'derezEvents.0.seed', 'derezEvents.0.point.x',
    ];
    for (const path of numericFields) {
      for (const value of [NaN, Infinity, -Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1, '1']) {
        const state = resultState();
        replaceField(state, path, value);
        assert.equal(readLightCycleMatchState(state), null, `${path}: ${String(value)}`);
      }
    }
  });

  it('enforces the arena, timer, score, rider and event ranges', () => {
    const cases: [string, unknown][] = [
      ['tick', -1], ['round', 0], ['nextTrailId', 0],
      ['countdownTicks', -1], ['countdownTicks', 181], ['roundOverTicks', 76],
      ['config.baseStepUnits', 0], ['config.boostStepUnits', -1],
      ['config.boostDrainPerTick', -1], ['config.boostRegenPerTick', -1],
      ['config.turnCooldownTicks', -1], ['config.countdownTicks', -1], ['config.roundOverTicks', -1],
      ['scores.p1', -1], ['scores.p2', 6], ['riders.p1.energy', -1], ['riders.p1.energy', 1001],
      ['riders.p1.direction', 4], ['riders.p1.lastTurn', 2],
      ['riders.p1.position.x', LIGHTCYCLE_ARENA_HALF + 1],
      ['riders.p1.segmentStart.z', -LIGHTCYCLE_ARENA_HALF - 1],
      ['riders.p1.speedUnitsPerTick', -1], ['riders.p1.speedUnitsPerTick', 225],
      ['riders.p1.turnCooldownTicks', 4], ['riders.p1.wheelAngleMilliRad', 6283],
      ['riders.p1.lastTurnTick', -2], ['riders.p1.lastTurnTick', 1000],
      ['riders.p1.name', 'a'.repeat(17)], ['riders.p1.name', '🏍'.repeat(17)],
      ['trails.0.id', -1], ['trails.0.id', 1000], ['trails.0.createdTick', -1],
      ['trails.0.createdTick', 1000], ['trails.0.to.x', LIGHTCYCLE_ARENA_HALF + 1],
      ['derezEvents.0.tick', -1], ['derezEvents.0.tick', 1000],
      ['derezEvents.0.seed', -1], ['derezEvents.0.seed', 0x1_0000_0000],
      ['derezEvents.0.point.z', -LIGHTCYCLE_ARENA_HALF - 1],
    ];
    for (const [path, value] of cases) {
      const state = resultState();
      replaceField(state, path, value);
      assert.equal(readLightCycleMatchState(state), null, `${path}: ${String(value)}`);
    }
  });

  it('rejects sparse arrays, excess entries and diagonal trail geometry', () => {
    const state = resultState();
    assert.equal(readLightCycleMatchState({ ...state, trails: Array(1) }), null);
    assert.equal(readLightCycleMatchState({ ...state, derezEvents: Array(1) }), null);
    assert.equal(readLightCycleMatchState({ ...state, nextTrailId: 1 }), null);
    assert.equal(readLightCycleMatchState({
      ...state, derezEvents: Array(3).fill(state.derezEvents[0]),
    }), null);
    replaceField(state, 'trails.0.to', { x: 100, z: 200 });
    assert.equal(readLightCycleMatchState(state), null);
    const diagonalRider = createLightCycleMatch();
    diagonalRider.riders.p1.position = { x: 100, z: 200 };
    assert.equal(readLightCycleMatchState(diagonalRider), null);
  });

  it('round-trips every phase, round reset, boost and derez from complete deterministic matches', () => {
    for (const roundsToWin of [3, 5, 7] as const) {
      let state = createLightCycleMatch({
        seed: 0xffff_ffff,
        names: { p1: '🏍'.repeat(16), p2: '' },
        config: { roundsToWin, countdownTicks: 2, roundOverTicks: 2 },
      });
      const phases = new Set<string>();
      let sawDerez = false;
      for (let step = 0; step < 2000; step += 1) {
        const wireValue = roundTrip(state);
        const parsed = readLightCycleMatchState(wireValue);
        assert.ok(parsed, `${state.phase}, round ${state.round}, tick ${state.tick}`);
        assert.strictEqual(parsed, wireValue);
        assert.deepEqual(parsed, state);
        assert.equal(lightCycleStateHash(parsed), lightCycleStateHash(state));
        assert.deepEqual(createAuthoritativeSnapshot(parsed), createAuthoritativeSnapshot(state));
        assert.deepEqual(createLightCycleScoreboardModel({ state: parsed }), createLightCycleScoreboardModel({ state }));
        assert.deepEqual(getLightCycleActiveTrails(parsed), getLightCycleActiveTrails(state));
        assert.deepEqual(deriveMcpPresentation(parsed), deriveMcpPresentation(state));
        assert.deepEqual(deriveMcpVoiceCue(parsed), deriveMcpVoiceCue(state));
        phases.add(parsed.phase);
        sawDerez ||= parsed.derezEvents.length > 0;
        if (state.phase === 'match-over') break;
        const inputs: LightCycleTickInputs = {
          p1: { turn: state.tick === state.config.countdownTicks + 1 ? -1 : 0, boost: true },
        };
        state = advanceLightCycleMatch(state, inputs);
        assert.deepEqual(advanceLightCycleMatch(parsed, inputs), state);
      }
      assert.deepEqual(phases, new Set(['countdown', 'running', 'round-over', 'match-over']));
      assert.ok(sawDerez);
      assert.equal(state.scores.p2, roundsToWin);
    }
  });

  it('accepts double-derez draws and zero-duration configuration without coercion', () => {
    let state = startLightCycleRoundImmediately(createLightCycleMatch({
      config: { countdownTicks: 0, roundOverTicks: 0, turnCooldownTicks: 0,
        boostDrainPerTick: 0, boostRegenPerTick: 0 },
    }));
    while (state.phase === 'running') state = advanceLightCycleMatch(state);
    assert.equal(state.roundWinner, 'draw');
    assert.equal(state.derezEvents.length, 2);
    assert.ok(readLightCycleMatchState(roundTrip(state)));
    assert.ok(readLightCycleMatchState(roundTrip(advanceLightCycleMatch(state))));
  });

  it('accepts supported custom rates, negative seeds and 16 astral-character names', () => {
    let state = startLightCycleRoundImmediately(createLightCycleMatch({
      seed: -1982,
      names: { p1: '😀'.repeat(16), p2: 'PLAYER 2' },
      config: { baseStepUnits: 224, boostStepUnits: 140, countdownTicks: 0,
        roundOverTicks: 0, turnCooldownTicks: 0 },
    }));
    assert.equal(state.riders.p1.name.length, 32);
    assert.ok(readLightCycleMatchState(roundTrip(state)));
    for (let tick = 0; tick < 500; tick++) {
      state = advanceLightCycleMatch(state, { p1: { boost: tick % 3 === 0 },
        p2: { turn: tick % 37 === 0 ? 1 : 0 } });
      assert.ok(readLightCycleMatchState(roundTrip(state)), `custom tick ${tick}`);
    }
  });

  it('falls back to the lobby model when the replicated payload is invalid', () => {
    const state = readLightCycleMatchState({ ...createLightCycleMatch(), riders: {} });
    const model = createLightCycleScoreboardModel({ state });
    assert.equal(state, null);
    assert.equal(model.match.phase, 'localizing');
    assert.equal(model.player1.name, 'PLAYER 1');
    assert.equal(model.player2.score, 0);
  });
});
