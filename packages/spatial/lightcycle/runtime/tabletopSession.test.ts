import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { advanceLightCycleMatch, createLightCycleMatch, type LightCycleInputEvent } from '../tabletopCore.ts';
import { tabletopPresenceUpdate } from './tabletopPresence.ts';
import { tabletopRace } from './tabletopRaceStore.ts';
import { tabletopSession } from './tabletopSessionStore.ts';

const player = {
  playerId: 'p1' as const, peerId: 'host-peer', name: 'HOST',
  ready: true, frameLocalized: true, connected: true,
};

function seedRoom(roomId: string) {
  const runtime = tabletopRace.enterRoom(roomId);
  const match = advanceLightCycleMatch(createLightCycleMatch({ seed: 77 }));
  const input: LightCycleInputEvent = {
    playerId: 'p1', sequence: 8, targetTick: 6, command: 'TURN_LEFT',
  };
  runtime.hostState = match;
  runtime.queue.push(input, match.tick);
  runtime.seenSequence.p1 = 8;
  runtime.boostHeld.p2 = true;
  runtime.localSequence = 8;
  runtime.localHistory = [input];
  runtime.lastDerezFxRound = 3;
  runtime.lastDerezFxTick = 42;
  tabletopRace.setRoomRenderState(runtime, match);
  return { runtime, match, input };
}

afterEach(() => tabletopSession.getState().reset());

describe('tabletop presence convergence', () => {
  for (const [transition, state] of [
    ['disconnect', { ...player, connected: false }],
    ['localization loss', { ...player, frameLocalized: false }],
  ] as const) {
    it(`publishes ${transition} once, then converges after the optimistic write`, () => {
      let fields: Record<string, unknown> = { ...tabletopPresenceUpdate({}, player) };
      const writes: Record<string, unknown>[] = [];
      const reconcile = () => {
        const update = tabletopPresenceUpdate(fields, state);
        if (update) {
          writes.push(update);
          fields = { ...fields, ...update };
        }
      };
      reconcile();
      reconcile();
      reconcile();
      assert.equal(writes.length, 1);
      assert.equal(fields.localized, false);
      assert.equal(fields.connected, state.connected);
      const recovered = tabletopPresenceUpdate(fields, player);
      assert.ok(recovered);
      assert.equal(recovered.localized, true);
      assert.equal(recovered.connected, true);
      assert.equal(tabletopPresenceUpdate(recovered, player), null);
    });
  }

  it('converges when first joining without localization or a connection', () => {
    const joining = { ...player, ready: false, frameLocalized: false, connected: false };
    const fields = tabletopPresenceUpdate({}, joining);
    assert.ok(fields);
    assert.equal(fields.localized, false);
    assert.equal(tabletopPresenceUpdate(fields, joining), null);
  });

  it('publishes identity, readiness and role changes as well as connection flags', () => {
    const fields = tabletopPresenceUpdate({}, player);
    assert.ok(fields);
    for (const changed of [
      { ...player, peerId: 'reconnected-peer' },
      { ...player, name: 'RENAMED' },
      { ...player, ready: false },
      { ...player, playerId: 'p2' as const },
    ]) {
      const update = tabletopPresenceUpdate(fields, changed);
      assert.ok(update);
      assert.equal(tabletopPresenceUpdate(update, changed), null);
    }
  });
});

