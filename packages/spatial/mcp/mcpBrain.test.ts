import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLightCycleMatch,
  startLightCycleRoundImmediately,
  type LightCycleMatchState,
} from '../lightcycle/tabletopCore.ts';
import { deriveMcpPresentation } from './mcpBrain.ts';

test('MCP projects synchronized countdown state', () => {
  const match = createLightCycleMatch({
    names: { p1: 'NOVA', p2: 'ARES' },
  });
  const mcp = deriveMcpPresentation(match, 'p1');

  assert.equal(mcp.mood, 'countdown');
  assert.equal(mcp.headline, 'MCP // GRID CONTROL');
  assert.match(mcp.detail, /RACE INITIALIZATION/);
});

test('MCP reacts to deterministic derez events', () => {
  const match = startLightCycleRoundImmediately(createLightCycleMatch());
  const state: LightCycleMatchState = {
    ...match,
    phase: 'round-over',
    roundWinner: 'p2',
    riders: {
      ...match.riders,
      p1: { ...match.riders.p1, alive: false },
    },
    derezEvents: [
      {
        playerId: 'p1',
        tick: 44,
        point: { x: 1200, z: -400 },
        cause: 'opponent-trail',
        byPlayerId: 'p2',
        seed: 1982,
      },
    ],
  };

  const p1 = deriveMcpPresentation(state, 'p1');
  const p2 = deriveMcpPresentation(state, 'p2');

  assert.equal(p1.headline, 'USER DEREZZED');
  assert.equal(p2.headline, 'RIVAL DEREZZED');
  assert.equal(p1.detail, 'RIVAL LIGHT WALL');
  assert.equal(p1.eventKey, 'derez:p1:44:1982');
});

test('MCP projects match outcome from local-player perspective', () => {
  const match = createLightCycleMatch();
  const state: LightCycleMatchState = {
    ...match,
    phase: 'match-over',
    matchWinner: 'p1',
  };

  assert.equal(deriveMcpPresentation(state, 'p1').headline, 'CONTROL BREACH');
  assert.equal(deriveMcpPresentation(state, 'p2').headline, 'SYSTEM SUPREMACY');
});

test('MCP recognizes boost without owning gameplay state', () => {
  const match = startLightCycleRoundImmediately(createLightCycleMatch());
  const state: LightCycleMatchState = {
    ...match,
    riders: {
      ...match.riders,
      p1: {
        ...match.riders.p1,
        speedUnitsPerTick: match.config.boostStepUnits,
      },
    },
  };

  const mcp = deriveMcpPresentation(state);
  assert.equal(mcp.mood, 'overdrive');
  assert.match(mcp.detail, /BOOST/);
});
