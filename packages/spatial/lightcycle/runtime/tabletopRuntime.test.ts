import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, it } from 'node:test';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';
import * as core from '../tabletopCore.ts';
import * as protocol from '../sessionProtocol.ts';
import * as replicatedMatchState from '../replicatedMatchState.ts';
import * as scoreboardModel from '../scoreboardModel.ts';
import { tabletopPresenceUpdate } from './tabletopPresence.ts';
import { tabletopRace } from './tabletopRaceStore.ts';
import { tabletopSession, useTabletopSessionStore } from './tabletopSessionStore.ts';

type Element = { type: any; props: any; key?: string };
type Effect = { deps: unknown[]; cleanup?: () => void };

// Execute the native components' real callbacks and effect lifetimes without
// loading Viro, audio assets or a device renderer. This is not device AR coverage.
function nativeFixture(platform = { isQuest: true, isPico: false, isVisionOS: false }) {
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
  const entities = new Map<string, {
    id: string; fields: Record<string, unknown>; owner: string | null; version: number;
  }>();
  const claims: string[] = [];
  const transport = { acknowledgeClaims: true };
  const writes: { id: string; fields: Record<string, unknown> }[] = [];
  const effects: unknown[] = [];
  const scoreboardAsset = { bytes: undefined, error: null, load: async () => {} };
  const replication = {
    state: 'synced', localPeerId: 'host-peer',
    byId: (id: string) => entities.get(id),
    isMine: (id: string) => entities.get(id)?.owner === replication.localPeerId,
    claim: (id: string) => {
      claims.push(id);
      if (transport.acknowledgeClaims) {
        entities.set(id, { id, fields: {}, owner: replication.localPeerId, version: 1 });
      }
    },
    set: (id: string, fields: Record<string, unknown>) => {
      writes.push({ id, fields });
      entities.set(id, {
        id, owner: entities.get(id)?.owner ?? replication.localPeerId,
        version: entities.get(id)?.version ?? 1,
        fields: { ...entities.get(id)?.fields, ...fields },
      });
    },
  };
  for (const id of ['p1', 'p2'] as const) {
    entities.set(protocol.LIGHTCYCLE_REPLICATION_IDS.player(id), {
      id, owner: id === 'p1' ? 'host-peer' : 'guest-peer', version: 1,
      fields: { playerId: id, peerId: id === 'p1' ? 'host-peer' : 'guest-peer',
        name: id === 'p1' ? 'HOST' : 'GUEST', ready: true, localized: true,
        connected: true, cycleColor: id === 'p1' ? 'cyan' : 'orange' },
    });
  }
  const colocated = {
    state: 'joined', localPeerId: 'host-peer',
    peers: [{ peerId: 'guest-peer', localized: true }], publishPose: () => {},
  };
  const room = {
    roomId: 'room-a', enabled: false, status: 'ready',
    frameSource: null as { key: string } | null,
  };
  const viro = new Proxy({
    ViroAnimations: { registerAnimations: () => {} },
    ViroMaterials: { createMaterials: () => {} },
    ...platform,
    metaSpatialAnchorFrameSource: (key: string) => ({ key }),
    cloudAnchorFrameSource: (key: string) => ({ key }),
    useViroColocationRoom: (options: { enabled: boolean }) => {
      room.enabled = options.enabled;
      return {
        roomId: options.enabled ? room.roomId : null,
        status: room.status,
        frameSource: room.frameSource,
      };
    },
    useViroColocation: () => colocated,
    // The real hook returns a fresh facade each render over the same client.
    useViroReplicatedState: () => ({ ...replication }),
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
    '../../viro': viro,
    '../tabletopCore': core,
    '../sessionProtocol': protocol,
    '../replicatedMatchState': replicatedMatchState,
    '../scoreboardModel': scoreboardModel,
    '../../SpatialRivePanel.native': { SpatialRivePanel: 'SpatialRivePanel' },
    './tabletopRiveScoreboardAssetStore': {
      useTabletopRiveScoreboardAssetStore: (selector: (asset: typeof scoreboardAsset) => unknown) =>
        selector(scoreboardAsset),
    },
    '../assetContract': { LIGHTCYCLE_METERS_PER_FIXED_UNIT: 0.001 },
    '../runtime/tabletopPresence': { tabletopPresenceUpdate },
    '../runtime/tabletopRaceStore': {
      tabletopRace,
      useTabletopRaceStore: (selector: (state: ReturnType<typeof tabletopRace.getState>) => unknown) =>
        selector(tabletopRace.getState()),
    },
    '../runtime/tabletopSessionStore': {
      tabletopSession,
      useTabletopSessionStore: Object.assign(
        (selector: (state: ReturnType<typeof tabletopSession.getState>) => unknown) =>
          selector(tabletopSession.getState()),
        { getState: tabletopSession.getState, subscribe: useTabletopSessionStore.subscribe },
      ),
    },
    '../../rive-fx/store': { gridFx: { emit: (event: unknown) => effects.push(event) } },
    '../../mcp/McpPresence.native': { McpPresence: 'McpPresence' },
    '../../mcp/McpVoiceSound.native': { McpVoiceSoundNative: 'McpVoiceSoundNative' },
    '../../arSurface': { acceptsGameSurface: () => true },
    '../ui/TabletopRiveScoreboard.native': { TabletopRiveScoreboard: 'TabletopRiveScoreboard' },
  };
  function load(name: string) {
    const source = readFileSync(new URL(name + '.tsx', import.meta.url), 'utf8');
    const compiled = transpileModule(source, {
      compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
    }).outputText;
    const exports: Record<string, any> = {};
    new Function('require', 'exports', 'process', compiled)(
      (id: string) => {
        if (id.startsWith('../../assets/')) return 1;
        assert.ok(id in modules, `Unexpected native import ${id}`);
        return modules[id];
      },
      exports,
      { env: { EXPO_PUBLIC_REACTVISION_API_KEY: 'test', EXPO_PUBLIC_REACTVISION_PROJECT_ID: 'test' } },
    );
    return exports;
  }
  const runtime = load('../viro/TabletopRaceRuntime.native');
  modules['./TabletopRaceRuntime.native'] = runtime;
  return { mount, room, writes, effects, colocated, replication, entities, claims, transport,
    Scoreboard: load('../ui/TabletopRiveScoreboard.native').TabletopRiveScoreboard,
    Scene: load('../viro/TabletopColocationScene.native').TabletopColocationScene,
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

it('native host status follows surface search, placement, frame locking and room readiness', () => {
  const fixture = nativeFixture();
  const session = tabletopSession.getState();
  session.setPlayerName('HOST');
  assert.equal(session.beginHost(), true);
  const scene = fixture.mount(fixture.Scene);
  const status = () => find(scene.render({ arSceneNavigator: {} }), 'ViroText').props.text;

  assert.equal(status(), 'SCANNING FOR TABLE / FLOOR…');
  session.setDetectedSurfaceCount(1);
  assert.equal(status(), 'TAP A CYAN TABLE OR FLOOR');
  session.setPlacementCandidate({ anchorId: 'table', worldPosition: [0, 0, 0], surface: 'table' });
  assert.equal(status(), 'PREVIEW MAT · LOCK OR MOVE');
  session.setPlacementConfirmed(true);
  assert.equal(status(), 'LOCKING SHARED COORDINATE FRAME…');
  session.setLocalized(true);
  fixture.room.roomId = '';
  assert.equal(status(), 'CREATING ROOM CODE…');
  fixture.room.roomId = 'room-a';
  assert.equal(status(), 'GRID FOUND · SHARED FRAME LOCKED');
  scene.unmount();
});

it('native guest status follows room lookup, host-frame localization, readiness and frame loss', () => {
  const fixture = nativeFixture();
  const session = tabletopSession.getState();
  session.setPlayerName('GUEST');
  session.setJoinCode('GRID1234');
  assert.equal(session.beginGuest(), true);
  const scene = fixture.mount(fixture.Scene);
  const status = () => find(scene.render({ arSceneNavigator: {} }), 'ViroText').props.text;

  fixture.room.status = 'working';
  assert.equal(status(), 'LOOKING UP GRID ROOM…');
  fixture.room.status = 'ready';
  fixture.room.frameSource = { key: 'host-frame' };
  assert.equal(status(), 'LOCALIZING TO HOST GRID…');
  const frame = find(scene.render({ arSceneNavigator: {} }), 'ViroSharedFrame');
  assert.equal(frame.props.source, fixture.room.frameSource);
  frame.props.onLocalized({ transform: null });
  assert.equal(status(), 'GRID FOUND · SHARED FRAME LOCKED');
  frame.props.onLocalizeError('tracking temporarily lost');
  assert.equal(status(), 'LOCALIZING TO HOST GRID…');
  scene.unmount();
});

function crashEffectFixture(localPlayerId: core.LightCyclePlayerId) {
  const fixture = nativeFixture();
  const room = tabletopRace.enterRoom('crash-room');
  const props = {
    roomId: room.roomId, replication: fixture.replication, localPlayerId,
    placementReady: true, frameLocalized: true, p1Ready: true, p2Ready: true, playerNames: { p1: 'HOST', p2: 'GUEST' }, bothReady: true,
  };
  let renderer = fixture.mount(fixture.Runtime);
  return {
    effects: fixture.effects,
    render(state: core.LightCycleMatchState) {
      if (localPlayerId === 'p1') tabletopRace.setRoomRenderState(room, state);
      else fixture.replication.set(protocol.LIGHTCYCLE_REPLICATION_IDS.snapshot, { state });
      renderer.render(props);
    },
    remount() {
      renderer.unmount();
      renderer = fixture.mount(fixture.Runtime);
    },
  };
}

function setCrashRider(
  state: core.LightCycleMatchState,
  id: core.LightCyclePlayerId,
  x: number,
  direction: core.LightCycleDirection,
) {
  Object.assign(state.riders[id], {
    position: { x, z: 0 }, segmentStart: { x, z: 0 }, direction,
  });
}

for (const localPlayerId of ['p1', 'p2'] as const) {
  it(`native ${localPlayerId} emits both simultaneous crash effects once across renders and remounts`, () => {
    const fixture = crashEffectFixture(localPlayerId);
    let state = core.startLightCycleRoundImmediately(core.createLightCycleMatch({
      config: { baseStepUnits: 1000 },
    }));
    setCrashRider(state, 'p1', -500, 1);
    setCrashRider(state, 'p2', 500, 3);
    state = core.advanceLightCycleMatch(state);
    assert.equal(state.roundWinner, 'draw');
    assert.deepEqual(state.derezEvents.map(({ playerId, tick }) => ({ playerId, tick })), [
      { playerId: 'p1', tick: state.tick }, { playerId: 'p2', tick: state.tick },
    ]);

    fixture.render(state);
    assert.deepEqual(fixture.effects, state.derezEvents.map((event) => ({
      type: 'derez', seed: event.seed, intensity: 1,
      playerColor: event.playerId === 'p1' ? '#00f3ff' : '#ff7a00',
      opponentColor: event.playerId === 'p1' ? '#ff7a00' : '#00f3ff',
      localPlayer: localPlayerId, winner: event.byPlayerId ?? 'none',
      collisionCause: event.cause,
      world: { x: event.point.x * 0.001, y: 0.08, z: event.point.z * 0.001 },
    })));
    fixture.render(state);
    fixture.render(structuredClone(state));
    // A newer snapshot containing the same event batch must not replay it.
    fixture.render({ ...state, tick: state.tick + 1 });
    fixture.remount();
    fixture.render(structuredClone(state));
    assert.equal(fixture.effects.length, 2);
  });

  it(`native ${localPlayerId} accepts a shorter next round and rejects stale round batches`, () => {
    const fixture = crashEffectFixture(localPlayerId);
    let state = core.startLightCycleRoundImmediately(core.createLightCycleMatch({
      config: { baseStepUnits: 1000, roundOverTicks: 1 },
    }));
    setCrashRider(state, 'p1', core.LIGHTCYCLE_ARENA_HALF - 1050, 1);
    state = core.advanceLightCycleMatch(core.advanceLightCycleMatch(state));
    assert.equal(state.derezEvents.length, 1);
    assert.equal(state.derezEvents[0]?.tick, 2);
    fixture.render(state);
    assert.equal(fixture.effects.length, 1);

    // Advance the real round transition, without requiring the renderer to see
    // the intervening empty countdown snapshot (a guest can miss that update).
    let next = core.startLightCycleRoundImmediately(core.advanceLightCycleMatch(state));
    assert.equal(next.round, state.round + 1);
    assert.equal(next.tick, 0);
    setCrashRider(next, 'p1', core.LIGHTCYCLE_ARENA_HALF - 50, 1);
    next = core.advanceLightCycleMatch(next);
    assert.equal(next.derezEvents.length, 1);
    assert.equal(next.derezEvents[0]?.tick, 1);
    fixture.render(next);
    assert.equal(fixture.effects.length, 2);

    fixture.render(structuredClone(next));
    fixture.render(structuredClone(state));
    fixture.render(structuredClone(next));
    assert.equal(fixture.effects.length, 2);
  });
}

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
  assert.equal(runtimeElement.props.placementReady, true);
  assert.equal(runtimeElement.props.frameLocalized, false);
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


it('native guest runtime and scoreboard reject malformed snapshots and recover on valid state', () => {
  const fixture = nativeFixture();
  const room = tabletopRace.enterRoom('guest-room');
  const renderer = fixture.mount(fixture.Runtime);
  const scoreboard = fixture.mount(fixture.Scoreboard);
  const props = {
    roomId: 'guest-room', replication: fixture.replication, localPlayerId: 'p2',
    placementReady: true, frameLocalized: true, p1Ready: true, p2Ready: true, playerNames: { p1: 'HOST', p2: 'GUEST' }, bothReady: true,
  };
  const valid = core.createLightCycleMatch({ names: props.playerNames });
  const malformed = [
    { tick: 0, round: 1, phase: 'running', config: {}, riders: {}, scores: {}, trails: [] },
    { ...valid, derezEvents: undefined },
    { ...valid, riders: { ...valid.riders, p2: { ...valid.riders.p2, position: [] } } },
    { ...valid, trails: [null] },
    { ...valid, derezEvents: [{ playerId: 'p1' }] },
  ];
  for (const state of malformed) {
    fixture.replication.set(protocol.LIGHTCYCLE_REPLICATION_IDS.snapshot, { state });
    const tree = renderer.render(props);
    assert.equal(find(tree, 'ViroText').props.text, 'HOST STARTING SYNCHRONIZED COUNTDOWN…');
    find(tree, 'ViroGameLoop').props.onFixedUpdate();
    assert.equal(room.hostState, null, 'the guest must never simulate invalid host data');
    const panel = find(scoreboard.render({ replicatedState: state, presence: {} }), 'SpatialRivePanel');
    assert.equal(panel.props.bindings['player1/name'], 'PLAYER 1');
    assert.deepEqual(panel.props.bindings['match/phase'], { kind: 'enum', value: 'localizing' });
  }
  assert.deepEqual(fixture.effects, []);

  const state = JSON.parse(JSON.stringify(valid));
  fixture.replication.set(protocol.LIGHTCYCLE_REPLICATION_IDS.snapshot, { state });
  const tree = renderer.render(props);
  assert.strictEqual(find(tree, 'McpPresence').props.state, state);
  assert.strictEqual(find(tree, 'McpVoiceSoundNative').props.state, state);
  const panel = find(scoreboard.render({ replicatedState: state, presence: {} }), 'SpatialRivePanel');
  assert.equal(panel.props.bindings['player1/name'], 'HOST');
  assert.deepEqual(panel.props.bindings['match/phase'], { kind: 'enum', value: 'countdown' });
  renderer.unmount();
  scoreboard.unmount();
  tabletopRace.leaveRoom(room);
});


// Mount the real scene, SharedTabletopRoom and runtime together. Only Viro,
// transport acknowledgements and React scheduling are controlled by this host.
function matchPublicationFixture(mode: 'host' | 'guest' = 'host') {
  const fixture = nativeFixture();
  if (mode === 'host') prepareHost();
  else {
    fixture.replication.localPeerId = fixture.colocated.localPeerId = 'guest-peer';
    fixture.colocated.peers = [{ peerId: 'host-peer', localized: true }];
    fixture.room.frameSource = { key: 'host-frame' };
    const session = tabletopSession.getState();
    session.setPlayerName('GUEST');
    session.setJoinCode('GRID1234');
    session.beginGuest();
    session.setLocalized(true);
    session.setReady(true);
    fixture.entities.set(protocol.LIGHTCYCLE_REPLICATION_IDS.placement, {
      id: protocol.LIGHTCYCLE_REPLICATION_IDS.placement, owner: 'host-peer', version: 1,
      fields: { position: [0, 0, 0], surface: 'table', confirmed: true },
    });
  }
  let scene = fixture.mount(fixture.Scene);
  let shared: ReturnType<typeof fixture.mount> | undefined;
  let runtime: ReturnType<typeof fixture.mount> | undefined;
  let roomKey: string | undefined;
  let sharedTree: Element | null = null;
  let runtimeTree: Element | null = null;
  function render() {
    const frame = find(scene.render({ arSceneNavigator: {} }), 'ViroSharedFrame');
    const room = frame.props.children as Element;
    if (!shared || room.key !== roomKey) {
      runtime?.unmount();
      shared?.unmount();
      shared = fixture.mount(room.type);
      runtime = undefined;
      roomKey = room.key;
    }
    sharedTree = shared.render(room.props);
    const element = nodes(sharedTree).find((node) => node.type === fixture.Runtime);
    if (element) {
      runtime ??= fixture.mount(fixture.Runtime);
      runtimeTree = runtime.render(element.props);
    } else {
      runtime?.unmount();
      runtime = undefined;
      runtimeTree = null;
    }
    return { frame, sharedTree, runtimeTree };
  }
  function settle() { render(); render(); return render(); }
  return {
    ...fixture, render, settle,
    matchWrites: () => fixture.writes.filter(({ id }) => id === protocol.LIGHTCYCLE_REPLICATION_IDS.match),
    matchClaims: () => fixture.claims.filter((id) => id === protocol.LIGHTCYCLE_REPLICATION_IDS.match),
    fixedUpdate: () => find(runtimeTree, 'ViroGameLoop').props.onFixedUpdate,
    toggleReady: () => nodes(sharedTree).find((node) =>
      node.type === 'ViroBox' && node.props.onClick)?.props.onClick(),
    remountScene() {
      runtime?.unmount(); shared?.unmount(); scene.unmount();
      runtime = shared = undefined;
      scene = fixture.mount(fixture.Scene);
    },
    remountFrame() { runtime?.unmount(); shared?.unmount(); runtime = shared = undefined; },
    unmount() { runtime?.unmount(); shared?.unmount(); scene.unmount(); },
  };
}

function nodes(tree: Element | null): Element[] {
  if (!tree) return [];
  return [tree, ...[tree.props?.children].flat().flatMap((child) =>
    child && typeof child === 'object' ? nodes(child) : [])];
}

const matchId = protocol.LIGHTCYCLE_REPLICATION_IDS.match;
const snapshotId = protocol.LIGHTCYCLE_REPLICATION_IDS.snapshot;

it('native host match publication waits for sync, claim acknowledgement and actual authority', () => {
  const fixture = matchPublicationFixture();
  fixture.transport.acknowledgeClaims = false;
  fixture.replication.state = 'connecting';
  fixture.settle();
  assert.deepEqual(fixture.matchClaims(), []);
  assert.deepEqual(fixture.matchWrites(), []);
  fixture.replication.state = 'synced';
  fixture.render();
  assert.deepEqual(fixture.matchClaims(), [matchId]);
  assert.deepEqual(fixture.matchWrites(), [], 'claim must not imply ownership before acknowledgement');
  fixture.entities.set(matchId, { id: matchId, owner: 'other-peer', version: 3, fields: {} });
  fixture.settle();
  assert.deepEqual(fixture.matchWrites(), []);
  fixture.entities.set(matchId, { ...fixture.entities.get(matchId)!, owner: 'host-peer' });
  fixture.settle();
  assert.deepEqual(fixture.matchWrites(), [{ id: matchId, fields: {
    phase: 'ready', hostPeerId: 'host-peer', placementReady: true, p1Ready: true, p2Ready: true,
  } }]);
  fixture.remountFrame();
  fixture.settle();
  assert.equal(fixture.matchWrites().length, 1, 'fresh facades and frame remounts must not repeat optimistic writes');
  fixture.unmount();
});

it('native host publishes lobby without a mat and keeps placement separate from frame localization', () => {
  const fixture = matchPublicationFixture();
  tabletopSession.getState().setHostPlacement(null);
  fixture.settle();
  assert.equal(find(fixture.render().sharedTree, 'ViroText').props.text, 'SYNCING HOST MAT POSE…');
  assert.equal(fixture.claims.includes(snapshotId), false);
  assert.equal(fixture.claims.includes(protocol.LIGHTCYCLE_REPLICATION_IDS.input('p1')), false);
  assert.deepEqual(fixture.matchWrites().at(-1)?.fields, {
    phase: 'lobby', hostPeerId: 'host-peer', placementReady: false, p1Ready: false, p2Ready: true,
  });
  tabletopSession.getState().setHostPlacement({ position: [0, 0, 0], surface: 'table' });
  tabletopSession.getState().setLocalized(false);
  fixture.settle();
  assert.deepEqual(fixture.matchWrites().at(-1)?.fields, {
    phase: 'lobby', hostPeerId: 'host-peer', placementReady: true, p1Ready: false, p2Ready: true,
  });
  const count = fixture.matchWrites().length;
  fixture.remountFrame();
  fixture.settle();
  assert.equal(fixture.matchWrites().length, count);
  assert.equal(tabletopRace.getState().roomRuntime?.hostState, null);
  fixture.unmount();
});

it('native guest waits for the mat before claiming inputs or playing replicated crash effects', () => {
  const fixture = matchPublicationFixture('guest');
  const placementId = protocol.LIGHTCYCLE_REPLICATION_IDS.placement;
  const placement = fixture.entities.get(placementId)!;
  fixture.entities.delete(placementId);
  let state = core.startLightCycleRoundImmediately(core.createLightCycleMatch());
  setCrashRider(state, 'p1', core.LIGHTCYCLE_ARENA_HALF - 1, 1);
  state = core.advanceLightCycleMatch(state);
  assert.equal(state.derezEvents.length, 1);
  fixture.entities.set(snapshotId, { id: snapshotId, owner: 'host-peer', version: 1, fields: { state } });
  fixture.settle();
  assert.deepEqual(fixture.effects, []);
  assert.equal(fixture.claims.includes(protocol.LIGHTCYCLE_REPLICATION_IDS.input('p2')), false);
  fixture.entities.set(placementId, placement);
  fixture.settle();
  assert.equal(fixture.claims.includes(protocol.LIGHTCYCLE_REPLICATION_IDS.input('p2')), true);
  assert.equal(fixture.effects.filter((event: any) => event.type === 'derez').length, 1);
  fixture.remountFrame();
  fixture.settle();
  assert.equal(fixture.effects.filter((event: any) => event.type === 'derez').length, 1);
  fixture.unmount();
});

it('native Ready callback drives lobby, readiness and authoritative start without repeated publication', () => {
  const fixture = matchPublicationFixture();
  tabletopSession.getState().setReady(false);
  fixture.settle();
  assert.equal(fixture.entities.get(matchId)?.fields.phase, 'lobby');
  const idleLoop = fixture.fixedUpdate();
  idleLoop();
  assert.equal(tabletopRace.getState().roomRuntime?.hostState, null);
  fixture.toggleReady();
  fixture.settle();
  assert.deepEqual(fixture.matchWrites().at(-1)?.fields, {
    phase: 'ready', hostPeerId: 'host-peer', placementReady: true, p1Ready: true, p2Ready: true,
  });
  const readyCount = fixture.matchWrites().length;
  fixture.settle();
  assert.equal(fixture.matchWrites().length, readyCount);
  const loop = fixture.fixedUpdate();
  for (let i = 0; i < 6; i++) loop();
  const state = tabletopRace.getState().roomRuntime!.hostState!;
  assert.equal(state.phase, 'countdown');
  assert.equal(state.tick, 6);
  assert.deepEqual(fixture.entities.get(snapshotId)?.fields.state, state);
  assert.deepEqual(fixture.matchWrites().at(-1)?.fields, {
    phase: state.phase, tick: state.tick, round: state.round, score: state.scores, winner: state.matchWinner,
  });
  assert.equal(fixture.entities.get(matchId)?.fields.hostPeerId, 'host-peer', 'active patches preserve lobby fields');
  fixture.settle();
  const activeCount = fixture.matchWrites().length;
  fixture.toggleReady();
  fixture.settle();
  fixture.fixedUpdate()();
  assert.equal(tabletopRace.getState().roomRuntime!.hostState, state, 'readiness loss pauses rather than resets');
  assert.equal(fixture.matchWrites().length, activeCount, 'readiness must not downgrade an active match');
  fixture.toggleReady();
  fixture.settle();
  for (let i = 0; i < 6; i++) fixture.fixedUpdate()();
  assert.equal(tabletopRace.getState().roomRuntime!.hostState!.tick, 12);
  assert.equal(fixture.entities.get(matchId)?.fields.tick, 12);
  fixture.unmount();
});

for (const loss of ['ready', 'frame', 'peer'] as const) {
  it(`native ${loss} loss before the first snapshot cannot republish a started match as lobby`, () => {
    const fixture = matchPublicationFixture();
    fixture.settle();
    fixture.fixedUpdate()();
    const runtime = tabletopRace.getState().roomRuntime!;
    assert.equal(runtime.hostState!.tick, 1);
    assert.equal(runtime.hostState!.phase, 'countdown');
    assert.equal(fixture.entities.get(snapshotId)?.fields.state, undefined, 'snapshots retain their six-tick cadence');
    const writes = fixture.matchWrites().length;
    if (loss === 'ready') fixture.toggleReady();
    if (loss === 'frame') fixture.render().frame.props.onLocalizeError('tracking temporarily lost');
    if (loss === 'peer') fixture.colocated.peers[0]!.localized = false;
    fixture.settle();
    fixture.remountFrame();
    fixture.settle();
    assert.equal(fixture.matchWrites().length, writes, 'a started countdown must not regress to lobby');
    assert.equal(runtime.hostState!.tick, 1);
    tabletopSession.getState().setLocalized(true);
    tabletopSession.getState().setReady(true);
    fixture.colocated.peers[0]!.localized = true;
    fixture.settle();
    for (let i = 0; i < 5; i++) fixture.fixedUpdate()();
    assert.equal(runtime.hostState!.tick, 6);
    assert.equal(fixture.entities.get(matchId)?.fields.phase, 'countdown');
    assert.equal(fixture.entities.get(snapshotId)?.fields.state, runtime.hostState);
    fixture.unmount();
  });
}

for (const phase of ['countdown', 'running', 'round-over', 'match-over'] as const) {
  it(`native ${phase} metadata survives loss of remote readiness and frame remount`, () => {
    const fixture = matchPublicationFixture();
    const fields = { phase, tick: 42, round: 2, score: { p1: 1, p2: 0 }, winner: null };
    fixture.entities.set(matchId, { id: matchId, owner: 'host-peer', version: 7, fields });
    fixture.settle();
    fixture.colocated.peers[0]!.localized = false;
    fixture.settle();
    fixture.remountFrame();
    fixture.settle();
    fixture.fixedUpdate()();
    assert.deepEqual(fixture.matchWrites(), []);
    assert.deepEqual(fixture.entities.get(matchId)?.fields, fields);
    assert.equal(tabletopRace.getState().roomRuntime!.hostState, null);
    fixture.unmount();
  });
}

it('native guest never claims or publishes authoritative entities even when their ownership is misassigned', () => {
  const fixture = matchPublicationFixture('guest');
  fixture.settle();
  assert.deepEqual(fixture.matchClaims(), []);
  assert.equal(fixture.claims.includes(snapshotId), false);
  const state = core.createLightCycleMatch({ names: { p1: 'HOST', p2: 'GUEST' } });
  fixture.entities.set(matchId, { id: matchId, owner: 'guest-peer', version: 1, fields: { phase: 'countdown' } });
  fixture.entities.set(snapshotId, { id: snapshotId, owner: 'guest-peer', version: 1, fields: { state } });
  fixture.settle();
  fixture.fixedUpdate()();
  fixture.toggleReady();
  fixture.settle();
  assert.deepEqual(fixture.matchClaims(), []);
  assert.deepEqual(fixture.matchWrites(), []);
  assert.equal(fixture.claims.includes(snapshotId), false);
  assert.equal(fixture.writes.some(({ id }) => id === snapshotId), false);
  assert.equal(tabletopRace.getState().roomRuntime!.hostState, null);
  const { sharedTree, runtimeTree } = fixture.render();
  assert.equal(find(runtimeTree, 'McpPresence').props.state, state);
  assert.equal(find(sharedTree, 'TabletopRiveScoreboard').props.replicatedState, state);
  fixture.unmount();
});

it('native active updates check match and snapshot ownership independently', () => {
  const fixture = matchPublicationFixture();
  fixture.settle();
  fixture.entities.set(matchId, { ...fixture.entities.get(matchId)!, owner: 'other-peer' });
  const matchCount = fixture.matchWrites().length;
  const snapshotCount = () => fixture.writes.filter(({ id }) => id === snapshotId).length;
  for (let i = 0; i < 6; i++) fixture.fixedUpdate()();
  assert.equal(tabletopRace.getState().roomRuntime!.hostState!.tick, 6);
  assert.equal(fixture.matchWrites().length, matchCount);
  assert.equal(snapshotCount(), 1);
  fixture.entities.set(matchId, { ...fixture.entities.get(matchId)!, owner: 'host-peer' });
  fixture.entities.set(snapshotId, { ...fixture.entities.get(snapshotId)!, owner: 'other-peer' });
  for (let i = 0; i < 6; i++) fixture.fixedUpdate()();
  assert.equal(fixture.matchWrites().length, matchCount + 1);
  assert.equal(fixture.entities.get(matchId)?.fields.tick, 12);
  assert.equal(snapshotCount(), 1);
  fixture.unmount();
});

for (const replacementRoomId of ['room-b', 'room-a']) {
  it(`native replacement ${replacementRoomId} starts fresh and rejects the previous generation callback`, () => {
    const fixture = matchPublicationFixture();
    fixture.settle();
    const oldLoop = fixture.fixedUpdate();
    for (let i = 0; i < 6; i++) oldLoop();
    const oldRuntime = tabletopRace.getState().roomRuntime!;
    fixture.room.roomId = replacementRoomId;
    if (replacementRoomId === 'room-a') fixture.remountScene();
    fixture.entities.delete(matchId);
    fixture.entities.delete(snapshotId);
    fixture.settle();
    const replacement = tabletopRace.getState().roomRuntime!;
    assert.notEqual(replacement, oldRuntime);
    assert.equal(replacement.roomId, replacementRoomId);
    assert.equal(replacement.hostState, null);
    assert.equal(fixture.entities.get(matchId)?.fields.phase, 'ready');
    const writes = fixture.writes.length;
    oldLoop();
    assert.equal(fixture.writes.length, writes);
    assert.equal(oldRuntime.hostState!.tick, 6);
    assert.equal(replacement.hostState, null);
    fixture.fixedUpdate()();
    assert.equal(replacement.hostState!.tick, 1);
    fixture.unmount();
  });
}

type HostedAnchor = { success: boolean; cloudAnchorId?: string; error?: string };

function deferredAnchor() {
  let resolve!: (result: HostedAnchor) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<HostedAnchor>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function anchorFixture(platform = { isQuest: false, isPico: false, isVisionOS: false }) {
  const fixture = nativeFixture(platform);
  const requests: ReturnType<typeof deferredAnchor>[] = [];
  const calls: unknown[][] = [];
  const navigator = {
    hostCloudAnchor: (...args: unknown[]) => {
      calls.push(args);
      const request = deferredAnchor();
      requests.push(request);
      return request.promise;
    },
  };
  const session = tabletopSession.getState();
  session.setPlayerName('HOST');
  session.beginHost();
  const select = (id = 'table') => session.setPlacementCandidate({
    anchorId: id, worldPosition: [1, 2, 3], surface: 'table',
  });
  select();
  let scene = fixture.mount(fixture.Scene);
  const render = (props = { arSceneNavigator: navigator }) => scene.render(props);
  const confirm = () => find(render(), 'ViroARPlaneSelector').props.children.props.onConfirm;
  return {
    ...fixture, requests, calls, select, render, confirm,
    unmount: () => scene.unmount(),
    remount: () => { scene.unmount(); scene = fixture.mount(fixture.Scene); },
  };
}

const flushAnchor = () => new Promise<void>((resolve) => setImmediate(resolve));

it('native phone placement publishes exactly once despite repeated confirmation before rerender', async () => {
  const fixture = anchorFixture();
  const confirm = fixture.confirm();
  confirm();
  confirm();
  assert.deepEqual(fixture.calls, [['table', 1]]);
  assert.equal(tabletopSession.getState().placementConfirmed, true);
  assert.equal(tabletopSession.getState().phoneAnchorWorking, true);
  assert.equal(find(fixture.render(), 'ViroText').props.text, 'PUBLISHING TABLE ANCHOR…');
  fixture.requests[0]!.resolve({ success: true, cloudAnchorId: 'published-table' });
  await flushAnchor();
  assert.equal(tabletopSession.getState().phoneCloudAnchorId, 'published-table');
  assert.equal(tabletopSession.getState().phoneAnchorWorking, false);
  assert.equal(tabletopSession.getState().error, null);
  assert.equal(find(fixture.render(), 'ViroSharedFrame').props.source.key, 'published-table');
  confirm();
  assert.equal(fixture.requests.length, 1);
  fixture.unmount();
  assert.equal(tabletopSession.getState().placementConfirmed, true);
});

for (const failure of ['rejection', 'unsuccessful', 'missing-id', 'synchronous'] as const) {
  it(`native phone placement recovers from ${failure} and retries the same candidate`, async () => {
    const fixture = anchorFixture();
    if (failure === 'synchronous') {
      const tree = fixture.render({ arSceneNavigator: {
        hostCloudAnchor: () => { throw new Error('synchronous hosting failure'); },
      } });
      find(tree, 'ViroARPlaneSelector').props.children.props.onConfirm();
    } else {
      fixture.confirm()();
      if (failure === 'rejection') fixture.requests[0]!.reject(new Error('hosting failure'));
      if (failure === 'unsuccessful') fixture.requests[0]!.resolve({ success: false, error: 'hosting failure' });
      if (failure === 'missing-id') fixture.requests[0]!.resolve({ success: true });
    }
    await flushAnchor();
    assert.equal(tabletopSession.getState().placementConfirmed, false);
    assert.equal(tabletopSession.getState().phoneAnchorWorking, false);
    assert.equal(tabletopSession.getState().phoneCloudAnchorId, null);
    assert.match(tabletopSession.getState().error!, /hosting failure|Unable to publish/);
    fixture.confirm()();
    assert.equal(tabletopSession.getState().error, null);
    assert.equal(tabletopSession.getState().phoneAnchorWorking, true);
    fixture.requests.at(-1)!.resolve({ success: true, cloudAnchorId: 'retry-table' });
    await flushAnchor();
    assert.equal(tabletopSession.getState().phoneCloudAnchorId, 'retry-table');
    fixture.unmount();
  });
}

for (const staleResult of ['success', 'failure', 'rejection'] as const) {
  for (const replacement of ['host', 'candidate', 'clear', 'close', 'remount'] as const) {
    it(`native phone ${staleResult} cannot overwrite ${replacement} replacement work`, async () => {
      const fixture = anchorFixture();
      const oldConfirm = fixture.confirm();
      oldConfirm();
      const old = fixture.requests[0]!;
      const session = tabletopSession.getState();
      if (replacement === 'host') session.beginHost();
      if (replacement === 'candidate') fixture.select('other-table');
      if (replacement === 'clear') session.clearPlacement();
      if (replacement === 'close') {
        session.setSpatialViewOpen(false);
        session.setSpatialViewOpen(true);
      }
      if (replacement === 'remount') fixture.remount();
      if (replacement === 'host' || replacement === 'clear') fixture.select('other-table');
      assert.equal(tabletopSession.getState().phoneAnchorWorking, false);
      assert.equal(tabletopSession.getState().placementConfirmed, false);
      fixture.confirm()();
      const replacementState = tabletopSession.getState();
      assert.equal(replacementState.phoneAnchorWorking, true);
      assert.equal(fixture.requests.length, 2);
      if (staleResult === 'success') old.resolve({ success: true, cloudAnchorId: 'stale-anchor' });
      if (staleResult === 'failure') old.resolve({ success: false, error: 'stale failure' });
      if (staleResult === 'rejection') old.reject(new Error('stale rejection'));
      await flushAnchor();
      assert.equal(tabletopSession.getState(), replacementState);
      fixture.requests[1]!.resolve({ success: true, cloudAnchorId: 'replacement-anchor' });
      await flushAnchor();
      assert.equal(tabletopSession.getState().phoneCloudAnchorId, 'replacement-anchor');
      assert.equal(tabletopSession.getState().phoneAnchorWorking, false);
      oldConfirm();
      assert.equal(fixture.requests.length, 2);
      fixture.unmount();
    });
  }
}

for (const leave of ['reset', 'guest', 'solo', 'unmount'] as const) {
  for (const reject of [false, true]) {
    it(`native phone ${reject ? 'failure' : 'success'} is ignored after ${leave}`, async () => {
      const fixture = anchorFixture();
      const oldConfirm = fixture.confirm();
      oldConfirm();
      const session = tabletopSession.getState();
      if (leave === 'reset') session.reset();
      if (leave === 'guest') { session.setJoinCode('ABCDEF'); session.beginGuest(); }
      if (leave === 'solo') session.beginSolo();
      if (leave === 'unmount') fixture.unmount();
      const expected = tabletopSession.getState();
      if (reject) fixture.requests[0]!.reject(new Error('late hosting failure'));
      else fixture.requests[0]!.resolve({ success: true, cloudAnchorId: 'late-anchor' });
      await flushAnchor();
      assert.equal(tabletopSession.getState(), expected);
      assert.equal(expected.phoneAnchorWorking, false);
      oldConfirm();
      assert.equal(fixture.requests.length, 1);
      fixture.unmount();
    });
  }
}

it('native placement rejects a stale UI callback before it starts hosting a replacement session', () => {
  const fixture = anchorFixture();
  const oldConfirm = fixture.confirm();
  tabletopSession.getState().beginHost();
  fixture.select('replacement-table');
  const expected = tabletopSession.getState();
  oldConfirm();
  assert.equal(tabletopSession.getState(), expected);
  assert.equal(fixture.requests.length, 0);
  fixture.unmount();
});

it('native hosting revokes ownership even if the same candidate object is restored before resolution', async () => {
  const fixture = anchorFixture();
  fixture.confirm()();
  const candidate = tabletopSession.getState().placementCandidate;
  tabletopSession.getState().setPlacementCandidate(null);
  tabletopSession.getState().setPlacementCandidate(candidate);
  fixture.confirm()();
  const expected = tabletopSession.getState();
  fixture.requests[0]!.resolve({ success: true, cloudAnchorId: 'stale-anchor' });
  await flushAnchor();
  assert.equal(tabletopSession.getState(), expected);
  fixture.requests[1]!.resolve({ success: true, cloudAnchorId: 'current-anchor' });
  await flushAnchor();
  assert.equal(tabletopSession.getState().phoneCloudAnchorId, 'current-anchor');
  fixture.unmount();
});

it('native Quest confirmation retains its spatial-anchor path without phone hosting', () => {
  const fixture = anchorFixture({ isQuest: true, isPico: false, isVisionOS: false });
  const confirm = fixture.confirm();
  confirm();
  confirm();
  assert.equal(tabletopSession.getState().placementConfirmed, true);
  assert.equal(tabletopSession.getState().phoneAnchorWorking, false);
  assert.equal(fixture.calls.length, 0);
  assert.equal(fixture.effects.filter((event: any) => event.type === 'mat-lock').length, 1);
  assert.equal(find(fixture.render(), 'ViroSharedFrame').props.source.key,
    tabletopSession.getState().hostFrameRef);
  fixture.unmount();
});

it('native phone placement without cloud hosting returns to preview with an actionable error', () => {
  const fixture = anchorFixture();
  const tree = fixture.render({ arSceneNavigator: {} as any });
  const confirmations: boolean[] = [];
  const unsubscribe = useTabletopSessionStore.subscribe((state) => confirmations.push(state.placementConfirmed));
  find(tree, 'ViroARPlaneSelector').props.children.props.onConfirm();
  unsubscribe();
  assert.equal(tabletopSession.getState().placementConfirmed, false);
  assert.equal(tabletopSession.getState().phoneAnchorWorking, false);
  assert.equal(tabletopSession.getState().error, 'This device does not expose cloud-anchor hosting.');
  assert.ok(confirmations.every((confirmed) => !confirmed), 'unsupported placement must never appear confirmed');
  assert.equal(fixture.effects.filter((event: any) => event.type === 'mat-lock').length, 0);
  fixture.unmount();
});

it('native PICO continues to hide unsupported placement controls', () => {
  const fixture = anchorFixture({ isQuest: false, isPico: true, isVisionOS: false });
  assert.equal(find(fixture.render(), 'ViroText').props.text, 'PICO SHARED-FRAME MODE NOT AVAILABLE');
  assert.throws(() => find(fixture.render(), 'ViroARPlaneSelector'), /Missing/);
  assert.equal(fixture.calls.length, 0);
  fixture.unmount();
});

for (const replacementSucceeds of [false, true]) {
  it(`native stale completion preserves an already ${replacementSucceeds ? 'published' : 'failed'} replacement`, async () => {
    const fixture = anchorFixture();
    fixture.confirm()();
    tabletopSession.getState().beginHost();
    fixture.select('replacement-table');
    fixture.confirm()();
    fixture.requests[1]!.resolve(replacementSucceeds
      ? { success: true, cloudAnchorId: 'replacement-anchor' }
      : { success: false, error: 'replacement failed' });
    await flushAnchor();
    const expected = tabletopSession.getState();
    fixture.requests[0]!.resolve({ success: true, cloudAnchorId: 'obsolete-anchor' });
    await flushAnchor();
    assert.equal(tabletopSession.getState(), expected);
    assert.equal(expected.error, replacementSucceeds ? null : 'replacement failed');
    assert.equal(expected.phoneCloudAnchorId, replacementSucceeds ? 'replacement-anchor' : null);
    fixture.unmount();
  });
}
