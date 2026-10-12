import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, it } from 'node:test';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';
import * as compass from '@mapbox/react-native-mapbox-ar-reactvision/src/compassPlacement.ts';
import * as enu from '@mapbox/react-native-mapbox-ar-reactvision/src/enu.ts';
import * as bridge from '@mapbox/react-native-mapbox-ar-reactvision/src/bridge.ts';
import type { ReactVisionGeospatialNavigator } from '@mapbox/react-native-mapbox-ar-reactvision/src/types.ts';
import * as placeModel from '@acme/app/features/explore/place-model.ts';
import * as routeModel from '@acme/app/features/navigation/model/route.ts';
import * as sessionModel from '@acme/app/features/navigation/model/session.ts';
import { createNavigationController } from '@acme/app/features/navigation/session/navigationController.ts';
import * as navigation from '@acme/app/features/navigation/session/navigationStore.ts';
import { fixtureDestination, fixtureRoute } from '@acme/app/features/navigation/testing/fixtures.ts';
import { palette } from '@acme/theme';
import * as navAr from './navAr.ts';
import * as geospatial from './navArGeospatial.ts';
import * as build from './navArBuild.ts';
import { useNavAr } from './navAr.store.ts';
import { attachNavigationArCamera } from './navArCameraLifetime.ts';

type Effect = { deps?: readonly unknown[]; setup: () => (() => void) | undefined; cleanup?: () => void };
type Element = { type: string; props: Record<string, unknown> };
type CameraTransform = { position: [number, number, number]; forward: [number, number, number] };
type Scene = { props: {
  onTrackingUpdated: (state: number, reason: number) => void;
  onCameraTransformUpdate: (transform: CameraTransform) => void;
  children: unknown;
} };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

