import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Keep the production helper, controller and command validator. Only native
// lifecycle, device haptics and persistent storage are replaced for Node.
const stubs = {
  'react-native': "export const AppState = { currentState: 'active' };",
  '@acme/ui/haptics': 'export const haptics = new Proxy({}, { get: () => () => {} });',
  './storage': 'export const journeyStorage = { getString() {}, set() {}, remove() {} };',
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/journey/runtime.ts') && specifier in stubs) {
      return { url: `journey-command-test:${specifier}`, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    return url.startsWith('journey-command-test:')
      ? { format: 'module', source: stubs[url.slice('journey-command-test:'.length)], shortCircuit: true }
      : next(url, context);
  },
});

const { validateWalkCommand } = await import('@acme/widgets');
const { configureJourneyRuntime, journeyController, journeyCommand, currentJourneyStop } = await import('../runtime.ts');
const date = new Date().toISOString();
const walk = {
  id: 7, slug: 'history', title: 'History', summary: 'A sourced walk.',
  distanceMeters: 500, durationMinutes: 10, startDescription: 'Apollo', endDescription: 'Sylvia',
  images: [], updatedAt: date,
  stops: [
    { position: 1, place: { id: 1, slug: 'apollo', name: 'Apollo' } },
    { position: 2, place: { id: 2, slug: 'sylvia', name: 'Sylvia' } },
  ],
  sources: [{ label: 'Archive', url: 'https://example.invalid/archive', accessedAt: date }],
};
configureJourneyRuntime({ readers: {
  getWalk: async () => ({ status: 'ok', data: walk }),
  getPlace: async () => ({ status: 'not-found' }),
  listStories: async () => ({ status: 'ok', data: [] }),
} });
const journey = journeyController();
const commands = [];
const dispatch = journey.dispatch;
journey.dispatch = command => { commands.push(command); return dispatch(command); };
const scenario = process.argv[2];

if (scenario === 'no-session') {
  const before = journey.getSnapshot();
  assert.equal(before.session, null);
  for (const args of [['pause'], ['resume'], ['stop', true], ['confirm-stop', true]]) {
    const result = journeyCommand(...args);
    assert.ok(result instanceof Promise);
    assert.equal(await result, false);
    assert.equal(journey.getSnapshot(), before, 'no session means no state changes');
  }
  assert.equal(commands.length, 0, 'no session means nothing is dispatched');
} else {
  await journey.begin(walk.slug);
  await new Promise(resolve => setImmediate(resolve));
  const initial = journey.getSnapshot().session;
  assert.equal(initial.status, 'active');
  assert.equal(commands.length, 0);

  async function command(args, expectedStatus) {
    const before = journey.getSnapshot().session;
    const stopId = currentJourneyStop()?.id;
    assert.equal(await journeyCommand(...args), true);
    const sent = commands.at(-1);
    validateWalkCommand(sent);
    assert.equal(sent.type, args[0]);
    assert.equal(sent.sessionId, before.sessionId);
    assert.equal(sent.expectedRevision, before.revision);
    assert.equal(sent.schemaVersion, 1);
    if (args[0] === 'stop' || args[0] === 'confirm-stop') assert.equal(sent.confirmed, true);
    else assert.equal(Object.hasOwn(sent, 'confirmed'), false, 'pause/resume keep their wire shape');
    if (args[0] === 'confirm-stop') assert.equal(sent.stopId, stopId);
    const after = journey.getSnapshot().session;
    assert.equal(after.status, expectedStatus);
    assert.equal(after.revision, before.revision + 1);
    assert.equal(journey.getSnapshot().error, null);
    return after;
  }

  if (scenario === 'pause-resume') {
    await command(['pause'], 'paused');
    await command(['resume'], 'active');
    await command(['pause', true], 'paused');
    await command(['resume', undefined], 'active');
    await command(['pause', undefined], 'paused');
    await command(['resume', true], 'active');
    assert.equal(commands.length, 6);
  } else if (scenario === 'stop') {
    const after = await command(['stop', true], 'stopped');
    assert.deepEqual(after.completedStopIds, []);
    assert.equal(currentJourneyStop(), undefined);
    assert.equal(commands.length, 1);
  } else if (scenario === 'confirm-stop') {
    const first = currentJourneyStop().id;
    const afterFirst = await command(['confirm-stop', true], 'active');
    assert.deepEqual(afterFirst.completedStopIds, [first]);
    const second = currentJourneyStop().id;
    assert.notEqual(second, first);
    const afterSecond = await command(['confirm-stop', true], 'completed');
    assert.deepEqual(afterSecond.completedStopIds, [first, second]);
    assert.equal(currentJourneyStop(), undefined);
    assert.equal(commands.length, 2);
  } else throw new Error(`Unknown scenario: ${scenario}`);
  assert.equal(new Set(commands.map(command => command.commandId)).size, commands.length);
}