describe('tabletop room lifetime', () => {
  it('preserves simulation, queued input and rendering across localization loss and remount', () => {
    tabletopSession.getState().setPlayerName('HOST');
    assert.equal(tabletopSession.getState().beginHost(), true);
    tabletopSession.getState().setLocalized(true);
    tabletopSession.getState().setReady(true);
    const { runtime, match, input } = seedRoom('room-a');
    tabletopSession.getState().setLocalized(false);
    assert.equal(tabletopSession.getState().ready, false);
    assert.equal(tabletopRace.getState().roomRuntime, runtime);
    assert.equal(tabletopRace.getState().hostRenderState, match);

    const remounted = tabletopRace.enterRoom('room-a');
    assert.equal(remounted, runtime);
    assert.equal(remounted.hostState, match);
    assert.deepEqual(remounted.queue.drain(input.targetTick), [input]);
    assert.equal(remounted.seenSequence.p1, 8);
    assert.equal(remounted.localSequence, 8);
    assert.deepEqual(remounted.localHistory, [input]);
    assert.equal(remounted.boostHeld.p2, true);
    assert.equal(remounted.lastDerezFxRound, 3);
    assert.equal(remounted.lastDerezFxTick, 42);
    tabletopSession.getState().setLocalized(true);
    assert.equal(tabletopSession.getState().ready, false);
    tabletopSession.getState().setReady(true);
    const resumed = advanceLightCycleMatch(remounted.hostState!);
    remounted.hostState = resumed;
    tabletopRace.setRoomRenderState(remounted, resumed);
    assert.equal(resumed.tick, match.tick + 1);
    assert.equal(tabletopRace.getState().hostRenderState, resumed);
  });

  it('replaces room A atomically and ignores its late render writes and cleanup', () => {
    const { runtime: old, match } = seedRoom('room-a');
    const next = tabletopRace.enterRoom('room-b');
    assert.notEqual(next, old);
    assert.equal(tabletopRace.getState().hostRenderState, null);
    assert.equal(next.hostState, null);
    assert.deepEqual(next.queue.drain(1000), []);
    assert.deepEqual(next.seenSequence, { p1: -1, p2: -1 });
    assert.deepEqual(next.boostHeld, { p1: false, p2: false });
    assert.equal(next.localSequence, 0);
    assert.deepEqual(next.localHistory, []);
    assert.equal(next.lastDerezFxRound, -1);
    assert.equal(next.lastDerezFxTick, -1);
    tabletopRace.setRoomRenderState(old, match);
    tabletopRace.leaveRoom(old);
    assert.equal(tabletopRace.getState().roomRuntime, next);
    assert.equal(tabletopRace.getState().hostRenderState, null);
  });

  it('leaves both stores empty and starts a fresh lifetime even for the same room ID', () => {
    const { runtime, match } = seedRoom('room-a');
    tabletopRace.leaveRoom(runtime);
    assert.equal(tabletopRace.getState().hostRenderState, null);
    assert.equal(tabletopRace.getState().roomRuntime, null);
    const restarted = tabletopRace.enterRoom('room-a');
    tabletopRace.leaveRoom(runtime);
    tabletopRace.setRoomRenderState(runtime, match);
    assert.notEqual(restarted, runtime);
    assert.equal(restarted.hostState, null);
    assert.equal(tabletopRace.getState().roomRuntime, restarted);
    assert.equal(tabletopRace.getState().hostRenderState, null);
  });

  for (const transition of ['host', 'guest', 'solo', 'close', 'clear', 'reset'] as const) {
    it(`clears the old room before the ${transition} session transition`, () => {
      seedRoom('room-a');
      const session = tabletopSession.getState();
      session.setPlayerName('HOST');
      session.setJoinCode('ABCDEF');
      if (transition === 'host') assert.equal(session.beginHost(), true);
      if (transition === 'guest') assert.equal(session.beginGuest(), true);
      if (transition === 'solo') assert.equal(session.beginSolo(), true);
      if (transition === 'close') session.setSpatialViewOpen(false);
      if (transition === 'clear') session.clearPlacement();
      if (transition === 'reset') session.reset();
      assert.equal(tabletopRace.getState().roomRuntime, null);
      assert.equal(tabletopRace.getState().hostRenderState, null);
    });
  }

  it('does not discard the current match when a new session fails validation', () => {
    const { runtime, match } = seedRoom('room-a');
    tabletopSession.getState().setPlayerName('');
    assert.equal(tabletopSession.getState().beginHost(), false);
    assert.equal(tabletopSession.getState().beginSolo(), false);
    tabletopSession.getState().setPlayerName('HOST');
    tabletopSession.getState().setJoinCode('NO');
    assert.equal(tabletopSession.getState().beginGuest(), false);
    assert.equal(tabletopRace.getState().roomRuntime, runtime);
    assert.equal(tabletopRace.getState().hostRenderState, match);
  });
});
