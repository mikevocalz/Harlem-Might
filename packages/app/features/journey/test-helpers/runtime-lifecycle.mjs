import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Exercise the production journey runtime and component, replacing only host
// storage, native lifecycle/haptics and presentation primitives in Node.
const reactUrl = import.meta.resolve('react');
const stubs = {
  'react-native': "export const AppState = { currentState: 'active' };",
  '@acme/ui/haptics': 'export const haptics = new Proxy({}, { get: () => () => {} });',
  '@acme/ui/tw': `import { createElement } from ${JSON.stringify(reactUrl)}; export const View = ({ children, role }) => createElement('div', { role }, children);`,
  '@acme/ui/mights': `import { createElement } from ${JSON.stringify(reactUrl)}; export const MightsText = ({ children }) => createElement('p', {}, children); export const MightsHeading = MightsText; export const MightsButton = ({ children }) => createElement('button', {}, children); export const routes = { walk: slug => '/walks/' + slug, story: slug => '/stories/' + slug, explore: () => '/explore' };`,
  './storage': 'export const journeyStorage = { getString() {}, set() {}, remove() {} };',
  './useJourneyPlatform': 'export function useJourneyPlatform() {}',
  '../site/content/SourcesList.tsx': 'export function SourcesList() { return null; }',
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier in stubs) return { url: `journey-test:${specifier}`, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('journey-test:')) return { format: 'module', source: stubs[url.slice('journey-test:'.length)], shortCircuit: true };
    if (url.endsWith('.tsx')) return { format: 'module', source: transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX } }).outputText, shortCircuit: true };
    const loaded = next(url, context);
    // Static rendering normally uses the store's initial SSR snapshot. This
    // client-state harness renders the same live snapshot as a mounted screen.
    if (url.includes('/zustand/') && /react\.(mjs|js)$/.test(url)) return { ...loaded, source: String(loaded.source).replaceAll('api.getInitialState()', 'api.getState()') };
    return loaded;
  },
});

