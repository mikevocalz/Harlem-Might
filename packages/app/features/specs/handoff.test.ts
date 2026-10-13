import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ExplorePlace } from '../explore/explore.store.ts';
import { projectHarlemSpecs } from './experience.ts';
import {
  createSpecsHandoffSnapshot,
  isSpecsHandoffSnapshot,
  isSpecsHandoffCommand,
  SpecsHandoffGate,
  MAX_SPECS_COMMANDS_PER_HANDOFF,
} from './handoff.ts';

const place: ExplorePlace = {
  id: 'apollo-theater', name: 'Apollo Theater', category: 'Culture',
  area: 'Harlem', tags: [], lngLat: [-73.95, 40.81],
};
const navigation = {
  session: { phase: 'idle' as const },
  routeLoading: { kind: 'idle' as const },
  positioning: { kind: 'acquiring' as const },
  arTracking: { kind: 'off' as const },
  progress: { kind: 'none' as const },
};
function make(revision = 1) {
  const frame = projectHarlemSpecs({ places: [place], navigation });
  return createSpecsHandoffSnapshot({
    frame, handoffId: 'paired-epoch-1', sessionId: 'walk-session-1',
    revision, nowMs: 1000,
  });
}
function command(snapshot = make(), id = 'cmd-1') {
  const target = snapshot.presentation.targets[0]!;
  return {
    schemaVersion: 1 as const, handoffId: snapshot.handoffId,
    sessionId: snapshot.sessionId, commandId: id,
    expectedRevision: snapshot.revision,
    targetId: target.targetId, action: target.action,
  };
}

describe('Specs paired handoff contract', () => {
  it('transfers bounded public presentation only, not route data or account state', () => {
    const snapshot = make();
    assert.equal(snapshot.schemaVersion, 1);
    assert.ok(isSpecsHandoffSnapshot(snapshot, 1001));
    assert.equal('navigation' in snapshot.presentation, false);
    assert.equal(JSON.stringify(snapshot).includes('accessToken'), false);
  });

  it('requires matching session, epoch, target and revision and rejects duplicate commands', () => {
    const gate = new SpecsHandoffGate();
    const snap = make();
    assert.equal(gate.offer(snap, 1000), true);
    assert.equal(gate.authorize(command(snap), 2000), 'place:apollo-theater');
    assert.equal(gate.authorize(command(snap), 2000), null);
    assert.equal(gate.authorize({ ...command(snap, 'cmd-2'), sessionId: 'someone-else' }, 2000), null);
    assert.equal(gate.authorize({ ...command(snap, 'cmd-3'), expectedRevision: 0 }, 2000), null);
    assert.equal(gate.authorize({ ...command(snap, 'cmd-4'), action: 'directions:apollo-theater' }, 2000), null);
    assert.equal(gate.authorize({ ...command(snap, 'cmd-5'), targetId: 'unknown' }, 2000), null);
    assert.equal(gate.offer(snap, 2000), false);
    assert.equal(gate.offer(make(2), 2000), true);
    assert.equal(gate.authorize(command(snap, 'cmd-6'), 2000), null);
    assert.equal(gate.authorize(command(make(2), 'cmd-7'), 2000), 'place:apollo-theater');
    gate.clear();
    assert.equal(gate.authorize(command(make(2), 'cmd-8'), 2000), null);
  });

  it('expires snapshots and refuses future clocks and oversized presentation content', () => {
    const gate = new SpecsHandoffGate();
    const snap = make();
    assert.equal(isSpecsHandoffSnapshot(snap, 31_000), false);
    assert.equal(gate.offer(snap, 31_000), false);
    assert.equal(isSpecsHandoffSnapshot({ ...snap, issuedAtMs: 9_000 }, 1000), false);
    assert.equal(isSpecsHandoffSnapshot({ ...snap, presentation: {
      ...snap.presentation, scene: { ...snap.presentation.scene, nodes: [
        ...snap.presentation.scene.nodes, {
          id: 'too-long', kind: 'text', text: 'X'.repeat(99999),
        },
      ] },
    } }, 1000), false);
  });

  it('fails closed on unrecognized fields and destructive commands without confirmation', () => {
    assert.equal(isSpecsHandoffCommand({ ...command(), token: 'not-allowed' }), false);
    assert.equal(isSpecsHandoffCommand({ ...command(), action: 'end-navigation' }), false);
    assert.equal(isSpecsHandoffCommand({ ...command(), action: 'end-navigation', confirmed: true }), true);
    assert.equal(isSpecsHandoffSnapshot({ ...make(), bearer: 'leak' }, 1000), false);
  });

  it('does not evict receipt IDs when the bounded idempotency ledger fills', () => {
    const gate = new SpecsHandoffGate();
    const snapshot = make();
    assert.equal(gate.offer(snapshot, 1000), true);
    for (let i = 0; i < MAX_SPECS_COMMANDS_PER_HANDOFF; i++) {
      assert.equal(gate.authorize(command(snapshot, 'cmd-' + i), 2000), 'place:apollo-theater');
    }
    assert.equal(gate.authorize(command(snapshot, 'overflow'), 2000), null);
    assert.equal(gate.authorize(command(snapshot, 'cmd-0'), 2000), null);
  });
});
