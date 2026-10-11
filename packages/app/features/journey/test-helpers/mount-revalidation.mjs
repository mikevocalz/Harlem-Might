import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Exercise the real platform effect, controller and cookie-bound transport.
// Only React's mount/unmount scheduling and the unrelated navigation host are
// replaced, so a screen's loading-to-loaded remount has its production effects.
let cleanup;
globalThis.journeyMountEffect = effect => { cleanup = effect(); };
const stubs = {
  react: 'export const useEffect = effect => globalThis.journeyMountEffect(effect);',
  './runtime.ts': 'export const journeyController = () => globalThis.journeyMountController;',
  '../navigation/ui/useNavigationHost': 'export const useNavigationHost = () => {};',
  '../navigation/view/locationSource.ts': 'export const createBrowserLocationSource = () => {};',
};
registerHooks({
  resolve(specifier, context, next) {
    return context.parentURL?.endsWith('/useJourneyPlatform.web.ts') && specifier in stubs
      ? { url: `journey-mount-test:${specifier}`, shortCircuit: true }
      : next(specifier, context);
  },
  load(url, context, next) {
    return url.startsWith('journey-mount-test:')
      ? { format: 'module', source: stubs[url.slice('journey-mount-test:'.length)], shortCircuit: true }
      : next(url, context);
  },
});
const { applyWalkCommand } = await import('@acme/widgets');
const { createJourneyController } = await import('../controller.ts');
const { createMemberJourneyTransport } = await import('../member-transport.ts');
const { useJourneyPlatform: mount } = await import('../useJourneyPlatform.web.ts');
const response = body => new Response(JSON.stringify(body));
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
const date = '2026-10-01T12:00:00.000Z';
const walk = { id: 7, slug: 'history', title: 'History', summary: 'A sourced walk.', distanceMeters: 500, durationMinutes: 10, startDescription: 'Apollo', endDescription: 'Sylvia', images: [], updatedAt: date, stops: [{ position: 1, place: { id: 1, slug: 'apollo', name: 'Apollo' } }, { position: 2, place: { id: 2, slug: 'sylvia', name: 'Sylvia' } }], sources: [{ label: 'Archive', url: 'https://example.invalid/archive', accessedAt: date }] };
const summary = { id: '7', slug: walk.slug, title: walk.title, stopIds: ['1', '2'], published: true, sourceUrl: walk.sources[0].url };
const scenario = process.argv[2];
const stage = process.argv[3];
const committed = scenario.startsWith('committed');
const pending = deferred();
const requested = deferred();
let owner = 'A';
let authReads = 0;
let posts = 0;
let clears = 0;
async function delay(value, step) {
  if (!committed && stage === step) {
    requested.resolve();
    await pending.promise;
  }
  return value;
}
const transport = createMemberJourneyTransport('', async (_url, init) => {
  if (init?.method !== 'POST') {
    authReads++;
    return delay(response({ user: { id: owner } }), authReads === 1 ? 'identity' : 'verification');
  }
  posts++;
  const session = applyWalkCommand(null, JSON.parse(String(init.body)), new Date().toISOString(), summary);
  return delay(response({ schemaVersion: 1, session }), 'command');
});
const controller = createJourneyController({
  readers: { getWalk: () => delay({ status: 'ok', data: walk }, 'walk'), getPlace: async () => ({ status: 'not-found' }), listStories: async () => ({ status: 'ok', data: [] }) },
  storage: { getString() {}, set() {}, remove() {} },
  transport,
  onClear() { clears++; },
});
globalThis.journeyMountController = controller;
globalThis.window = new EventTarget();
globalThis.document = new EventTarget();
document.visibilityState = 'visible';
const unmount = () => { cleanup?.(); cleanup = undefined; };
try {
  mount();
  const begin = controller.begin(walk.slug);
  if (committed) {
    await begin;
    const session = controller.getSnapshot().session;
    assert.ok(session);
    assert.equal(authReads, 2, 'begin and send both verify the login');
    unmount();
    if (scenario === 'committed-owner-change') owner = 'B';
    mount();
    await flush();
    assert.equal(authReads, 3, 'mount still verifies a committed member session');
    assert.equal(controller.getSnapshot().session, owner === 'A' ? session : null);
    assert.equal(clears, owner === 'A' ? 0 : 1);
  } else {
    await requested.promise;
    assert.equal(controller.getSnapshot().busy, true);
    if (scenario === 'remount') {
      unmount();
      mount();
      // React can replay mount effects; that is not an account boundary either.
      unmount();
      mount();
      assert.equal(controller.getSnapshot().busy, true, 'mount must not cancel the pending start');
      assert.equal(clears, 0);
    } else if (scenario === 'focus') window.dispatchEvent(new Event('focus'));
    else if (scenario === 'visibility') document.dispatchEvent(new Event('visibilitychange'));
    else if (scenario === 'owner-change') controller.identityChanged('B');
    else if (scenario === 'logout') controller.identityChanged(null);
    else throw new Error(`Unknown scenario: ${scenario}`);
    if (scenario !== 'remount') {
      assert.equal(controller.getSnapshot().busy, false, 'real boundaries revoke the start synchronously');
      assert.equal(clears, 1);
    }
    // The delayed server ignores abort to prove stale completions cannot commit.
    pending.resolve();
    await begin;
    if (scenario === 'remount') {
      assert.equal(controller.getSnapshot().session?.status, 'active');
      assert.equal(controller.getSnapshot().mode, 'member');
      assert.equal(controller.getSnapshot().error, null);
      assert.equal(posts, 1);
    } else assert.equal(controller.getSnapshot().session, null);
  }
  unmount();
  const readsBefore = authReads;
  window.dispatchEvent(new Event('focus'));
  document.dispatchEvent(new Event('visibilitychange'));
  await flush();
  assert.equal(authReads, readsBefore, 'unmount removes revalidation listeners');
} finally {
  pending.resolve();
  unmount();
  delete globalThis.journeyMountEffect;
  delete globalThis.journeyMountController;
  delete globalThis.window;
  delete globalThis.document;
}
