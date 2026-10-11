import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, flush, deferred } from '../scripts/test-helpers/watch-handoff.mjs';

test('baseline: opt-in publishes bounded projection and confirmed watch actions use actual reducer', async () => {
  const h = await setup(); await h.hook.startWatchHandoff();
  assert.equal(h.hook.watchHandoffState.getSnapshot().enabled, true);
  assert.equal(h.publications.length, 1);
  assert.equal(Date.parse(h.publications[0].expiresAt) - Date.parse(h.publications[0].updatedAt), 30000);
  assert.equal(h.publications[0].nextStopId, '1');
  await h.command(); await flush();
  assert.equal(h.controller.getSnapshot().session.status, 'paused');
  assert.equal(h.publications.at(-1).revision, 1);
  await h.command({ commandId: 'resume-1', type: 'resume' }); await flush();
  await h.command({ commandId: 'visit-1', type: 'confirm-stop', confirmed: true, stopId: '1' }); await flush();
  assert.deepEqual(h.controller.getSnapshot().session.completedStopIds, ['1']);
  assert.equal(h.publications.at(-1).nextStopId, '2');
  h.unmount();
});

test('cancel while status request is pending cannot create or publish a handoff', async () => {
  const gate = deferred(), h = await setup({ statusGate: gate });
  const start = h.hook.startWatchHandoff(); await flush();
  const stop = h.hook.stopWatchHandoff(); gate.resolve({ available: true, reachable: true });
  await Promise.all([start, stop]);
  assert.deepEqual(h.events, ['getStatus', 'clear']);
  assert.equal(h.hook.watchHandoffState.getSnapshot().enabled, false); h.unmount();
});

test('cancel while native epoch creation is pending cannot publish revoked handoff', async () => {
  const gate = deferred(), h = await setup({ idGate: gate });
  const start = h.hook.startWatchHandoff(); await flush();
  assert.deepEqual(h.events, ['getStatus', 'createHandoffId']);
  const stop = h.hook.stopWatchHandoff(); gate.resolve('revoked-handoff'); await Promise.all([start, stop]);
  assert.equal(h.publications.length, 0); assert.equal(h.events.at(-1), 'clear'); h.unmount();
});

test('wrong epoch/session/revision, unconfirmed stop and duplicate command cannot mutate journey', async () => {
  const h = await setup(); await h.hook.startWatchHandoff();
  for (const patch of [{ handoffId: 'wrong' }, { sessionId: 'wrong' }, { expectedRevision: 99 }, { type: 'stop' }, { type: 'confirm-stop', stopId: '1' }, { type: 'confirm-stop', confirmed: true, stopId: '2' }]) {
    await h.command(patch); await flush();
    assert.equal(h.controller.getSnapshot().session.revision, 0);
  }
  await h.command({ type: 'confirm-stop', confirmed: true, stopId: '1' }); await flush();
  await h.command({ type: 'confirm-stop', confirmed: true, stopId: '1', expectedRevision: 0 }); await flush();
  assert.equal(h.controller.getSnapshot().session.revision, 1);
  assert.deepEqual(h.controller.getSnapshot().session.completedStopIds, ['1']); h.unmount();
});

test('idle connected account clearing revokes local handoff and calls native clear', async () => {
  const h = await setup(); await h.hook.startWatchHandoff();
  h.controller.clear(); await flush();
  assert.equal(h.hook.watchHandoffState.getSnapshot().enabled, false);
  assert.equal(h.events.at(-1), 'clear'); h.unmount();
});

test('account/session revocation disables handoff even while native publication is pending', async () => {
  const h = await setup();
  try {
    await h.hook.startWatchHandoff();
    h.holdPublish(); await h.tick();
    h.controller.clear(); await flush();
    assert.equal(h.hook.watchHandoffState.getSnapshot().enabled, false,
      'A cleared journey must synchronously revoke its watch epoch, not wait for an older native publish.');
  } finally { h.releasePublish(); await flush(); h.unmount(); }
});

test('explicit opt-out invokes native clear without waiting for an older native send completion', async () => {
  const h = await setup(); let stopped;
  try {
    await h.hook.startWatchHandoff();
    h.holdPublish(); await h.tick();
    stopped = h.hook.stopWatchHandoff(); await flush();
    assert.equal(h.events.includes('clear'), true,
      'Native revocation must not be serialized behind a pending delivery task.');
  } finally { h.releasePublish(); await stopped; await flush(); h.unmount(); }
});

test('revocation also runs while the phone is inactive', async () => {
  const h = await setup();
  try {
    await h.hook.startWatchHandoff();
    h.holdPublish(); await h.tick();
    h.appState.currentState = 'background';
    h.controller.clear(); await flush();
    assert.equal(h.hook.watchHandoffState.getSnapshot().enabled, false);
    assert.equal(h.events.at(-1), 'clear');
  } finally { h.releasePublish(); await flush(); h.unmount(); }
});

