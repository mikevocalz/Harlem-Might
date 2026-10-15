import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import { useMcpVoicePlaybackStore as store } from './mcpVoicePlaybackStore.ts';

// Setup must not depend on the reset action whose behavior is under test.
const clearFixture = () => store.setState({ activeKey: null, seenKeys: {} });
beforeEach(clearFixture);
afterEach(clearFixture);

it('reset clears active playback and remembered cues through the actual store', () => {
  store.getState().activate('12:start');
  store.getState().activate('12:crash');
  store.getState().reset();
  assert.equal(store.getState().activeKey, null);
  assert.deepEqual(store.getState().seenKeys, {});
});

it('reset notifies subscribers that own active playback', () => {
  store.getState().activate('12:start');
  const observed: (string | null)[] = [];
  const unsubscribe = store.subscribe((state) => observed.push(state.activeKey));
  try {
    store.getState().reset();
    assert.deepEqual(observed, [null]);
  } finally {
    unsubscribe();
  }
});

it('a cue can activate again after resetting the playback session', () => {
  store.getState().activate('12:start');
  store.getState().clear('12:start');
  store.getState().reset();
  store.getState().activate('12:start');
  assert.equal(store.getState().activeKey, '12:start');
});

it('clearing playback still remembers handled cues until reset', () => {
  store.getState().activate('12:start');
  store.getState().clear('12:start');
  store.getState().activate('12:start');
  assert.equal(store.getState().activeKey, null);
  assert.deepEqual(store.getState().seenKeys, { '12:start': true });
});

it('a stale completion cannot clear a different active cue', () => {
  store.getState().activate('12:start');
  store.getState().activate('12:crash');
  store.getState().clear('12:start');
  assert.equal(store.getState().activeKey, '12:crash');
});

it('reset preserves the stable action references used by native effects', () => {
  const { activate, clear, reset } = store.getState();
  reset();
  reset();
  assert.equal(store.getState().activate, activate);
  assert.equal(store.getState().clear, clear);
  assert.equal(store.getState().reset, reset);
  assert.equal(store.getState().activeKey, null);
  assert.deepEqual(store.getState().seenKeys, {});
});
