import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const { createJourneyController } = await import(pathToFileURL(`${root}/packages/app/features/journey/controller.ts`));
const { validateWalkCommand } = await import(pathToFileURL(`${root}/packages/widgets/src/walk-commands.ts`));
const { isCompanionSnapshot } = await import(pathToFileURL(`${root}/apps/mobile/modules/walk-companion/src/protocol.ts`));
export const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
/** @returns {{ promise: Promise<unknown>, resolve: (value?: unknown) => void, reject: (reason?: unknown) => void }} */
export function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve(value = undefined) { resolve(value); }, reject(reason = undefined) { reject(reason); } };
}
// Platform boundaries (RN AppState, native transport, navigation subscriptions,
// timers) are explicit doubles. Actual hook body and actual journey reducer/
// controller/validators execute unchanged; imports/exports are just linked here.
export async function setup({ statusGate, idGate, clearGate } = {}) {
  const date = new Date(Date.now() - 1000).toISOString();
  const walk = { id: 7, slug: 'harlem-history', title: 'Harlem history', updatedAt: date,
    stops: [{ place: { id: 1, slug: 'apollo', name: 'Apollo' } }, { place: { id: 2, slug: 'sylvias', name: 'Sylvias' } }], sources: [{ url: 'https://example.org/archive', accessedAt: date }] };
  const values = new Map();
  const controller = createJourneyController({
    readers: { getWalk: async () => ({ status: 'ok', data: walk }), getPlace: async () => ({ status: 'not-found' }), listStories: async () => ({ status: 'ok', data: [] }) },
    storage: { getString: key => values.get(key), set: (key, value) => values.set(key, value), remove: key => values.delete(key) },
  });
  await controller.begin(walk.slug); await flush();
  const events = [], publications = [], timers = new Set(), navigation = new Set(), publishGates = new Set();
  let commandListener, publishGate, handoffCount = 0;
  const transport = {
    async getStatus() { events.push('getStatus'); return statusGate ? statusGate.promise : { available: true, reachable: true }; },
    async createHandoffId() { events.push('createHandoffId'); return idGate ? idGate.promise : `handoff-${++handoffCount}`; },
    async publish(snapshot) { assert.equal(isCompanionSnapshot(snapshot), true); events.push(`publish:${snapshot.revision}`); publications.push(snapshot); if (publishGate) await publishGate.promise; },
    async clear() { events.push('clear'); if (clearGate) await clearGate.promise; },
    addCommandListener(fn) { commandListener = fn; return { remove() { commandListener = undefined; } }; },
  };
  const bindings = {
    AppState: { currentState: 'active' }, journeyController: () => controller,
    currentJourneyStop: () => { const s = controller.getSnapshot(); return !s.session || ['stopped', 'completed'].includes(s.session.status) ? undefined : s.plan.stops[s.session.completedStopIds.length]; },
    liveProgress: () => undefined, navigationFixStore: { getState: () => ({}) },
    useNavigationStore: { getState: () => ({}), subscribe(fn) { navigation.add(fn); return () => navigation.delete(fn); } },
    useNavigationUi: { getState: () => ({ online: true, location: 'denied' }) },
    validateWalkCommand, watchTransport: transport,
    setInterval(fn) { timers.add(fn); return fn; }, clearInterval(fn) { timers.delete(fn); },
  };
  const source = stripTypeScriptTypes(readFileSync(`${root}/apps/mobile/src/journey/watchHandoff.ts`, 'utf8'))
    .replace(/^import[^\n]*\n/gm, '').replace(/^export /gm, '');
  const hook = new Function(...Object.keys(bindings), `${source}\nreturn {startWatchHandoff,stopWatchHandoff,mountWatchCompanion,watchHandoffState};`)(...Object.values(bindings));
  const cleanup = hook.mountWatchCompanion();
  const unmount = () => { cleanup(); for (const gate of publishGates) gate.resolve(); };
  return { hook, controller, events, publications, timers, unmount, appState: bindings.AppState,
    holdPublish() { publishGate = deferred(); publishGates.add(publishGate); return publishGate; }, detachPublish() { const gate = publishGate; publishGate = undefined; return gate; }, releasePublish() { publishGate?.resolve(); publishGate = undefined; },
    async tick() { for (const fn of timers) fn(); await flush(); },
    async command(patch = {}) { const s = controller.getSnapshot().session; return commandListener({ schemaVersion: 1, commandId: 'command-1', handoffId: publications.at(-1).handoffId, sessionId: s.sessionId, expectedRevision: s.revision, type: 'pause', ...patch }); },
  };
}
