import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, it } from 'node:test';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';
import * as core from './lightcycle/tabletopCore.ts';
import * as protocol from './lightcycle/sessionProtocol.ts';
import { tabletopPresenceUpdate } from './tabletopPresence.ts';
import { tabletopRace } from './tabletopRaceStore.ts';
import { tabletopSession, useTabletopSessionStore } from './tabletopSessionStore.ts';

type Element = { type: any; props: any; key?: string };
type Effect = { deps: unknown[]; cleanup?: () => void };

// Execute the native components' real callbacks and effect lifetimes without
// loading Viro, audio assets or a device renderer. This is not device AR coverage.
function nativeFixture() {
  let active: ReturnType<typeof mount>;
  const jsx = (type: any, props: any, key?: string): Element => ({ type, props, key });
  function mount(Component: (props: any) => Element | null) {
    const effects: Effect[] = [];
    const refs: { current: any }[] = [];
    let effectIndex = 0;
    let refIndex = 0;
    let pending: (() => void)[] = [];
    return {
      render(props: any) {
        active = this;
        effectIndex = refIndex = 0;
        pending = [];
        const tree = Component(props);
        pending.forEach((effect) => effect());
        return tree;
      },
      effect(callback: () => (() => void) | undefined, deps: unknown[]) {
        const index = effectIndex++;
        const previous = effects[index];
        if (previous && deps.every((dep, i) => Object.is(dep, previous.deps[i]))) return;
        pending.push(() => {
          previous?.cleanup?.();
          effects[index] = { deps, cleanup: callback() };
        });
      },
      ref(value: unknown) {
        const index = refIndex++;
        return refs[index] ??= { current: value };
      },
      unmount() { effects.forEach((effect) => effect.cleanup?.()); },
    };
  }
  const entities = new Map<string, { id: string; fields: Record<string, unknown> }>();
  const writes: { id: string; fields: Record<string, unknown> }[] = [];
  const replication = {
    state: 'synced', localPeerId: 'host-peer',
    byId: (id: string) => entities.get(id),
    isMine: () => true,
    claim: (id: string) => entities.set(id, { id, fields: {} }),
    set: (id: string, fields: Record<string, unknown>) => {
      writes.push({ id, fields });
      entities.set(id, { id, fields: { ...entities.get(id)?.fields, ...fields } });
    },
  };
  for (const id of ['p1', 'p2'] as const) {
    entities.set(protocol.LIGHTCYCLE_REPLICATION_IDS.player(id), {
      id,
      fields: { playerId: id, peerId: id === 'p1' ? 'host-peer' : 'guest-peer',
        name: id === 'p1' ? 'HOST' : 'GUEST', ready: true, localized: true,
        connected: true, cycleColor: id === 'p1' ? 'cyan' : 'orange' },
    });
  }
  const colocated = {
    state: 'joined', localPeerId: 'host-peer',
    peers: [{ peerId: 'guest-peer', localized: true }], publishPose: () => {},
  };
  const room = { roomId: 'room-a', enabled: false };
  const viro = new Proxy({
    ViroAnimations: { registerAnimations: () => {} },
    ViroMaterials: { createMaterials: () => {} },
    isQuest: true, isPico: false, isVisionOS: false,
    metaSpatialAnchorFrameSource: (key: string) => ({ key }),
    useViroColocationRoom: (options: { enabled: boolean }) => {
      room.enabled = options.enabled;
      return { roomId: options.enabled ? room.roomId : null, status: 'ready' };
    },
    useViroColocation: () => colocated,
    useViroReplicatedState: () => replication,
    parseLocationTransform: () => null,
  }, { get: (target, key) => target[key as keyof typeof target] ?? key });
  const modules: Record<string, unknown> = {
    react: {
      useCallback: (callback: unknown) => callback,
      useMemo: (factory: () => unknown) => factory(),
      useEffect: (effect: any, deps: unknown[]) => active.effect(effect, deps),
      useRef: (value: unknown) => active.ref(value),
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    './viro': viro,
    './lightcycle/tabletopCore': core,
    './lightcycle/sessionProtocol': protocol,
    './lightcycle/assetContract': { LIGHTCYCLE_METERS_PER_FIXED_UNIT: 0.001 },
    './tabletopPresence': { tabletopPresenceUpdate },
    './tabletopRaceStore': {
      tabletopRace,
      useTabletopRaceStore: (selector: (state: ReturnType<typeof tabletopRace.getState>) => unknown) =>
        selector(tabletopRace.getState()),
    },
    './tabletopSessionStore': {
      tabletopSession,
      useTabletopSessionStore: Object.assign(
        (selector: (state: ReturnType<typeof tabletopSession.getState>) => unknown) =>
          selector(tabletopSession.getState()),
        { getState: tabletopSession.getState, subscribe: useTabletopSessionStore.subscribe },
      ),
    },
    './rive-fx/store': { gridFx: { emit: () => {} } },
    './mcp/McpPresence.native': { McpPresence: 'McpPresence' },
    './mcp/McpVoiceSound.native': { McpVoiceSoundNative: 'McpVoiceSoundNative' },
    './arSurface': { acceptsGameSurface: () => true },
    './TabletopRiveScoreboard.native': { TabletopRiveScoreboard: 'TabletopRiveScoreboard' },
  };
  function load(name: string) {
    const source = readFileSync(new URL(name + '.tsx', import.meta.url), 'utf8');
    const compiled = transpileModule(source, {
      compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
    }).outputText;
    const exports: Record<string, any> = {};
    new Function('require', 'exports', 'process', compiled)(
      (id: string) => {
        if (id.startsWith('./assets/')) return 1;
        assert.ok(id in modules, `Unexpected native import ${id}`);
        return modules[id];
      },
      exports,
      { env: { EXPO_PUBLIC_REACTVISION_API_KEY: 'test', EXPO_PUBLIC_REACTVISION_PROJECT_ID: 'test' } },
    );
    return exports;
  }
  const runtime = load('./TabletopRaceRuntime.native');
  modules['./TabletopRaceRuntime.native'] = runtime;
  return { mount, room, writes, colocated, replication,
    Scene: load('./TabletopColocationScene.native').TabletopColocationScene,
    Runtime: runtime.TabletopRaceRuntime };
}

function find(tree: Element | null, type: any): Element {
  const visit = (node: any): Element | undefined => {
    if (!node || typeof node !== 'object') return;
    if (node.type === type) return node;
    for (const child of [node.props?.children].flat()) {
      const found = visit(child);
      if (found) return found;
    }
  };
  const result = visit(tree);
  assert.ok(result, `Missing ${String(type)}`);
  return result;
}

function prepareHost() {
  const session = tabletopSession.getState();
  session.setPlayerName('HOST');
  session.beginHost();
  session.setPlacementConfirmed(true);
  session.setHostPlacement({ position: [0, 0, 0], surface: 'table' });
  session.setLocalized(true);
  session.setReady(true);
}

afterEach(() => tabletopSession.getState().reset());

it('native room ownership survives frame loss/remount, pauses play, and tears down on replacement', () => {
  const fixture = nativeFixture();
  prepareHost();
  const scene = fixture.mount(fixture.Scene);
  const sceneProps = { arSceneNavigator: {} };
  let frame = find(scene.render(sceneProps), 'ViroSharedFrame');
  let roomElement = frame.props.children as Element;
  let shared = fixture.mount(roomElement.type);
  let runtimeElement = find(shared.render(roomElement.props), fixture.Runtime);
  let renderer = fixture.mount(fixture.Runtime);
  let loop = find(renderer.render(runtimeElement.props), 'ViroGameLoop');
  for (let i = 0; i < 5; i++) loop.props.onFixedUpdate();
  const lifetime = tabletopRace.getState().roomRuntime!;
  assert.equal(lifetime.hostState?.tick, 5);
  assert.equal(fixture.room.enabled, true);

  frame.props.onLocalizeError('tracking temporarily lost');
  frame = find(scene.render(sceneProps), 'ViroSharedFrame');
  assert.equal(fixture.room.enabled, true, 'host room must not be disabled by localization loss');
  assert.equal(frame.props.children.type, roomElement.type);
  assert.equal(frame.props.children.key, roomElement.key);
  runtimeElement = find(shared.render(frame.props.children.props), fixture.Runtime);
  assert.equal(runtimeElement.props.bothReady, false);
  assert.equal(runtimeElement.props.placementReady, false);
  assert.equal(renderer.render(runtimeElement.props), null);
  assert.equal(tabletopRace.getState().roomRuntime, lifetime);
  // ViroSharedFrame may remove its children while reacquiring. Their unmount
  // must not destroy the scene-owned match or restart it when they reappear.
  renderer.unmount();
  shared.unmount();
  assert.equal(lifetime.hostState?.tick, 5);

  frame.props.onLocalized({ transform: null });
  tabletopSession.getState().setReady(true);
  frame = find(scene.render(sceneProps), 'ViroSharedFrame');
  roomElement = frame.props.children;
  shared = fixture.mount(roomElement.type);
  shared.render(roomElement.props); // Observe the optimistic Ready presence write.
  runtimeElement = find(shared.render(roomElement.props), fixture.Runtime);
  renderer = fixture.mount(fixture.Runtime);
  loop = find(renderer.render(runtimeElement.props), 'ViroGameLoop');
  loop.props.onFixedUpdate();
  assert.equal(tabletopRace.getState().roomRuntime, lifetime);
  assert.equal(lifetime.hostState?.tick, 6);
  assert.equal(tabletopRace.getState().hostRenderState?.tick, 6);
  const pausedLoop = find(renderer.render({ ...runtimeElement.props, bothReady: false }), 'ViroGameLoop');
  pausedLoop.props.onFixedUpdate();
  assert.equal(lifetime.hostState?.tick, 6, 'a remote unready player also suspends the match');

  fixture.room.roomId = 'room-b';
  frame = find(scene.render(sceneProps), 'ViroSharedFrame');
  assert.equal(frame.props.children.key, 'room-b');
  assert.equal(tabletopRace.getState().roomRuntime?.roomId, 'room-b');
  assert.equal(tabletopRace.getState().hostRenderState, null);
  loop.props.onFixedUpdate(); // A late callback from room A cannot affect B.
  assert.equal(tabletopRace.getState().roomRuntime?.hostState, null);
  assert.equal(lifetime.hostState?.tick, 6);
  renderer.unmount();
  shared.unmount();
  scene.unmount();
  assert.equal(tabletopRace.getState().roomRuntime, null);
  assert.equal(tabletopRace.getState().hostRenderState, null);
});

it('native presence effect publishes disconnected flags exactly once after optimistic updates', () => {
  const fixture = nativeFixture();
  prepareHost();
  const scene = fixture.mount(fixture.Scene);
  const frame = find(scene.render({ arSceneNavigator: {} }), 'ViroSharedFrame');
  const room = fixture.mount(frame.props.children.type);
  room.render(frame.props.children.props);
  fixture.colocated.state = 'disconnected';
  room.render(frame.props.children.props);
  room.render(frame.props.children.props);
  room.render(frame.props.children.props);
  const writes = fixture.writes.filter((write) =>
    write.id === protocol.LIGHTCYCLE_REPLICATION_IDS.player('p1') &&
    write.fields.connected === false);
  // Losing the connection also clears Ready in a separate store effect.
  assert.equal(writes.filter((write) => write.fields.ready === true).length, 1);
  assert.equal(writes.filter((write) => write.fields.ready === false).length, 1);
  assert.ok(writes.every((write) => write.fields.localized === false));
  room.unmount();
  scene.unmount();
});
