import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startCanvasSession } from './canvasSession.ts';

test('retains the exact startup exception while keeping the public fallback reason stable', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const cause = new Error('The pinned renderer failed', { cause: new Error('Backend creation failed') });
  const reasons: string[] = [];
  const released: string[] = [];
  const lifetime = startCanvasSession(undefined, async (session) => {
    session.own(() => { released.push('device'); });
    session.own(() => { released.push('renderer'); });
    throw cause;
  }, (reason) => { reasons.push(reason); });
  await lifetime.closed;
  assert.deepEqual(reasons, ['init-failed']);
  assert.deepEqual(released, ['renderer', 'device']);
  assert.deepEqual(warn.mock.calls.map((call) => call.arguments), [
    ['GPU canvas initialization failed', cause],
  ]);
});

test('retains non-Error rejection values without converting or exposing them as UI reasons', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const cause = { code: 'DEVICE_UNAVAILABLE', detail: 'diagnostic-only' };
  const reasons: string[] = [];
  const lifetime = startCanvasSession(undefined, () => Promise.reject(cause), (reason) => { reasons.push(reason); });
  await lifetime.closed;
  assert.deepEqual(reasons, ['init-failed']);
  assert.equal(warn.mock.calls.length, 1);
  assert.equal(warn.mock.calls[0]!.arguments[1], cause);
});

test('does not report an abandoned startup rejection and still releases its settled resources', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const started = Promise.withResolvers<void>();
  const pending = Promise.withResolvers<void>();
  let released = 0;
  let fallback = 0;
  const lifetime = startCanvasSession(undefined, async (session) => {
    session.own(() => { released++; });
    started.resolve();
    await pending.promise;
  }, () => { fallback++; });
  await started.promise;
  lifetime.close();
  pending.reject(new Error('The obsolete load failed'));
  await lifetime.closed;
  assert.equal(released, 1);
  assert.equal(fallback, 0);
  assert.equal(warn.mock.calls.length, 0);
});

test('keeps explicit startup failure as the only outcome if startup subsequently rejects', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const reasons: string[] = [];
  const lifetime = startCanvasSession(undefined, async (session) => {
    session.fail('webgpu-unavailable');
    throw new Error('Failure after the explicit outcome');
  }, (reason) => { reasons.push(reason); });
  await lifetime.closed;
  assert.deepEqual(reasons, ['webgpu-unavailable']);
  assert.equal(warn.mock.calls.length, 0);
});