const { configureJourneyRuntime, journeyController, journeyCommand, requestJourneyDirections } = await import('../runtime.ts');
const { useMemberAuth } = await import('../../auth/member-auth.store.ts');
const nav = await import('../../navigation/view/runtime.ts');
const { useNavigationStore } = await import('../../navigation/session/navigationStore.ts');
const { useNavigationUi } = await import('../../navigation/view/navigationUi.store.ts');
const { RouteProviderError } = await import('../../navigation/providers/routeProvider.ts');
const { fixtureDestination, fixtureRoute, loadFixture, lngLatToCoordinate } = await import('../../navigation/testing/fixtures.ts');
const { WalkJourney } = await import('../WalkJourney.tsx');
const name = 'apollo-theater--sylvias-restaurant';
const origin = lngLatToCoordinate(loadFixture(name).origin.lngLat);
const destination = fixtureDestination(name, false);
const date = new Date().toISOString();
const sources = [{ label: 'Archive', url: 'https://example.invalid/archive', accessedAt: date }];
const walk = { id: 7, slug: 'history', title: 'History', summary: 'A sourced walk.', distanceMeters: 500, durationMinutes: 10, startDescription: 'Apollo', endDescription: 'Sylvia', images: [], updatedAt: date, stops: [{ position: 1, place: { id: 1, slug: destination.placeId, name: 'Sylvia' } }, { position: 2, place: { id: 2, slug: 'other-stop', name: 'Other stop' } }], sources };
const place = { id: 1, slug: destination.placeId, name: 'Sylvia', location: [destination.coordinate.longitude, destination.coordinate.latitude], locationAccuracy: 'verified', locationSourceUrl: sources[0].url, locationSourceReadAt: date, sources };
configureJourneyRuntime({ readers: { getWalk: async () => ({ status: 'ok', data: walk }), getPlace: async () => ({ status: 'ok', data: place }), listStories: async () => ({ status: 'ok', data: [] }) } });
const journey = journeyController();
await journey.begin(walk.slug);
await new Promise(resolve => setImmediate(resolve));
let handlers;
let stops = 0;
const intervals = new Set();
const setInterval = globalThis.setInterval;
const clearInterval = globalThis.clearInterval;
globalThis.setInterval = (...args) => { const id = setInterval(...args); intervals.add(id); return id; };
globalThis.clearInterval = id => { intervals.delete(id); clearInterval(id); };
const source = { kind: 'browser', check: async () => 'granted', watch(value) { handlers = value; return () => { stops++; }; } };
const scenario = process.argv[2];
const reason = process.argv[3] ?? 'network';
let rejectFirst;
let routeRequests = 0;
const provider = { id: 'mapbox', supportedModes: ['walking'], async getRoutes() {
  if (scenario === 'superseded-planning') {
    if (++routeRequests === 1) return new Promise((_resolve, reject) => { rejectFirst = reject; });
    return { kind: 'routes', provider: 'mapbox', routes: [fixtureRoute(name)] };
  }
  throw new RouteProviderError(reason, 'mapbox', 'Routing failed');
} };
nav.configureNavigationRuntime({ provider, locationSource: source });
await new Promise(resolve => setImmediate(resolve));
try {
  if (scenario === 'superseded-planning') {
    requestJourneyDirections();
    handlers.onAvailability('granted');
    handlers.onFix({ coordinate: origin, accuracy: { horizontalM: 5 }, timestampMs: Date.now(), source: 'device-gps' });
    assert.equal(useNavigationStore.getState().session.phase, 'calculatingRoute');
    await nav.navigationController().planRoute({ origin: { kind: 'device-location' }, originCoordinate: origin, destination: { ...destination, placeId: 'new-explore-trip' }, mode: 'walking' });
    assert.equal(nav.startGuidance(), true);
    const newerTrip = useNavigationStore.getState().session;
    rejectFirst(new RouteProviderError('network', 'mapbox', 'Old request failed late'));
    await new Promise(resolve => setImmediate(resolve));
    journey.clear();
    assert.equal(useNavigationStore.getState().session, newerTrip, 'old completion and clear cannot replace the newer trip');
    assert.equal(nav.isLocationRunning(), true);
    assert.equal(stops, 0, 'the newer trip retains the GPS watch');
    assert.equal(intervals.size, 1);
  } else if (scenario === 'failed-planning') {
    requestJourneyDirections();
    assert.equal(nav.isLocationRunning(), true);
    handlers.onAvailability('granted');
    handlers.onFix({ coordinate: origin, accuracy: { horizontalM: 5 }, timestampMs: Date.now(), source: 'device-gps' });
    assert.equal(useNavigationStore.getState().session.phase, 'calculatingRoute');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(useNavigationStore.getState().session.phase, 'error');
    assert.equal(nav.isLocationRunning(), false, 'failed planning must release the GPS watch');
    assert.equal(stops, 1);
    assert.equal(intervals.size, 0, 'failed planning must clear the 1 Hz positioning timer');
  } else if (scenario === 'render-error') {
    await nav.navigationController().planRoute({ origin: { kind: 'device-location' }, originCoordinate: origin, destination, mode: 'walking' });
    const html = renderToStaticMarkup(createElement(WalkJourney, { slug: walk.slug }));
    assert.match(html, reason === 'network' ? /Routing needs a connection/ : /Walking directions are unavailable/);
    useNavigationStore.setState({ session: { ...useNavigationStore.getState().session, trip: { origin: { kind: 'device-location' }, destination: { ...destination, placeId: 'unrelated' }, mode: 'walking' } } });
    assert.doesNotMatch(renderToStaticMarkup(createElement(WalkJourney, { slug: walk.slug })), /Routing needs a connection|Walking directions are unavailable/);
  } else if (scenario === 'clear-error' || scenario === 'stop-error') {
    await nav.navigationController().planRoute({ origin: { kind: 'device-location' }, originCoordinate: origin, destination, mode: 'walking' });
    nav.startLocation();
    if (scenario === 'clear-error') journey.clear();
    else await journeyCommand('stop', true);
    assert.equal(useNavigationStore.getState().session.phase, 'idle');
    assert.equal(nav.isLocationRunning(), false);
    assert.equal(intervals.size, 0);
  } else if (scenario === 'auth-unrelated' || scenario === 'auth-matching') {
    const selected = scenario === 'auth-unrelated' ? { ...destination, placeId: 'unrelated' } : destination;
    nav.configureNavigationRuntime({ provider: { id: 'mapbox', supportedModes: ['walking'], async getRoutes() { return { kind: 'routes', provider: 'mapbox', routes: [fixtureRoute(name)] }; } } });
    await nav.navigationController().planRoute({ origin: { kind: 'device-location' }, originCoordinate: origin, destination: selected, mode: 'walking' });
    assert.equal(nav.startGuidance(), true);
    const before = useNavigationStore.getState().session;
    useMemberAuth.getState().begin();
    useMemberAuth.getState().fail('Incorrect password');
    assert.equal(journey.getSnapshot().session, null);
    if (scenario === 'auth-unrelated') {
      assert.equal(useNavigationStore.getState().session, before, 'failed login must preserve an unrelated Explore trip');
      assert.equal(nav.isLocationRunning(), true);
    } else {
      assert.equal(useNavigationStore.getState().session.phase, 'idle');
      assert.equal(nav.isLocationRunning(), false);
    }
  } else throw new Error(`Unknown scenario: ${scenario}`);
} finally {
  nav.resetNavigationRuntimeForTests();
  for (const timer of intervals) clearInterval(timer);
  globalThis.setInterval = setInterval;
  globalThis.clearInterval = clearInterval;
  useNavigationUi.getState().resetTrip();
}