// Run the actual scene's effects and callbacks. The real stores, controller,
// placement math and polling lifecycle are used; only React scheduling, the
// clock/timers and native Viro leaves are bounded. This is not device validation.
async function sceneFixture(options: { earthConfigured?: boolean; replayEffects?: boolean; reducedLocation?: boolean } = {}) {
  navigation.resetNavigationStores();
  useNavAr.getState().reset();
  let now = 10_000;
  const route = fixtureRoute('apollo-theater--sylvias-restaurant');
  const origin = route.geometry.coordinates[0]!;
  const controller = createNavigationController({ now: () => now,
    provider: { id: 'mapbox', supportedModes: ['walking'], async getRoutes() {
      return { kind: 'routes', provider: 'mapbox', routes: [route] };
    } },
  });
  await controller.planRoute({ origin: { kind: 'device-location' }, originCoordinate: origin,
    destination: fixtureDestination('apollo-theater--sylvias-restaurant'), mode: 'walking' });
  assert.ok(controller.start());
  assert.ok(controller.enterAR());

  const calls = { support: 0, accuracy: 0, mode: [] as boolean[], earth: 0, pose: 0,
    anchors: [] as [number, number, number][], removed: [] as string[] };
  let pendingPose: ReturnType<typeof deferred<Awaited<ReturnType<ReactVisionGeospatialNavigator['getCameraGeospatialPose']>>>> | undefined;
  let pendingAnchor: ReturnType<typeof deferred<Awaited<ReturnType<ReactVisionGeospatialNavigator['createGeospatialAnchor']>>>> | undefined;
  const pose = { ...origin, altitude: 20, heading: 0, horizontalAccuracy: 5, orientationYawAccuracy: 6,
    verticalAccuracy: 3, headingAccuracy: 6, quaternion: [0, 0, 0, 1] as [number, number, number, number] };
  const navigator: ReactVisionGeospatialNavigator = {
    async isGeospatialModeSupported() { calls.support += 1; return { supported: true }; },
    async isLocationAccuracyReduced() { calls.accuracy += 1; return { reduced: options.reducedLocation ?? false }; },
    setGeospatialModeEnabled(enabled) { calls.mode.push(enabled); },
    async getEarthTrackingState() { calls.earth += 1; return { state: 'Enabled' }; },
    async getCameraGeospatialPose() { calls.pose += 1; return pendingPose ? pendingPose.promise : { success: true, pose }; },
    async createGeospatialAnchor(latitude, longitude, altitude) {
      calls.anchors.push([latitude, longitude, altitude]);
      return pendingAnchor ? pendingAnchor.promise : { success: true,
        anchor: { anchorId: `anchor-${calls.anchors.length}`, position: [0, 0, calls.anchors.length === 1 ? 0 : -15] } };
    },
    removeGeospatialAnchor(id) { calls.removed.push(id); },
    async checkVPSAvailability() { throw new Error('Unexpected VPS check'); },
    async createTerrainAnchor() { throw new Error('Unexpected terrain anchor'); },
    async createRooftopAnchor() { throw new Error('Unexpected rooftop anchor'); },
  };
  let effects: Effect[] = [];
  let refs: { current: unknown }[] = [];
  let memos: { deps: readonly unknown[]; value: unknown }[] = [];
  let effectIndex = 0;
  let refIndex = 0;
  let memoIndex = 0;
  let pending: (() => void)[] = [];
  let dirty = true;
  let mounted = false;
  let scene!: Scene;
  let detachCamera: (() => void) | undefined;
  let timerId = 0;
  const timers = new Map<number, { callback: () => void; ms: number }>();
  const unsubscribes = [navigation.useNavigationStore, navigation.navigationFixStore, useNavAr]
    .map((store) => store.subscribe(() => { dirty = true; }));
  const sameDeps = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined) =>
    a !== undefined && b !== undefined && a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
  function storeHook<S>(store: { getState: () => S }) {
    return Object.assign((selector: (state: S) => unknown) => selector(store.getState()), { getState: store.getState });
  }
  const jsx = (type: string, props: Record<string, unknown>) => ({ type, props });
  const modules: Record<string, unknown> = {
    react: {
      useEffect(setup: Effect['setup'], deps?: readonly unknown[]) {
        const index = effectIndex++;
        const previous = effects[index];
        if (sameDeps(previous?.deps, deps)) return;
        pending.push(() => { previous?.cleanup?.(); effects[index] = { setup, deps, cleanup: setup() }; });
      },
      useRef: (value: unknown) => refs[refIndex++] ??= { current: value },
      useMemo(factory: () => unknown, deps: readonly unknown[]) {
        const index = memoIndex++;
        if (!sameDeps(memos[index]?.deps, deps)) memos[index] = { deps, value: factory() };
        return memos[index].value;
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    zustand: { useStore: <S>(store: { getState: () => S }, selector: (state: S) => unknown) => selector(store.getState()) },
    '@reactvision/react-viro': { ViroARScene: 'ViroARScene', ViroNode: 'ViroNode', ViroBox: 'ViroBox',
      ViroText: 'ViroText', ViroQuad: 'ViroQuad', ViroPolygon: 'ViroPolygon', ViroMaterials: { createMaterials() {} } },
    '@mapbox/react-native-mapbox-ar-reactvision': { ...compass, ...enu, ...bridge,
      MapboxViroRoute: 'MapboxViroRoute', MapboxViroChevrons: 'MapboxViroChevrons' },
    '@acme/app/features/explore/place-model.ts': placeModel,
    '@acme/app/features/navigation/model/route.ts': routeModel,
    '@acme/app/features/navigation/model/session.ts': sessionModel,
    '@acme/app/features/navigation/session/navigationStore.ts': { ...navigation, useNavigationStore: storeHook(navigation.useNavigationStore) },
    '@acme/theme': { palette },
    './navAr': navAr,
    './navAr.store': { useNavAr: storeHook(useNavAr) },
    './navArGeospatial': geospatial,
    './navArBuild': { ...build, NAVIGATION_AR_BUILD: options.earthConfigured
      ? { provider: 'arcore', earth: 'arcore-configured' } : build.NAVIGATION_AR_BUILD },
    './navigationRuntime': { getNavigationController: () => controller },
  };
  function loadSource(file: string) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX } }).outputText;
    const exports: Record<string, unknown> = {};
    new Function('require', 'exports', 'Date', 'setInterval', 'clearInterval', compiled)((id: string) => {
      assert.ok(id in modules, `Unexpected scene import ${id}`);
      return modules[id];
    }, exports, { now: () => now }, (callback: () => void, ms: number) => {
      timers.set(++timerId, { callback, ms });
      return timerId;
    }, (id: number) => { timers.delete(id); });
    return exports;
  }
  modules['./useNavigationArPlacement'] = loadSource('./useNavigationArPlacement.ts');
  const { HarlemNavigationArScene: renderScene } = loadSource('./HarlemNavigationArScene.tsx') as {
    HarlemNavigationArScene: (props: { arSceneNavigator: ReactVisionGeospatialNavigator }) => Scene;
  };
  assert.equal(timers.size, 0, 'Importing the scene must not acquire a runtime');
  function render() {
    assert.ok(mounted);
    let renders = 0;
    do {
      assert.ok(++renders < 20, 'Scene effects must settle without a render loop');
      dirty = false;
      effectIndex = refIndex = memoIndex = 0;
      pending = [];
      scene = renderScene({ arSceneNavigator: navigator });
      pending.forEach((effect) => effect());
    } while (dirty);
    return scene;
  }
  function mount() {
    detachCamera = attachNavigationArCamera();
    mounted = true;
    render();
    if (options.replayEffects) {
      effects.forEach((effect) => effect.cleanup?.());
      effects.forEach((effect) => { effect.cleanup = effect.setup(); });
      render();
    }
  }
  function unmount() {
    if (!mounted) return;
    mounted = false;
    detachCamera?.();
    effects.forEach((effect) => effect.cleanup?.());
  }
  function pulse(ms = 250, commit = true) {
    now += ms;
    // Dispatch only live registrations. A cleared timer is never resurrected.
    [...timers.values()].filter((timer) => timer.ms === 250).forEach((timer) => timer.callback());
    if (mounted && commit) render();
  }
  function camera(forward: CameraTransform['forward'] = [0, 0, -1], position: CameraTransform['position'] = [0, 1.4, 0]) {
    scene.props.onCameraTransformUpdate({ position, forward });
  }
  function sensors() {
    controller.ingestFix({ coordinate: origin, accuracy: { horizontalM: 5 }, timestampMs: now, source: 'device-gps' });
    controller.ingestHeading({ headingDeg: 0, accuracyDeg: 6, timestampMs: now, source: 'compass' });
    camera();
  }
  function sample(count = 1) {
    for (let i = 0; i < count; i += 1) { sensors(); pulse(); }
  }
  function nodes() {
    const result: Element[] = [];
    function visit(value: unknown) {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (!value || typeof value !== 'object' || !('type' in value)) return;
      const node = value as Element;
      result.push(node);
      visit(node.props.children);
    }
    visit(scene);
    return result;
  }
  function replaceRoute(commit = true) {
    const session = navigation.useNavigationStore.getState().session;
    assert.ok(sessionModel.hasActiveTrip(session));
    const next = fixtureRoute('apollo-theater--sylvias-restaurant');
    // Model the domain's atomic published route replacement, not its lifecycle.
    // That controller's reroute cancellation/generation has its own domain suite.
    navigation.useNavigationStore.setState({ session: { ...session, activeRoute: {
      ...session.activeRoute, route: { ...next, geometry: { ...next.geometry,
        coordinates: next.geometry.coordinates.slice(1) } }, generation: session.activeRoute.generation + 1,
    } } });
    navigation.navigationFixStore.setState({ match: undefined });
    if (commit) render();
  }
  mount();
  scene.props.onTrackingUpdated(3, 0);
  render();
  return {
    controller, calls, timers, pose, sample, sensors, pulse, camera, render, nodes, replaceRoute, unmount,
    state: useNavAr.getState,
    track(state: number, reason = 0) { scene.props.onTrackingUpdated(state, reason); render(); },
    poll() { [...timers.values()].filter((timer) => timer.ms === 1000).forEach((timer) => timer.callback()); },
    deferPose() { pendingPose = deferred(); return pendingPose; },
    deferAnchor() { pendingAnchor = deferred(); return pendingAnchor; },
    async settle() { await new Promise<void>((resolve) => setImmediate(resolve)); if (mounted && dirty) render(); },
    remount() { assert.equal(mounted, false); effects = []; refs = []; memos = []; mount(); },
    dispose() { unmount(); controller.cancel(); unsubscribes.forEach((unsubscribe) => unsubscribe()); },
  };
}

