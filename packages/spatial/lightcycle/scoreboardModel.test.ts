import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createLightCycleMatch, startLightCycleRoundImmediately } from './tabletopCore.ts';
import {
  LIGHTCYCLE_RIVE_BINDINGS,
  LIGHTCYCLE_SCOREBOARD_ARTBOARD,
  LIGHTCYCLE_SCOREBOARD_MACHINE,
  LIGHTCYCLE_SCOREBOARD_VIEW_MODEL,
  createLightCycleRiveBindings,
  createLightCycleScoreboardModel,
} from './scoreboardModel.ts';

describe('light-cycle scoreboard model', () => {
  it('uses lobby presence before a match exists', () => {
    const model = createLightCycleScoreboardModel({
      state: null,
      joinCode: 'K7M2QX',
      presence: {
        p1: { name: 'Michael', connected: true, localized: true, ready: true },
        p2: { name: 'Alex', connected: true, localized: true, ready: false },
      },
    });
    assert.equal(model.player1.name, 'Michael');
    assert.equal(model.player2.name, 'Alex');
    assert.equal(model.match.phase, 'lobby');
    assert.equal(model.match.joinCode, 'K7M2QX');
  });

  it('maps authoritative scores and final-grid state', () => {
    const state = startLightCycleRoundImmediately(
      createLightCycleMatch({
        names: { p1: 'Michael', p2: 'Alex' },
        config: { roundsToWin: 5 },
      }),
    );
    state.scores.p1 = 4;
    state.scores.p2 = 4;
    const model = createLightCycleScoreboardModel({ state });
    assert.equal(model.player1.score, 4);
    assert.equal(model.player2.score, 4);
    assert.equal(model.match.finalGrid, true);
    assert.equal(model.match.phase, 'playing');
  });

  it('flattens the same binding paths for native and web Rive runtimes', () => {
    const state = startLightCycleRoundImmediately(
      createLightCycleMatch({
        names: { p1: 'Michael', p2: 'GRID AI' },
      }),
    );
    state.scores.p1 = 2;
    state.scores.p2 = 1;

    const bindings = createLightCycleRiveBindings(
      createLightCycleScoreboardModel({ state }),
    );

    assert.equal(LIGHTCYCLE_SCOREBOARD_ARTBOARD, 'LightCycleScoreboard');
    assert.equal(LIGHTCYCLE_SCOREBOARD_MACHINE, 'Main');
    assert.equal(LIGHTCYCLE_SCOREBOARD_VIEW_MODEL, 'MatchScoreboard');
    assert.equal(
      bindings[LIGHTCYCLE_RIVE_BINDINGS.player1.name],
      'Michael',
    );
    assert.equal(
      bindings[LIGHTCYCLE_RIVE_BINDINGS.player1.score],
      2,
    );
    assert.equal(
      bindings[LIGHTCYCLE_RIVE_BINDINGS.player2.name],
      'GRID AI',
    );
    assert.deepEqual(
      bindings[LIGHTCYCLE_RIVE_BINDINGS.match.phase],
      { kind: 'enum', value: 'playing' },
    );
  });
});
