import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { registerHooks } from 'node:module';
import type { AudioBuffer, AudioContext, PannerNode } from 'react-native-audio-api';
import { SpatialAudioEngine } from './SpatialAudioEngine.web.ts';
import type { PositionalAudioOptions } from './types.ts';
import type { AudioContextLifecycle } from './SpatialAudioEngineCore.ts';

// Run the production native adapter with only the external SDK boundary inert.
// This is graph/adapter evidence, not a native-device or audio-rendering test.
const nativeUrl = new URL('./SpatialAudioEngine.native.ts', import.meta.url).href;
const contextKey = '__harlemSpatialAudioTestContext';
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === nativeUrl && specifier === 'react-native-audio-api') {
      return { url: 'spatial-audio-test:sdk', shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'spatial-audio-test:sdk') return {
      format: 'module', shortCircuit: true,
      source: `export class AudioContext {
        constructor() { return globalThis.${contextKey}; }
      }`,
    };
    return next(url, context);
  },
});
const { SpatialAudioEngine: NativeSpatialAudioEngine } = await import('./SpatialAudioEngine.native.ts');
hooks.deregister();
type Platform = 'native' | 'web';

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
  private ended: (() => void) | null = null;
  startTimes: number[] = [];
  private readonly platform: Platform;
  constructor(platform: Platform) { super(); this.platform = platform; }
  get onended(): (() => void) | null | undefined { return this.platform === 'native' ? this.ended ?? undefined : this.ended; }
  set onended(callback: (() => void) | null) { this.ended = callback; }
  start(when: number) { this.starts += 1; this.startTimes.push(when); }
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
  currentTime = 12.5;
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
  decodeInputs: unknown[] = [];
  private readonly platform: Platform;
  constructor(platform: Platform) { this.platform = platform; }
  decodeAudioData(input: unknown) {
    this.decodeInputs.push(input);
    this.decoding.resolve();
    return this.decoded.promise;
  }
  createBufferSource() {
    const source = new MockSource(this.platform);
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

function harness(t: TestContext, platform: Platform) {
  const context = new MockAudioContext(platform);
  const previousContext = Object.getOwnPropertyDescriptor(globalThis, contextKey);
  Object.defineProperty(globalThis, contextKey, { value: context, configurable: true });
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    value: { AudioContext: function () { return context; } }, configurable: true,
  });
  t.after(() => {
    if (previousContext) Object.defineProperty(globalThis, contextKey, previousContext);
    else Reflect.deleteProperty(globalThis, contextKey);
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });
  t.mock.method(globalThis, 'fetch', async () => new Response(new ArrayBuffer(1)));
  const engine = platform === 'native' ? new NativeSpatialAudioEngine() : new SpatialAudioEngine();
  t.after(() => engine.close());
  return { engine, context };
}

