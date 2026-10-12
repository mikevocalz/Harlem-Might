import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import type { SpatialTrack } from './spatial-audio.ts';
import { createWebSpatialMusicEngine } from './spatial-audio.web.ts';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

const vectorParams = () => ({ positionX: { value: 0 }, positionY: { value: 0 }, positionZ: { value: 0 } });
class BrowserPanner {
  positionX = { value: 0 };
  positionY = { value: 0 };
  positionZ = { value: 0 };
  panningModel = '';
  distanceModel = '';
  refDistance = 0;
  rolloffFactor = 0;
  connections: unknown[] = [];
  disconnects = 0;
  connect(target: unknown) { this.connections.push(target); }
  disconnect() { this.disconnects++; }
}
class BrowserSource {
  connections: unknown[] = [];
  disconnects = 0;
  connect(target: unknown) { this.connections.push(target); }
  disconnect() { this.disconnects++; }
}
class BrowserAudio {
  static instances: BrowserAudio[] = [];
  src = '';
  crossOrigin = '';
  preload = '';
  currentTime = 0;
  paused = true;
  pauses = 0;
  loads = 0;
  plays: ReturnType<typeof deferred>[] = [];
  constructor() { BrowserAudio.instances.push(this); }
  play() {
    const pending = deferred();
    this.plays.push(pending);
    this.paused = false;
    // Explicit settlement lets tests exercise both completion orders without
    // network, browser policy, real media, or a timer determining the outcome.
    return pending.promise;
  }
  pause() { this.paused = true; this.pauses++; }
  removeAttribute(name: string) { assert.equal(name, 'src'); this.src = ''; }
  load() { this.loads++; }
}
class BrowserContext {
  static instances: BrowserContext[] = [];
  state = 'suspended';
  destination = {};
  listener = {
    ...vectorParams(),
    forwardX: { value: 0 }, forwardY: { value: 0 }, forwardZ: { value: 0 },
    upX: { value: 0 }, upY: { value: 0 }, upZ: { value: 0 },
  };
  panners: BrowserPanner[] = [];
  sources: { audio: BrowserAudio; node: BrowserSource }[] = [];
  resumes: ReturnType<typeof deferred>[] = [];
  closes: ReturnType<typeof deferred>[] = [];
  constructor() { BrowserContext.instances.push(this); }
  createPanner() {
    const node = new BrowserPanner();
    this.panners.push(node);
    return node;
  }
  createMediaElementSource(audio: BrowserAudio) {
    const node = new BrowserSource();
    this.sources.push({ audio, node });
    return node;
  }
  resume() {
    const pending = deferred();
    this.resumes.push(pending);
    return pending.promise;
  }
  close() {
    const pending = deferred();
    this.closes.push(pending);
    this.state = 'closed';
    return pending.promise;
  }
}