const fixtures: Awaited<ReturnType<typeof sceneFixture>>[] = [];
async function fixture(options?: Parameters<typeof sceneFixture>[0]) {
  const value = await sceneFixture(options);
  fixtures.push(value);
  return value;
}
afterEach(() => {
  fixtures.splice(0).forEach((value) => value.dispose());
  navigation.resetNavigationStores();
  useNavAr.getState().reset();
});

it('owns one compass interval across effect replay/remount and never probes Earth in the current build', async () => {
  const value = await fixture({ replayEffects: true });
  await value.settle();
  assert.equal(value.timers.size, 1);
  assert.equal(value.state().geospatial, 'unavailable');
  assert.deepEqual(value.calls, { support: 0, accuracy: 0, mode: [], earth: 0, pose: 0, anchors: [], removed: [] });
  const session = navigation.useNavigationStore.getState().session;
  value.sample(3);
  assert.equal(value.state().compassSamples, 3);
  value.unmount();
  assert.equal(value.timers.size, 0);
  const stopped = value.state();
  value.pulse(5000);
  assert.equal(value.state(), stopped, 'Unmounted intervals must publish nothing');
  value.remount();
  assert.equal(value.timers.size, 1);
  value.pulse();
  assert.equal(value.state().observations.cameraTimestampMs, undefined, 'Remount must not reuse the previous camera ref');
  assert.equal(value.state().compassSamples, 0);
  assert.equal(navigation.useNavigationStore.getState().session, session, 'Mount ownership must not replace the trip');
});