for (const platform of ['native', 'web'] as const) {
  test(`${platform}: cleanup while decoding prevents asynchronous playback`, async (t) => {
    const { engine, context } = harness(t, platform);
    const pending = engine.playAmbient('voice', 'voice.mp3');
    await context.decoding.promise;
    engine.stop('voice');
    context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
    await pending;
    assert.equal(context.sources.length, 0);
  });

  test(`${platform}: spatial graph uses equalpower and disconnects every node on natural end`, async (t) => {
    const { engine, context } = harness(t, platform);
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
    assert.equal(source.onended, platform === 'native' ? undefined : null);
    assert.deepEqual([source.disconnects, gain.disconnects, panner.disconnects], [1, 1, 1]);
  });

  test(`${platform}: ambient graph bypasses panning and cleanup never fires finish`, async (t) => {
    const { engine, context } = harness(t, platform);
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

  test(`${platform}: multichannel spatial sources are rejected rather than silently downmixed`, async (t) => {
    const { engine, context } = harness(t, platform);
    const pending = engine.playSpatial('voice', 'voice.mp3');
    context.decoded.resolve({ duration: 1, numberOfChannels: 4 });
    await assert.rejects(pending, /mono or stereo/);
    assert.equal(context.sources.length, 0);
  });

  test(`${platform}: partial graph construction disconnects the allocated source on failure`, async (t) => {
    const { engine, context } = harness(t, platform);
    context.failGain = true;
    const pending = engine.playAmbient('voice', 'voice.mp3');
    context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
    await assert.rejects(pending, /gain creation failed/);
    assert.equal(context.sources[0]!.disconnects, 1);
    assert.equal(context.sources[0]!.starts, 0);
  });

  for (const failingNode of ['source', 'gain', 'panner'] as const) {
    test(`${platform}: spatial teardown still disconnects other nodes when the ${failingNode} fails`, async (t) => {
      const { engine, context } = harness(t, platform);
      const warnings: unknown[][] = [];
      t.mock.method(console, 'warn', (...args: unknown[]) => { warnings.push(args); });
      const pending = engine.playSpatial('voice', 'voice.mp3');
      context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
      await pending;
      const failing = failingNode === 'source' ? context.sources[0]! : failingNode === 'gain' ? context.gains[0]! : context.panners[0]!;
      t.mock.method(failing, 'disconnect', () => { throw new Error('private graph failure'); });
      engine.unload('voice');
      if (failingNode === 'source') assert.equal(context.gains[0]!.disconnects, 1);
      else assert.equal(context.sources[0]!.disconnects, 1);
      assert.equal(context.sources[0]!.stops, 1);
      if (failingNode !== 'panner') assert.equal(context.panners[0]!.disconnects, 1);
      assert.deepEqual(warnings, [['Spatial audio resources could not disconnect cleanly.']]);
    });
  }

  test(`${platform}: partial panner construction failure preserves its original error and releases source and gain`, async (t) => {
    const { engine, context } = harness(t, platform);
    t.mock.method(context, 'createPanner', () => { throw new Error('panner creation failed'); });
    const pending = engine.playSpatial('voice', 'voice.mp3');
    context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
    await assert.rejects(pending, /panner creation failed/);
    assert.equal(context.sources[0]!.starts, 0);
    assert.equal(context.sources[0]!.disconnects, 1);
    assert.equal(context.gains[0]!.disconnects, 1);
  });

  for (const options of [
    {},
    { loop: true, volume: 0.4, position: [1, 2, 3], orientation: [-1, 0, 0], distanceModel: 'linear', refDistance: 4, maxDistance: 70, rolloffFactor: 2, coneInnerAngle: 30, coneOuterAngle: 60, coneOuterGain: 0.3 },
    { loop: false, volume: 0, position: [0, 0, 0], orientation: [0, 0, 0], distanceModel: 'exponential', refDistance: 0, maxDistance: 0, rolloffFactor: 0, coneInnerAngle: 0, coneOuterAngle: 0, coneOuterGain: 0 },
  ] satisfies PositionalAudioOptions[]) {
    test(`${platform}: every panner parameter preserves ${Object.keys(options).length ? options.distanceModel : 'default'} options`, async (t) => {
      const { engine, context } = harness(t, platform);
      const pending = engine.playSpatial('voice', 'voice.mp3', options);
      const buffer = { duration: 1, numberOfChannels: 2 };
      context.decoded.resolve(buffer);
      assert.equal(await pending, 'voice');
      const source = context.sources[0]!;
      const panner = context.panners[0]!;
      assert.equal(source.buffer, buffer);
      assert.equal(source.loop, options.loop ?? false);
      assert.deepEqual(source.startTimes, [12.5]);
      assert.equal(context.gains[0]!.gain.value, options.volume ?? 1);
      assert.deepEqual({
        panningModel: panner.panningModel, distanceModel: panner.distanceModel,
        refDistance: panner.refDistance, maxDistance: panner.maxDistance,
        rolloffFactor: panner.rolloffFactor, coneInnerAngle: panner.coneInnerAngle,
        coneOuterAngle: panner.coneOuterAngle, coneOuterGain: panner.coneOuterGain,
        position: [panner.positionX.value, panner.positionY.value, panner.positionZ.value],
        orientation: [panner.orientationX.value, panner.orientationY.value, panner.orientationZ.value],
      }, {
        panningModel: 'equalpower', distanceModel: options.distanceModel ?? 'inverse',
        refDistance: options.refDistance ?? 1, maxDistance: options.maxDistance ?? 10000,
        rolloffFactor: options.rolloffFactor ?? 1, coneInnerAngle: options.coneInnerAngle ?? 360,
        coneOuterAngle: options.coneOuterAngle ?? 360, coneOuterGain: options.coneOuterGain ?? 0,
        position: options.position ?? [0, 0, -1], orientation: options.orientation ?? [0, 0, 1],
      });
    });
  }

  test(`${platform}: pending and active setters update the same graph without replay`, async (t) => {
    const { engine, context } = harness(t, platform);
    const pending = engine.playSpatial('voice', 'voice.mp3');
    await context.decoding.promise;
    engine.setVolume('voice', 0.7);
    context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
    await pending;
    assert.equal(context.gains[0]!.gain.value, 0.7);
    engine.setVolume('voice', -1);
    engine.setSourcePosition('voice', [4, 5, 6]);
    engine.setSourceOrientation('voice', [0, 1, 0]);
    const panner = context.panners[0]!;
    assert.equal(context.gains[0]!.gain.value, 0);
    assert.deepEqual([panner.positionX.value, panner.positionY.value, panner.positionZ.value], [4, 5, 6]);
    assert.deepEqual([panner.orientationX.value, panner.orientationY.value, panner.orientationZ.value], [0, 1, 0]);
    assert.equal(context.sources.length, 1);
    assert.equal(context.sources[0]!.starts, 1);
  });

  test(`${platform}: multichannel ambient audio bypasses panning, including transform setters`, async (t) => {
    const { engine, context } = harness(t, platform);
    const pending = engine.playAmbientWithOutcome('voice', 'voice.mp3', { loop: true, volume: 0 });
    context.decoded.resolve({ duration: 1, numberOfChannels: 6 });
    assert.equal(await pending, 'played');
    engine.setSourcePosition('voice', [4, 5, 6]);
    engine.setSourceOrientation('voice', [0, 1, 0]);
    assert.equal(context.panners.length, 0);
    assert.equal(context.sources[0]!.loop, true);
    assert.equal(context.gains[0]!.gain.value, 0);
  });

  for (const cleanup of ['stop', 'unload', 'stopAll', 'close'] as const) {
    test(`${platform}: active ${cleanup} detaches completion before stopping and releases once`, async (t) => {
      const { engine, context } = harness(t, platform);
      let finishes = 0;
      const pending = engine.playSpatial('voice', 'voice.mp3', { onFinish: () => { finishes += 1; } });
      context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
      await pending;
      const source = context.sources[0]!;
      const staleEnded = source.onended!;
      const release = () => cleanup === 'stop' || cleanup === 'unload' ? engine[cleanup]('voice') : engine[cleanup]();
      await release();
      staleEnded();
      await release();
      assert.equal(source.onended, platform === 'native' ? undefined : null);
      assert.equal(finishes, 0);
      assert.equal(source.stops, 1);
      assert.deepEqual([source.disconnects, context.gains[0]!.disconnects, context.panners[0]!.disconnects], [1, 1, 1]);
    });
  }

  test(`${platform}: replacement detaches the old graph and ignores its stale ended callback`, async (t) => {
    const { engine, context } = harness(t, platform);
    let finishes = 0;
    const options = { onFinish: () => { finishes += 1; } };
    const first = engine.playSpatial('voice', 'voice.mp3', options);
    context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
    await first;
    const old = context.sources[0]!;
    const staleEnded = old.onended!;
    await engine.playSpatial('voice', 'voice.mp3', options);
    staleEnded();
    assert.equal(finishes, 0);
    assert.equal(old.stops, 1);
    assert.deepEqual([old.disconnects, context.gains[0]!.disconnects, context.panners[0]!.disconnects], [1, 1, 1]);
    const current = context.sources[1]!;
    const ended = current.onended!;
    ended();
    ended();
    assert.equal(finishes, 1);
    assert.equal(current.stops, 0);
    assert.deepEqual([current.disconnects, context.gains[1]!.disconnects, context.panners[1]!.disconnects], [1, 1, 1]);
  });

  test(`${platform}: a loop keeps its graph until explicit cleanup even if ended is delivered`, async (t) => {
    const { engine, context } = harness(t, platform);
    let finishes = 0;
    const pending = engine.playSpatial('voice', 'voice.mp3', { loop: true, onFinish: () => { finishes += 1; } });
    context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
    await pending;
    context.sources[0]!.onended?.();
    assert.equal(context.sources[0]!.disconnects, 0);
    await engine.close();
    assert.equal(context.sources[0]!.disconnects, 1);
    assert.equal(finishes, 0);
  });

  for (const failure of ['source allocation', 'buffer assignment', 'source connection', 'panner configuration', 'gain connection', 'panner connection', 'start', 'ended binding'] as const) {
    test(`${platform}: ${failure} failure preserves the error and releases every allocated node`, async (t) => {
      const { engine, context } = harness(t, platform);
      const error = new Error(failure);
      const fail = () => { throw error; };
      const createSource = context.createBufferSource.bind(context);
      t.mock.method(context, 'createBufferSource', () => {
        if (failure === 'source allocation') return fail();
        const source = createSource();
        if (failure === 'buffer assignment') Object.defineProperty(source, 'buffer', { set: fail });
        if (failure === 'source connection') t.mock.method(source, 'connect', fail);
        if (failure === 'start') t.mock.method(source, 'start', fail);
        if (failure === 'ended binding') Object.defineProperty(source, 'onended', {
          set(callback: (() => void) | null) { if (callback) fail(); },
        });
        return source;
      });
      const createGain = context.createGain.bind(context);
      t.mock.method(context, 'createGain', () => {
        const gain = createGain();
        if (failure === 'gain connection') t.mock.method(gain, 'connect', fail);
        return gain;
      });
      const createPanner = context.createPanner.bind(context);
      t.mock.method(context, 'createPanner', () => {
        const panner = createPanner();
        if (failure === 'panner configuration') Object.defineProperty(panner, 'refDistance', { set: fail });
        if (failure === 'panner connection') t.mock.method(panner, 'connect', fail);
        return panner;
      });
      const pending = engine.playSpatial('voice', 'voice.mp3');
      context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
      await assert.rejects(pending, (actual) => actual === error);
      assert.equal(context.sources.length, failure === 'source allocation' ? 0 : 1);
      assert.equal(context.gains.length, failure === 'source allocation' ? 0 : 1);
      assert.equal(context.panners.length, ['source allocation', 'buffer assignment', 'source connection'].includes(failure) ? 0 : 1);
      for (const node of [...context.sources, ...context.gains, ...context.panners]) assert.equal(node.disconnects, 1);
    });
  }

  test(`${platform}: construction cleanup continues after disconnect errors and retains the original failure`, async (t) => {
    const { engine, context } = harness(t, platform);
    const error = new Error('panner connection failed');
    const disconnected: string[] = [];
    const createSource = context.createBufferSource.bind(context);
    t.mock.method(context, 'createBufferSource', () => {
      const source = createSource();
      t.mock.method(source, 'disconnect', () => { disconnected.push('source'); throw new Error('source teardown failed'); });
      return source;
    });
    const createGain = context.createGain.bind(context);
    t.mock.method(context, 'createGain', () => {
      const gain = createGain();
      t.mock.method(gain, 'disconnect', () => { disconnected.push('gain'); throw new Error('gain teardown failed'); });
      return gain;
    });
    const createPanner = context.createPanner.bind(context);
    t.mock.method(context, 'createPanner', () => {
      const panner = createPanner();
      t.mock.method(panner, 'connect', () => { throw error; });
      t.mock.method(panner, 'disconnect', () => { disconnected.push('panner'); throw new Error('panner teardown failed'); });
      return panner;
    });
    const pending = engine.playSpatial('voice', 'voice.mp3');
    context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
    await assert.rejects(pending, (actual) => actual === error);
    assert.deepEqual(disconnected, ['source', 'gain', 'panner']);
  });

  test(`${platform}: stopping an already-ended source still disconnects every node`, async (t) => {
    const { engine, context } = harness(t, platform);
    const warnings: unknown[][] = [];
    t.mock.method(console, 'warn', (...args: unknown[]) => { warnings.push(args); });
    const pending = engine.playSpatial('voice', 'voice.mp3');
    context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
    await pending;
    t.mock.method(context.sources[0]!, 'stop', () => { throw new Error('already ended'); });
    engine.stop('voice');
    assert.deepEqual([context.sources[0]!.disconnects, context.gains[0]!.disconnects, context.panners[0]!.disconnects], [1, 1, 1]);
    assert.deepEqual(warnings, []);
  });

  for (const source of ['voice.mp3', { uri: 'voice.mp3' }, 42]) {
    test(`${platform}: platform decoding keeps ${JSON.stringify(source)} input semantics`, async (t) => {
      const { engine, context } = harness(t, platform);
      const fetches: unknown[] = [];
      t.mock.method(globalThis, 'fetch', async (input: unknown) => {
        fetches.push(input);
        return new Response(new ArrayBuffer(2));
      });
      const pending = engine.playAmbient('voice', source);
      context.decoded.resolve({ duration: 1, numberOfChannels: 1 });
      if (platform === 'web' && typeof source === 'number') {
        await assert.rejects(pending, /numeric audio sources are not available on web/);
        assert.equal(context.decodeInputs.length, 0);
        assert.equal(context.sources.length, 0);
      } else {
        await pending;
        if (platform === 'native') assert.deepEqual(context.decodeInputs, [typeof source === 'object' ? source.uri : source]);
        else {
          assert.equal(context.decodeInputs.length, 1);
          assert.ok(context.decodeInputs[0] instanceof ArrayBuffer);
          assert.equal(context.decodeInputs[0].byteLength, 2);
        }
      }
      assert.deepEqual(fetches, platform === 'web' && typeof source !== 'number' ? ['voice.mp3'] : []);
    });
  }

}