test('revocation skips native calls still queued for a cancelled opt-in', async () => {
  const h = await setup();
  try {
    const start = h.hook.startWatchHandoff();
    const stop = h.hook.stopWatchHandoff();
    await Promise.all([start, stop]);
    assert.deepEqual(h.events, ['clear']);
    assert.equal(h.publications.length, 0);
  } finally { h.unmount(); }
});

for (const outcome of ['resolve', 'reject'] as const) {
  test(`a fresh handoff can publish before an old native send ${outcome}s`, async () => {
    const h = await setup();
    try {
      await h.hook.startWatchHandoff();
      h.holdPublish(); await h.tick();
      const oldSend = h.detachPublish();
      // Coalesced old work must not publish after the cancellation either.
      await h.tick();
      const stopped = h.hook.stopWatchHandoff(); await flush();
      assert.equal(h.events.at(-1), 'clear');
      const started = h.hook.startWatchHandoff(); await flush();
      assert.equal(h.publications.at(-1).handoffId, 'handoff-2');
      await Promise.all([stopped, started]);
      assert.equal(h.publications.length, 3);
      oldSend[outcome](outcome === 'reject' ? new Error('old send failed') : undefined);
      await flush();
      assert.equal(h.hook.watchHandoffState.getSnapshot().enabled, true);
      assert.equal(h.events.filter(event => event === 'clear').length, 1);
      assert.equal(h.publications.length, 3);
    } finally { h.releasePublish(); await flush(); h.unmount(); }
  });
}

test('completion from an old epoch cannot release a newer publication lock', async () => {
  const h = await setup();
  try {
    await h.hook.startWatchHandoff();
    h.holdPublish(); await h.tick();
    const oldSend = h.detachPublish();
    const stopped = h.hook.stopWatchHandoff(); await flush();
    assert.equal(h.events.at(-1), 'clear');
    await stopped;
    h.holdPublish();
    const start = h.hook.startWatchHandoff(); await flush();
    assert.equal(h.publications.at(-1).handoffId, 'handoff-2');
    oldSend.resolve(); await flush();
    await h.tick(); await h.tick();
    assert.equal(h.publications.length, 3, 'new epoch still has exactly one native publication in flight');
    h.releasePublish(); await start; await flush();
    assert.equal(h.publications.length, 4, 'only the latest coalesced publication is sent');
  } finally { h.releasePublish(); await flush(); h.unmount(); }
});

test('new opt-in waits for revocation, while repeated cancelled starts are skipped', async () => {
  const clear = deferred(), h = await setup({ clearGate: clear });
  try {
    await h.hook.startWatchHandoff();
    const stopped = h.hook.stopWatchHandoff();
    const cancelledStart = h.hook.startWatchHandoff();
    const stoppedAgain = h.hook.stopWatchHandoff();
    const latestStart = h.hook.startWatchHandoff();
    await flush();
    assert.deepEqual(h.events, ['getStatus', 'createHandoffId', 'publish:0', 'clear', 'clear']);
    clear.resolve(); await Promise.all([stopped, cancelledStart, stoppedAgain, latestStart]);
    assert.deepEqual(h.events.slice(5), ['getStatus', 'createHandoffId', 'publish:0']);
    assert.equal(h.publications.at(-1).handoffId, 'handoff-2');
  } finally { clear.resolve(); h.unmount(); }
});

test('a snapshot queued before controller clearing never reaches native', async () => {
  const h = await setup();
  try {
    await h.hook.startWatchHandoff();
    const tick = h.tick();
    h.controller.clear();
    await tick;
    assert.equal(h.publications.length, 1);
    assert.equal(h.events.at(-1), 'clear');
    assert.equal(h.hook.watchHandoffState.getSnapshot().enabled, false);
  } finally { h.unmount(); }
});

test('a rejected clear still releases the restart barrier without reviving the old handoff', async () => {
  const clear = deferred(), h = await setup({ clearGate: clear });
  try {
    await h.hook.startWatchHandoff();
    h.holdPublish(); await h.tick();
    const oldSend = h.detachPublish();
    const stopped = h.hook.stopWatchHandoff();
    const restarted = h.hook.startWatchHandoff(); await flush();
    assert.equal(h.events.at(-1), 'clear');
    assert.equal(h.publications.length, 2);
    clear.reject(new Error('native clear failed'));
    await Promise.all([stopped, restarted]);
    assert.equal(h.publications.at(-1).handoffId, 'handoff-2');
    oldSend.reject(new Error('revoked send failed')); await flush();
    assert.equal(h.hook.watchHandoffState.getSnapshot().enabled, true);
    assert.equal(h.events.filter(event => event === 'clear').length, 1);
  } finally { clear.resolve(); h.unmount(); }
});
