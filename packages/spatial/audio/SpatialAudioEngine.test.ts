import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { AudioBuffer, AudioContext, PannerNode } from 'react-native-audio-api';
import { SpatialAudioEngine } from './SpatialAudioEngine.web.ts';
import type { AudioContextLifecycle } from './SpatialAudioEngineCore.ts';

type Buffer = Pick<AudioBuffer, 'duration' | 'numberOfChannels'>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

class MockNode {
  disconnects = 0;
  connections: MockNode[] = [];
  connect(node: MockNode) { this.connections.push(node); }
  disconnect() { this.disconnects += 1; this.connections = []; }
}

class MockSource extends MockNode {
  buffer: Buffer | null = null;
  loop = false;
  starts = 0;
  stops = 0;
  onended: (() => void) | null = null;
  start() { this.starts += 1; }
  stop() { this.stops += 1; this.onended?.(); }
}

class MockGain extends MockNode {
  gain = { value: 1 };
}

class MockPanner extends MockNode {
  panningModel: PannerNode['panningModel'] = 'equalpower';
  distanceModel: PannerNode['distanceModel'] = 'inverse';
  refDistance = 1;
  maxDistance = 10000;
  rolloffFactor = 1;
  coneInnerAngle = 360;
  coneOuterAngle = 360;
  coneOuterGain = 0;
  positionX = { value: 0 };
  positionY = { value: 0 };
  positionZ = { value: 0 };
  orientationX = { value: 0 };
  orientationY = { value: 0 };
  orientationZ = { value: 0 };
}

class MockAudioContext implements AudioContextLifecycle {
  state: AudioContext['state'] = 'running';
  currentTime = 0;
  destination = new MockNode();
  listener = {
    positionX: { value: 0 }, positionY: { value: 0 }, positionZ: { value: 0 },
    forwardX: { value: 0 }, forwardY: { value: 0 }, forwardZ: { value: -1 },
    upX: { value: 0 }, upY: { value: 1 }, upZ: { value: 0 },
  };
  sources: MockSource[] = [];
  gains: MockGain[] = [];
  panners: MockPanner[] = [];
  decoded = deferred<Buffer>();
  decoding = deferred<void>();
  failGain = false;
  decodeAudioData() {
    this.decoding.resolve();
    return this.decoded.promise;
  }
  createBufferSource() {
    const source = new MockSource();
    this.sources.push(source);
    return source;
  }
  createGain() {
    if (this.failGain) throw new Error('gain creation failed');
    const gain = new MockGain();
    this.gains.push(gain);
    return gain;
  }
  createPanner() {
    const panner = new MockPanner();
    this.panners.push(panner);
    return panner;
  }
  async suspend() { this.state = 'suspended'; }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
}

function harness(t: TestContext) {
  const context = new MockAudioContext();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    value: { AudioContext: function () { return context; } }, configurable: true,
  });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });
  t.mock.method(globalThis, 'fetch', async () => new Response(new ArrayBuffer(1)));
  const engine = new SpatialAudioEngine();
  t.after(() => engine.close());
  return { engine, context };
}

test('cleanup while decoding prevents asynchronous playback', async (t) => {
  const { engine, context } = harness(t);
  const pending = engine.playAmbient('voice', 'voice.mp3');
  await context.decoding.promise;
  engine.stop('voice');
  context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
  await pending;
  assert.equal(context.sources.length, 0);
});

test('spatial graph uses equalpower and disconnects every node on natural end', async (t) => {
  const { engine, context } = harness(t);
  let finishes = 0;
  const pending = engine.playSpatial('voice', 'voice.mp3', {
    position: [1, 2, 3], orientation: [1, 0, 0], volume: 0.94,
    onFinish: () => { finishes += 1; },
  });
  context.decoded.resolve({ duration: 1, numberOfChannels: 2 });
  await pending;
  const source = context.sources[0]!;
  const gain = context.gains[0]!;
  const panner = context.panners[0]!;
  assert.deepEqual(source.connections, [gain]);
  assert.deepEqual(gain.connections, [panner]);
  assert.deepEqual(panner.connections, [context.destination]);
  assert.equal(panner.panningModel, 'equalpower');
  assert.deepEqual([panner.positionX.value, panner.positionY.value, panner.positionZ.value], [1, 2, 3]);
  assert.equal(panner.orientationX.value, 1);
  assert.equal(gain.gain.value, 0.94);
  source.onended?.();
  assert.equal(finishes, 1);
  assert.equal(source.onended, null);
  assert.deepEqual([source.disconnects, gain.disconnects, panner.disconnects], [1, 1, 1]);
});

test('ambient graph bypasses panning and cleanup never fires finish', async (t) => {
  const { engine, context } = harness(t);
  let finishes = 0;
  const pending = engine.playAmbient('voice', 'voice.mp3', {
    onFinish: () => { finishes += 1; },
  });
  context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
  await pending;
  assert.equal(context.panners.length, 0);
  assert.deepEqual(context.gains[0]!.connections, [context.destination]);
  engine.unload('voice');
  assert.equal(finishes, 0);
  assert.equal(context.sources[0]!.stops, 1);
  assert.equal(context.sources[0]!.disconnects, 1);
  assert.equal(context.gains[0]!.disconnects, 1);
});

test('multichannel spatial sources are rejected rather than silently downmixed', async (t) => {
  const { engine, context } = harness(t);
  const pending = engine.playSpatial('voice', 'voice.mp3');
  context.decoded.resolve({ duration: 1, numberOfChannels: 4 });
  await assert.rejects(pending, /mono or stereo/);
  assert.equal(context.sources.length, 0);
});

test('partial graph construction disconnects the allocated source on failure', async (t) => {
  const { engine, context } = harness(t);
  context.failGain = true;
  const pending = engine.playAmbient('voice', 'voice.mp3');
  context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
  await assert.rejects(pending, /gain creation failed/);
  assert.equal(context.sources[0]!.disconnects, 1);
  assert.equal(context.sources[0]!.starts, 0);
});

for (const failingNode of ['source', 'gain'] as const) {
  test(`spatial teardown still disconnects other nodes when the ${failingNode} fails`, async (t) => {
    const { engine, context } = harness(t);
    const warnings: unknown[][] = [];
    t.mock.method(console, 'warn', (...args: unknown[]) => { warnings.push(args); });
    const pending = engine.playSpatial('voice', 'voice.mp3');
    context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
    await pending;
    const failing = failingNode === 'source' ? context.sources[0]! : context.gains[0]!;
    t.mock.method(failing, 'disconnect', () => { throw new Error('private graph failure'); });
    engine.unload('voice');
    if (failingNode === 'source') assert.equal(context.gains[0]!.disconnects, 1);
    else assert.equal(context.sources[0]!.disconnects, 1);
    assert.equal(context.sources[0]!.stops, 1);
    assert.equal(context.panners[0]!.disconnects, 1);
    assert.deepEqual(warnings, [['Spatial audio resources could not disconnect cleanly.']]);
  });
}

test('partial panner construction failure preserves its original error and releases source and gain', async (t) => {
  const { engine, context } = harness(t);
  t.mock.method(context, 'createPanner', () => { throw new Error('panner creation failed'); });
  const pending = engine.playSpatial('voice', 'voice.mp3');
  context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
  await assert.rejects(pending, /panner creation failed/);
  assert.equal(context.sources[0]!.starts, 0);
  assert.equal(context.sources[0]!.disconnects, 1);
  assert.equal(context.gains[0]!.disconnects, 1);
});