it('calibrates from distinct fresh sensor pairs and renders only the approximate floating cue', async () => {
  const value = await fixture();
  value.sample(9);
  assert.equal(value.state().world?.target, undefined);
  assert.equal(value.state().compassSamples, 9);
  value.sample();
  assert.equal(value.state().world?.target?.source, 'compass');
  assert.equal(value.state().world?.target?.heightReference, 'estimated-eye-height');
  assert.equal(navigation.useNavigationStore.getState().session.phase, 'calibratingAR');
  value.sample();
  assert.equal(navigation.useNavigationStore.getState().session.phase, 'navigatingAR');
  assert.ok(value.nodes().some((node) => node.type === 'ViroPolygon'));
  assert.ok(!value.nodes().some((node) => ['MapboxViroRoute', 'MapboxViroChevrons', 'ViroBox'].includes(node.type)));
  const target = value.state().world?.target;
  value.pulse(navAr.MAX_CAMERA_AGE_MS + 1);
  assert.equal(value.state().world?.target, target, 'Expiring evidence does not mutate the solved transform');
  assert.equal(value.nodes().filter((node) => node.type === 'ViroNode').length, 0, 'Silent camera/heading callbacks hide world guidance');
});

it('does not count repeated heading reports or use invalid/vertical camera samples', async () => {
  const value = await fixture();
  value.sensors();
  value.pulse(100);
  value.camera();
  value.pulse(100);
  assert.equal(value.state().compassSamples, 1);
  value.camera([Number.NaN, 0, -1]);
  value.pulse(100);
  assert.equal(value.state().observations.cameraTimestampMs, undefined);
  assert.equal(value.state().world?.target, undefined);
  value.sensors();
  value.camera([0, -1, 0]);
  value.pulse();
  assert.equal(value.state().compassSamples, 0);
  assert.equal(value.state().world?.target, undefined);
});

