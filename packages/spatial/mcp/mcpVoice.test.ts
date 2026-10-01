import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLightCycleMatch,
  startLightCycleRoundImmediately,
  type LightCycleMatchState,
} from '../lightcycle/tabletopCore.ts';
import { deriveMcpVoiceCue } from './mcpVoice.ts';

test('MCP speaks one stable line for the round countdown', () => {
  const state = createLightCycleMatch();
  const cue = deriveMcpVoiceCue(state, 'p1');

  assert.equal(cue?.name, 'race-start');
  assert.equal(cue?.eventKey, 'race-start:1');
});

test('MCP uses the short nostalgia line only at match end', () => {
  const state: LightCycleMatchState = {
    ...createLightCycleMatch(),
    phase: 'match-over',
    matchWinner: 'p1',
  };
  const cue = deriveMcpVoiceCue(state, 'p1');

  assert.equal(cue?.name, 'match-end');
  assert.equal(cue?.text, 'End of line.');
  assert.equal(cue?.source, 'film-quote');
});

test('MCP derez callout is perspective-aware', () => {
  const running = startLightCycleRoundImmediately(createLightCycleMatch());
  const state: LightCycleMatchState = {
    ...running,
    tick: 42,
    derezEvents: [
      {
        playerId: 'p1',
        tick: 42,
        point: { x: 0, z: 0 },
        cause: 'opponent-trail',
        byPlayerId: 'p2',
        seed: 99,
      },
    ],
  };

  assert.equal(deriveMcpVoiceCue(state, 'p1')?.name, 'derez-local');
  assert.equal(deriveMcpVoiceCue(state, 'p2')?.name, 'derez-rival');
});

test('MCP boost cue is bucketed to avoid fixed-tick chatter', () => {
  const running = startLightCycleRoundImmediately(createLightCycleMatch());
  const boosted: LightCycleMatchState = {
    ...running,
    tick: 91,
    riders: {
      ...running.riders,
      p1: {
        ...running.riders.p1,
        speedUnitsPerTick: running.config.boostStepUnits,
      },
    },
  };

  const first = deriveMcpVoiceCue(boosted, 'p1');
  const second = deriveMcpVoiceCue({ ...boosted, tick: 92 }, 'p1');

  assert.equal(first?.name, 'boost');
  assert.equal(first?.eventKey, second?.eventKey);
});