const browserKeys = ['window', 'AudioContext', 'Audio'] as const;
const originalGlobals = browserKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
beforeEach(() => {
  BrowserContext.instances = [];
  BrowserAudio.instances = [];
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: { AudioContext: BrowserContext } },
    AudioContext: { configurable: true, value: BrowserContext },
    Audio: { configurable: true, value: BrowserAudio },
  });
});
afterEach(() => {
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const track: SpatialTrack = {
  url: 'https://media.example.test/licensed.mp3', title: 'Licensed recording',
  licenseSourceUrl: 'https://rights.example.test/license', format: 'stereo',
};
const replacement: SpatialTrack = { ...track, url: 'https://media.example.test/replacement.mp3' };
const context = () => BrowserContext.instances.at(-1)!;
const audio = () => BrowserAudio.instances.at(-1)!;
async function resume(index = 0, target = context()) {
  target.resumes[index]!.resolve();
  await Promise.resolve();
}

for (const action of ['pause', 'stop', 'dispose'] as const) {
  it(`${action} while resume is pending prevents any media play`, async () => {
    const engine = createWebSpatialMusicEngine();
    const pending = engine.play(track);
    const originalAudio = audio();
    const originalContext = context();
    originalAudio.currentTime = 12;
    const cancellation = engine[action]();
    if (action === 'dispose') originalContext.closes[0]!.resolve();
    await cancellation;
    await resume(0, originalContext);
    assert.equal(originalAudio.plays.length, 0);
    await pending;
    assert.equal(originalAudio.paused, true);
    assert.equal(originalAudio.currentTime, action === 'stop' ? 0 : 12);
    if (action === 'dispose') {
      assert.equal(originalAudio.src, '');
      assert.equal(originalAudio.loads, 1);
      assert.equal(originalContext.sources[0]!.node.disconnects, 1);
      assert.equal(originalContext.panners[0]!.disconnects, 1);
    }
  });
}

for (const sameTrack of [false, true]) {
  for (const latestFirst of [false, true]) {
    it(`only the latest ${sameTrack ? 'same-track' : 'replacement'} request plays when ${latestFirst ? 'new' : 'old'} resume settles first`, async () => {
      const engine = createWebSpatialMusicEngine();
      const old = engine.play(track);
      const originalAudio = audio();
      const latest = engine.play(sameTrack ? track : replacement);
      const latestAudio = audio();
      await resume(latestFirst ? 1 : 0);
      await resume(latestFirst ? 0 : 1);
      assert.equal(latestAudio.plays.length, 1);
      if (!sameTrack) {
        assert.equal(originalAudio.plays.length, 0);
        assert.equal(originalAudio.paused, true);
        assert.equal(context().sources[0]!.node.disconnects, 1);
      }
      latestAudio.plays[0]!.resolve();
      await Promise.all([old, latest]);
      assert.equal(latestAudio.paused, false);
    });
  }
}

for (const action of ['pause', 'stop', 'dispose'] as const) {
  it(`${action} remains authoritative if an already-issued media play fulfills late`, async () => {
    const engine = createWebSpatialMusicEngine();
    const pending = engine.play(track);
    await resume();
    const originalAudio = audio();
    const cancellation = engine[action]();
    if (action === 'dispose') context().closes[0]!.resolve();
    await cancellation;
    const pauses = originalAudio.pauses;
    originalAudio.plays[0]!.resolve();
    await pending;
    assert.equal(originalAudio.pauses, pauses + 1);
    assert.equal(originalAudio.paused, true);
  });
}

it('late completion pauses only a replaced media element', async () => {
  const engine = createWebSpatialMusicEngine();
  const old = engine.play(track);
  await resume();
  const oldAudio = audio();
  const latest = engine.play(replacement);
  await resume(1);
  const latestAudio = audio();
  latestAudio.plays[0]!.resolve();
  await latest;
  const oldPauses = oldAudio.pauses;
  oldAudio.plays[0]!.resolve();
  await old;
  assert.equal(oldAudio.pauses, oldPauses + 1);
  assert.equal(latestAudio.pauses, 0);
  assert.equal(latestAudio.paused, false);
});

for (const outcome of ['resolve', 'reject'] as const) {
  for (const latestFirst of [false, true]) {
    it(`an old same-element play ${outcome} does not pause a newer play (${latestFirst ? 'new' : 'old'} settles first)`, async () => {
      const engine = createWebSpatialMusicEngine();
      const old = engine.play(track);
      await resume();
      const latest = engine.play(track);
      await resume(1);
      const media = audio();
      const settleOld = () => outcome === 'resolve'
        ? media.plays[0]!.resolve()
        : media.plays[0]!.reject(new Error('obsolete playback failure'));
      if (latestFirst) { media.plays[1]!.resolve(); await latest; }
      settleOld();
      await old;
      if (!latestFirst) { media.plays[1]!.resolve(); await latest; }
      assert.equal(BrowserAudio.instances.length, 1);
      assert.equal(media.pauses, 0);
      assert.equal(media.paused, false);
    });
  }
}

it('pause then replay can reuse the element without an old play pausing it', async () => {
  const engine = createWebSpatialMusicEngine();
  const old = engine.play(track);
  await resume();
  await engine.pause();
  const latest = engine.play(track);
  await resume(1);
  audio().plays[1]!.resolve();
  await latest;
  const pauses = audio().pauses;
  audio().plays[0]!.resolve();
  await old;
  assert.equal(audio().pauses, pauses);
  assert.equal(audio().paused, false);
});

for (const outcome of ['resolve', 'reject'] as const) {
  it(`old media ${outcome} while a newer same-element resume is pending preserves its ownership`, async () => {
    const engine = createWebSpatialMusicEngine();
    const old = engine.play(track);
    await resume();
    const latest = engine.play(track);
    if (outcome === 'resolve') audio().plays[0]!.resolve();
    else audio().plays[0]!.reject(new Error('obsolete'));
    await old;
    assert.equal(audio().pauses, 0);
    await resume(1);
    audio().plays[1]!.resolve();
    await latest;
    assert.equal(audio().paused, false);
  });
}

for (const stage of ['resume', 'play'] as const) {
  it(`propagates a current ${stage} failure and permits a later retry`, async () => {
    const engine = createWebSpatialMusicEngine();
    const failed = engine.play(track);
    const error = new Error(`${stage} unavailable`);
    const rejection = assert.rejects(failed, (received: unknown) => received === error);
    if (stage === 'play') await resume();
    (stage === 'resume' ? context().resumes[0]! : audio().plays[0]!).reject(error);
    await rejection;
    assert.equal(audio().paused, true);
    const retry = engine.play(track);
    await resume(1);
    audio().plays.at(-1)!.resolve();
    await retry;
    assert.equal(audio().paused, false);
    assert.equal(BrowserContext.instances.length, 1);
    assert.equal(BrowserAudio.instances.length, 1);
  });

  it(`ignores an obsolete ${stage} rejection after cancellation`, async () => {
    const engine = createWebSpatialMusicEngine();
    const pending = engine.play(track);
    if (stage === 'play') await resume();
    await engine.stop();
    (stage === 'resume' ? context().resumes[0]! : audio().plays[0]!).reject(new Error('cancelled'));
    await pending;
    assert.equal(audio().paused, true);
  });

  it(`a newer same-element ${stage} failure revokes ownership before an old play fulfills`, async () => {
    const engine = createWebSpatialMusicEngine();
    const old = engine.play(track);
    await resume();
    const latest = engine.play(track);
    const rejection = assert.rejects(latest, /current failure/);
    if (stage === 'play') await resume(1);
    (stage === 'resume' ? context().resumes[1]! : audio().plays[1]!).reject(new Error('current failure'));
    await rejection;
    const pauses = audio().pauses;
    audio().plays[0]!.resolve();
    await old;
    assert.equal(audio().pauses, pauses + 1);
    assert.equal(audio().paused, true);
  });
}

it('dispose detaches resources before close settles and old work cannot affect a new engine session', async () => {
  const engine = createWebSpatialMusicEngine();
  const old = engine.play(track);
  const previous = context();
  const previousAudio = audio();
  const disposal = engine.dispose();
  const latest = engine.play(track);
  const current = context();
  assert.notEqual(current, previous);
  await resume(0, current);
  audio().plays[0]!.resolve();
  await latest;
  await resume(0, previous);
  assert.equal(audio().plays.length, 1);
  await old;
  previous.closes[0]!.resolve();
  await disposal;
  assert.equal(previousAudio.plays.length, 0);
  assert.equal(audio().plays.length, 1);
  assert.equal(audio().paused, false);
  assert.equal(current.closes.length, 0);
});

it('a close failure does not retain disposed resources or prevent a new session', async () => {
  const engine = createWebSpatialMusicEngine();
  const old = engine.play(track);
  const previous = context();
  const disposal = engine.dispose();
  const rejection = assert.rejects(disposal, /close failed/);
  previous.closes[0]!.reject(new Error('close failed'));
  await rejection;
  previous.resumes[0]!.reject(new Error('closed'));
  await old;
  const latest = engine.play(track);
  assert.notEqual(context(), previous);
  await resume();
  audio().plays[0]!.resolve();
  await latest;
  assert.equal(audio().paused, false);
});

it('rejecting an invalid request does not cancel an already-authorized play', async () => {
  const engine = createWebSpatialMusicEngine();
  const pending = engine.play(track);
  await assert.rejects(engine.play({ ...track, licenseSourceUrl: '' }), /licensed HTTPS/);
  await resume();
  audio().plays[0]!.resolve();
  await pending;
  assert.equal(audio().paused, false);
});

it('preserves capability gates and does not initialize audio for unsupported or unlicensed media', async () => {
  const engine = createWebSpatialMusicEngine();
  assert.deepEqual(engine.getCapabilities(), {
    supported: true, panner: true, headTracking: false, hrtf: false, ambisonics: false,
  });
  assert.equal(BrowserContext.instances.length, 0);
  await assert.rejects(engine.play({ ...track, url: 'http://media.example.test/audio.mp3' }), /licensed HTTPS/);
  await assert.rejects(engine.play({ ...track, licenseSourceUrl: '' }), /licensed HTTPS/);
  await assert.rejects(engine.play({ ...track, format: 'ambisonic' }), /Ambisonic decoding/);
  Reflect.deleteProperty(globalThis, 'window');
  assert.equal(engine.getCapabilities().supported, false);
  await assert.rejects(engine.play(track), /Positional audio unavailable/);
  assert.equal(BrowserContext.instances.length, 0);
  assert.equal(BrowserAudio.instances.length, 0);
});

it('retains position, pose, media reuse and ordinary pause/stop/dispose behavior', async () => {
  const engine = createWebSpatialMusicEngine();
  await engine.pause();
  await engine.stop();
  await engine.dispose();
  const position = { x: 2, y: 3, z: -4 };
  const pose = { position: { x: 5, y: 6, z: 7 }, forward: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 0, z: 1 } };
  engine.setSourcePosition(position);
  engine.setListenerPose(pose);
  const pending = engine.play(track);
  const ctx = context();
  const panner = ctx.panners[0]!;
  assert.deepEqual([panner.positionX.value, panner.positionY.value, panner.positionZ.value], [2, 3, -4]);
  assert.deepEqual([ctx.listener.positionX.value, ctx.listener.positionY.value, ctx.listener.positionZ.value], [5, 6, 7]);
  assert.deepEqual([ctx.listener.forwardX.value, ctx.listener.forwardY.value, ctx.listener.forwardZ.value], [1, 0, 0]);
  assert.deepEqual([ctx.listener.upX.value, ctx.listener.upY.value, ctx.listener.upZ.value], [0, 0, 1]);
  assert.equal(panner.panningModel, 'equalpower');
  assert.equal(panner.distanceModel, 'inverse');
  assert.equal(panner.refDistance, 1);
  assert.equal(panner.rolloffFactor, 1);
  assert.deepEqual(panner.connections, [ctx.destination]);
  assert.deepEqual(ctx.sources[0]!.node.connections, [panner]);
  assert.equal(audio().crossOrigin, 'anonymous');
  assert.equal(audio().preload, 'none');
  await resume();
  audio().plays[0]!.resolve();
  await pending;
  engine.setSourcePosition({ x: 10, y: 11, z: 12 });
  engine.setListenerPose({ ...pose, position: { x: 13, y: 14, z: 15 } });
  assert.deepEqual([panner.positionX.value, panner.positionY.value, panner.positionZ.value], [10, 11, 12]);
  assert.deepEqual([ctx.listener.positionX.value, ctx.listener.positionY.value, ctx.listener.positionZ.value], [13, 14, 15]);
  audio().currentTime = 20;
  await engine.pause();
  assert.equal(audio().currentTime, 20);
  const replay = engine.play(track);
  await resume(1);
  audio().plays[1]!.resolve();
  await replay;
  assert.equal(BrowserAudio.instances.length, 1);
  assert.equal(ctx.sources.length, 1);
  await engine.stop();
  assert.equal(audio().currentTime, 0);
  assert.equal(audio().paused, true);
  const disposal = engine.dispose();
  ctx.closes[0]!.resolve();
  await disposal;
  await engine.dispose();
  assert.equal(ctx.closes.length, 1);
});