it('clears camera/yaw evidence on recalibration and tracking loss without replacing the route or timer', async () => {
  const value = await fixture();
  value.sample(9);
  const frame = value.state().world?.frame;
  const interval = [...value.timers.keys()];
  useNavAr.getState().requestRecalibration();
  value.render();
  value.pulse();
  assert.equal(value.state().observations.cameraTimestampMs, undefined);
  value.sample();
  assert.equal(value.state().compassSamples, 1, 'The nine old samples must not finish a fresh calibration');
  value.sample(9);
  assert.ok(value.state().world?.target);
  value.track(2, 2);
  assert.equal(value.state().world?.target, undefined);
  assert.equal(value.state().world?.displayed, undefined);
  assert.equal(value.state().world?.frame, frame);
  assert.deepEqual([...value.timers.keys()], interval);
  value.track(3);
  value.pulse();
  assert.equal(value.state().observations.cameraTimestampMs, undefined);
  assert.equal(value.state().world?.target, undefined);
});

it('rebases route geometry and both transforms atomically, refusing ticks on a superseded frame', async () => {
  const value = await fixture();
  value.sample(10);
  const before = value.state().world!;
  const writes: ReturnType<typeof useNavAr.getState>['world'][] = [];
  const unsubscribe = useNavAr.subscribe((state, previous) => { if (state.world !== previous.world) writes.push(state.world); });
  value.replaceRoute(false);
  value.sensors();
  value.pulse(250, false);
  assert.equal(value.state().world, before, 'An old interval must not solve/slew against a newer active route');
  assert.equal(navigation.useNavigationStore.getState().session.phase, 'calibratingAR', 'The superseded frame must not hand off calibration');
  value.render();
  unsubscribe();
  assert.equal(writes.length, 1);
  const after = value.state().world!;
  assert.equal(after.frame.generation, before.frame.generation + 1);
  assert.notEqual(after.frame.routeId, before.frame.routeId);
  assert.deepEqual(after.target?.placement, navAr.rebasePlacement(before.target!.placement, before.frame.origin, after.frame.origin));
  assert.deepEqual(after.displayed, navAr.rebasePlacement(before.displayed!, before.frame.origin, after.frame.origin));
  assert.equal(value.state().alongM, navAr.alongTrackOnFrame(after.frame, navigation.navigationFixStore.getState().match));
  value.controller.cancel();
  value.pulse();
  assert.equal(value.state().world, after, 'Cancellation must not let the old route tick move geometry');
  assert.equal(value.nodes().filter((node) => node.type === 'ViroNode').length, 0);
});

it('pauses sampling/slewing while the shared controller is paused and resumes the existing interval', async () => {
  const value = await fixture();
  value.sample(3);
  assert.ok(value.controller.pause());
  const world = value.state().world;
  value.sample(4);
  assert.equal(value.state().compassSamples, 3);
  assert.equal(value.state().world, world);
  assert.equal(value.timers.size, 1);
  assert.ok(value.controller.resume());
  value.sample();
  assert.equal(value.state().compassSamples, 4);
});

it('uses the real configured bridge/poller and releases both temporary anchors after solving', async () => {
  const value = await fixture({ earthConfigured: true });
  value.sensors();
  await value.settle();
  value.poll();
  await value.settle();
  assert.equal(value.calls.support, 1);
  assert.equal(value.calls.accuracy, 1);
  assert.deepEqual(value.calls.mode, [true]);
  assert.equal(value.calls.anchors.length, 2);
  assert.deepEqual(value.calls.removed, ['anchor-1', 'anchor-2']);
  assert.equal(value.state().world?.target?.source, 'geospatial');
  assert.equal(value.state().world?.target?.heightReference, 'estimated-eye-height');
  assert.equal(navigation.navigationFixStore.getState().lastFix?.fix.source, 'ar-geospatial');
  value.unmount();
  assert.equal(value.timers.size, 0);
  assert.deepEqual(value.calls.mode, [true, false]);
});

