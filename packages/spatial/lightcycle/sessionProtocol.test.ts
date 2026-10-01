import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createAuthoritativeSnapshot,
  inputsForTick,
  LightCycleInputQueue,
} from './sessionProtocol.ts';
import {
  createLightCycleMatch,
  startLightCycleRoundImmediately,
} from './tabletopCore.ts';
import {
  LIGHTCYCLE_ASSET_NODES,
  LIGHTCYCLE_CLIPS,
  createLightCycleRenderFrame,
  validateLightCycleAssetManifest,
} from './assetContract.ts';

describe('light-cycle session protocol', () => {
  it('rejects duplicate and stale input events', () => {
    const queue = new LightCycleInputQueue();
    const event = {
      playerId: 'p2' as const,
      sequence: 1,
      targetTick: 5,
      command: 'TURN_LEFT' as const,
    };
    assert.deepEqual(queue.push(event, 2), { accepted: true });
    assert.deepEqual(queue.push(event, 2), {
      accepted: false,
      reason: 'duplicate-sequence',
    });
    assert.deepEqual(
      queue.push({ ...event, sequence: 2, targetTick: 2 }, 2),
      { accepted: false, reason: 'stale-tick' },
    );
  });

  it('reduces sparse ordered commands into one tick input', () => {
    const result = inputsForTick([
      { playerId: 'p1', sequence: 1, targetTick: 8, command: 'TURN_RIGHT' },
      { playerId: 'p1', sequence: 2, targetTick: 8, command: 'BOOST_DOWN' },
      { playerId: 'p2', sequence: 1, targetTick: 8, command: 'TURN_LEFT' },
    ]);
    assert.deepEqual(result, {
      p1: { turn: 1, boost: true },
      p2: { turn: -1 },
    });
  });

  it('builds an authoritative snapshot with the deterministic state hash', () => {
    const state = startLightCycleRoundImmediately(
      createLightCycleMatch({ seed: 77 }),
    );
    const snapshot = createAuthoritativeSnapshot(state);
    assert.equal(snapshot.tick, state.tick);
    assert.equal(snapshot.players.p1.x, state.riders.p1.position.x);
    assert.match(snapshot.stateHash, /^[0-9a-f]{8}$/);
  });
});

describe('light-cycle renderer asset contract', () => {
  it('accepts the canonical model node and clip names', () => {
    const result = validateLightCycleAssetManifest({
      nodeNames: Object.values(LIGHTCYCLE_ASSET_NODES),
      clipNames: LIGHTCYCLE_CLIPS,
    });
    assert.equal(result.valid, true);
    assert.deepEqual(result.missingNodes, []);
    assert.deepEqual(result.missingClips, []);
  });

  it('reports missing asset nodes instead of silently degrading', () => {
    const result = validateLightCycleAssetManifest({
      nodeNames: ['LightCycleRoot', 'Chassis'],
      clipNames: [],
    });
    assert.equal(result.valid, false);
    assert.ok(result.missingNodes.includes('FrontWheel'));
    assert.ok(result.missingClips.includes('bike_crumple'));
  });

  it('maps deterministic state into renderer metres and procedural wheel state', () => {
    const state = startLightCycleRoundImmediately(createLightCycleMatch());
    const frame = createLightCycleRenderFrame(state, 'p1');
    assert.equal(frame.playerId, 'p1');
    assert.equal(frame.alive, true);
    assert.ok(Number.isFinite(frame.positionMeters[0]));
    assert.equal(frame.wheelAngleDegrees, 0);
  });
});
