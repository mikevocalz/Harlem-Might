import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNavigationHostLifecycle } from './hostLifecycle.ts';

function harness() {
  let running = true;
  let allowed = true;
  let starts = 0;
  let stops = 0;
  const lifecycle = createNavigationHostLifecycle({
    running: () => running,
    mayResume: () => allowed,
    start: () => { running = true; starts++; },
    stop: () => { running = false; stops++; },
  });
  return { lifecycle, deny: () => { allowed = false; }, state: () => ({ running, starts, stops }) };
}

test('only the last route host releases the foreground location feed', () => {
  const h = harness();
  const first = h.lifecycle.mount(true);
  const second = h.lifecycle.mount(true);
  first();
  assert.equal(h.state().stops, 0);
  second(); second();
  assert.deepEqual(h.state(), { running: false, starts: 0, stops: 1 });
  const remount = h.lifecycle.mount(true);
  assert.deepEqual(h.state(), { running: true, starts: 1, stops: 1 });
  remount();
});

test('repeated background/foreground events stop and resume once', () => {
  const h = harness();
  const cleanup = h.lifecycle.mount(true);
  h.lifecycle.setActive(false); h.lifecycle.setActive(false);
  assert.deepEqual(h.state(), { running: false, starts: 0, stops: 1 });
  h.lifecycle.setActive(true); h.lifecycle.setActive(true);
  assert.deepEqual(h.state(), { running: true, starts: 1, stops: 1 });
  cleanup();
  h.lifecycle.setActive(true);
  assert.equal(h.state().running, false);
});

test('a cancelled trip or revoked permission cannot restart tracking on reentry', () => {
  const h = harness();
  h.lifecycle.mount(true);
  h.lifecycle.setActive(false);
  h.deny();
  h.lifecycle.setActive(true);
  assert.deepEqual(h.state(), { running: false, starts: 0, stops: 1 });
});

test('mounting an inactive screen never starts the feed', () => {
  const h = harness();
  const release = h.lifecycle.mount(false);
  release();
  h.lifecycle.mount(false);
  assert.deepEqual(h.state(), { running: false, starts: 0, stops: 1 });
  h.lifecycle.setActive(true);
  assert.equal(h.state().starts, 1);
});
