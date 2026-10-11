import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Keep the real clock/timer/store code. The hook harness retains subscriptions
// for two mounts while simulating sensor-driven renders between timer ticks.
let time = 1800000000000;
let tick;
let timerStarts = 0;
let mount = 'first';
const subscriptions = new Map();
const notifications = new Map();
const originalNow = Date.now;
const originalInterval = globalThis.setInterval;
const originalClear = globalThis.clearInterval;
Date.now = () => time;
globalThis.setInterval = callback => { timerStarts++; tick = callback; return timerStarts; };
globalThis.clearInterval = () => { tick = undefined; };
globalThis.journeyTestExternalStore = (subscribe, snapshot) => {
  if (!subscriptions.has(mount)) {
    const owner = mount;
    subscriptions.set(owner, subscribe(() => notifications.set(owner, (notifications.get(owner) ?? 0) + 1)));
  }
  return snapshot();
};
const unmount = owner => { subscriptions.get(owner)?.(); subscriptions.delete(owner); };
registerHooks({
  resolve(specifier, context, next) {
    return specifier === 'react' ? { url: 'journey-clock-test:react', shortCircuit: true } : next(specifier, context);
  },
  load(url, context, next) {
    return url === 'journey-clock-test:react'
      ? { format: 'module', source: 'export const useSyncExternalStore = (...args) => globalThis.journeyTestExternalStore(...args); export default {};', shortCircuit: true }
      : next(url, context);
  },
});
try {
  const { useJourneyClock: renderClock } = await import('../useJourneyClock.ts');
  const { navigationFixStore, useNavigationStore } = await import('../../navigation/session/navigationStore.ts');
  let fixSubscribers = 0;
  let navigationSubscribers = 0;
  const subscribeFix = navigationFixStore.subscribe;
  const subscribeNavigation = useNavigationStore.subscribe;
  navigationFixStore.subscribe = listener => { fixSubscribers++; const stop = subscribeFix(listener); return () => { fixSubscribers--; stop(); }; };
  useNavigationStore.subscribe = listener => { navigationSubscribers++; const stop = subscribeNavigation(listener); return () => { navigationSubscribers--; stop(); }; };
  const firstTick = time;
  assert.equal(renderClock(), firstTick);
  mount = 'second';
  assert.equal(renderClock(), firstTick);
  assert.equal(timerStarts, 1, 'multiple consumers share one timer');
  assert.equal(fixSubscribers, 1);
  assert.equal(navigationSubscribers, 1);
  for (const elapsed of [1, 250, 999]) {
    time = firstTick + elapsed;
    const before = notifications.get('second') ?? 0;
    navigationFixStore.setState({ lastFix: { kind: 'accepted', fix: { timestampMs: time } } });
    assert.equal(renderClock(), time, 'sensor-driven rendering uses current time before the next tick');
    assert.equal(notifications.get('second'), before + 1);
    assert.equal(notifications.get('first'), notifications.get('second'));
    assert.equal(renderClock(), time, 'repeated reads keep a stable snapshot');
  }
  time = firstTick + 1000;
  const beforeTick = notifications.get('second');
  tick();
  assert.equal(notifications.get('second'), beforeTick + 1, 'ticker still expires silent feeds');
  assert.equal(renderClock(), time);
  time++;
  const beforeProgress = notifications.get('second');
  useNavigationStore.setState({ progress: { kind: 'tracking', progress: { timestampMs: time } } });
  assert.equal(renderClock(), time, 'new progress also refreshes evaluation time');
  assert.equal(notifications.get('second'), beforeProgress + 1);
  unmount('first');
  assert.equal(fixSubscribers, 1, 'remaining consumers keep the shared subscriptions');
  assert.equal(navigationSubscribers, 1);
  assert.equal(typeof tick, 'function');
  unmount('second');
  const afterStop = notifications.get('second');
  navigationFixStore.setState({ lastFix: undefined });
  useNavigationStore.setState({ progress: { kind: 'none' } });
  assert.equal(notifications.get('second'), afterStop);
  assert.equal(fixSubscribers, 0, 'last unmount releases the fix subscription');
  assert.equal(navigationSubscribers, 0, 'last unmount releases the navigation subscription');
  assert.equal(tick, undefined, 'last unmount also stops the timer');
  time += 1000;
  mount = 'restarted';
  assert.equal(renderClock(), time, 'a later mount samples fresh time');
  assert.equal(timerStarts, 2);
  assert.equal(fixSubscribers, 1);
  assert.equal(navigationSubscribers, 1);
  time++;
  navigationFixStore.setState({ lastFix: { kind: 'accepted', fix: { timestampMs: time } } });
  assert.equal(renderClock(), time);
  assert.equal(notifications.get('restarted'), 1);
  unmount('restarted');
  assert.equal(fixSubscribers, 0);
  assert.equal(navigationSubscribers, 0);
} finally {
  for (const owner of subscriptions.keys()) unmount(owner);
  Date.now = originalNow;
  globalThis.setInterval = originalInterval;
  globalThis.clearInterval = originalClear;
  delete globalThis.journeyTestExternalStore;
}