for (const invalidation of ['unmount', 'route', 'recalibration', 'cancel'] as const) {
  it(`drops a pending Earth pose after ${invalidation}`, async () => {
    const value = await fixture({ earthConfigured: true });
    const request = value.deferPose();
    value.sensors();
    await value.settle();
    value.poll();
    await value.settle();
    assert.equal(value.calls.pose, 1);
    if (invalidation === 'unmount') value.unmount();
    if (invalidation === 'route') value.replaceRoute();
    if (invalidation === 'recalibration') { useNavAr.getState().requestRecalibration(); value.render(); }
    if (invalidation === 'cancel') value.controller.cancel();
    const before = value.state();
    request.resolve({ success: true, pose: value.pose });
    await value.settle();
    assert.equal(value.calls.anchors.length, 0);
    assert.equal(value.state().world, before.world);
    assert.equal(value.state().observations.geospatialTimestampMs, undefined);
    assert.notEqual(navigation.navigationFixStore.getState().lastFix?.fix.source, 'ar-geospatial');
  });
}

it('releases a late allocated anchor after route replacement and does not request the second anchor', async () => {
  const value = await fixture({ earthConfigured: true });
  const anchor = value.deferAnchor();
  value.sensors();
  await value.settle();
  value.poll();
  await value.settle();
  assert.equal(value.calls.anchors.length, 1);
  value.replaceRoute();
  const replacement = value.state().world;
  anchor.resolve({ success: true, anchor: { anchorId: 'late', position: [0, 0, 0] } });
  await value.settle();
  assert.deepEqual(value.calls.removed, ['late']);
  assert.equal(value.calls.anchors.length, 1);
  assert.equal(value.state().world, replacement);
  assert.equal(value.state().world?.target, undefined);
});


it('slews toward the retained target using elapsed time and the matched route pivot', async () => {
  const value = await fixture();
  value.sample(11);
  const world = value.state().world!;
  const displayed = { position: [2, 0, 3] as const, rotation: [0, 30, 0] as const };
  useNavAr.getState().setWorld({ ...world, displayed });
  value.render();
  const pivot = navAr.pointOnFrame(world.frame, value.state().alongM!).point;
  const expected = compass.slewPlacement({ current: displayed, target: world.target!.placement, pivot, elapsedS: 0.25 });
  value.sample();
  assert.deepEqual(value.state().world?.displayed, expected.placement);
  assert.equal(value.state().world?.target, world.target);
  assert.notDeepEqual(value.state().world?.displayed, displayed);
});

it('does not enable Earth with reduced location accuracy even in a configured build', async () => {
  const value = await fixture({ earthConfigured: true, reducedLocation: true });
  value.sensors();
  await value.settle();
  value.poll();
  await value.settle();
  assert.equal(value.calls.support, 1);
  assert.equal(value.calls.accuracy, 1);
  assert.deepEqual(value.calls.mode, []);
  assert.equal(value.calls.earth, 0);
  assert.equal(value.calls.pose, 0);
  assert.equal(value.state().geospatial, 'unavailable');
  assert.equal(value.timers.size, 1);
});

it('rejects a delayed Earth response even when a new camera callback makes polling eligible again', async () => {
  const value = await fixture({ earthConfigured: true });
  const request = value.deferPose();
  value.sensors();
  await value.settle();
  value.poll();
  await value.settle();
  assert.equal(value.calls.pose, 1);
  value.pulse(geospatial.MAX_EARTH_REQUEST_AGE_MS + 1);
  value.camera();
  request.resolve({ success: true, pose: value.pose });
  await value.settle();
  assert.equal(value.calls.anchors.length, 0);
  assert.equal(value.state().observations.geospatialTimestampMs, undefined);
  assert.equal(value.state().world?.target, undefined);
});
