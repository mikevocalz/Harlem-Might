import assert from 'node:assert/strict';
import test from 'node:test';
import type { AudioBuffer, AudioContext } from 'react-native-audio-api';
import {
  SpatialAudioEngineCore,
  type AudioContextLifecycle,
  type AudioPlayback,
} from './SpatialAudioEngineCore.ts';
import type { PositionalAudioOptions, SpatialAudioSource, SpatialAudioVec3 } from './types.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
type Buffer = Pick<AudioBuffer, 'duration'>;

class MockContext implements AudioContextLifecycle {
  state: AudioContext['state'] = 'running';
  currentTime = 2;
  listener = {
    positionX: { value: 0 }, positionY: { value: 0 }, positionZ: { value: 0 },
    forwardX: { value: 0 }, forwardY: { value: 0 }, forwardZ: { value: -1 },
    upX: { value: 0 }, upY: { value: 1 }, upZ: { value: 0 },
  };
  resumes = 0;
  suspends = 0;
  closes = 0;
  resumeGate: Promise<void> = Promise.resolve();
  closeGate: Promise<void> = Promise.resolve();
  async resume() {
    this.resumes += 1;
    await this.resumeGate;
    this.state = 'running';
  }
  async suspend() {
    this.suspends += 1;
    this.state = 'suspended';
  }
  async close() {
    this.closes += 1;
    await this.closeGate;
    this.state = 'closed';
  }
}

class MockPlayback implements AudioPlayback {
  starts = 0;
  stops = 0;
  disconnects = 0;
  ended: (() => void) | null = null;
  volume = 1;
  position: SpatialAudioVec3 = [0, 0, -1];
  orientation: SpatialAudioVec3 = [0, 0, 1];
  start() { this.starts += 1; }
  stop() { this.stops += 1; this.ended?.(); }
  disconnect() { this.disconnects += 1; }
  onEnded(callback: (() => void) | null) { this.ended = callback; }
  setVolume(volume: number) { this.volume = volume; }
  setPosition(position: SpatialAudioVec3) { this.position = position; }
  setOrientation(orientation: SpatialAudioVec3) { this.orientation = orientation; }
}

function harness() {
  const contexts: MockContext[] = [];
  const decodes: {
    source: SpatialAudioSource;
    deferred: ReturnType<typeof deferred<Buffer>>;
  }[] = [];
  const playbacks: {
    node: MockPlayback;
    buffer: Buffer;
    options: PositionalAudioOptions;
    spatial: boolean;
  }[] = [];
  const engine = new SpatialAudioEngineCore(
    () => {
      const context = new MockContext();
      contexts.push(context);
      return context;
    },
    (_context, source) => {
      const pending = deferred<Buffer>();
      decodes.push({ source, deferred: pending });
      return pending.promise;
    },
    (_context, buffer, options, spatial) => {
      const node = new MockPlayback();
      node.volume = options.volume ?? 1;
      playbacks.push({ node, buffer, options, spatial });
      return node;
    },
  );
  return { engine, contexts, decodes, playbacks };
}

test('listener updates retain the latest pose without creating a context', async () => {
  const { engine, contexts, decodes } = harness();
  engine.setListenerTransform({ position: [1, 2, 3] });
  engine.setListenerTransform({ position: [4, 5, 6], forward: [1, 0, 0], up: [0, 0, 1] });
  assert.equal(contexts.length, 0);
  const preload = engine.preload('voice', 42);
  await flush();
  assert.equal(contexts.length, 1);
  assert.deepEqual(contexts[0]!.listener, {
    positionX: { value: 4 }, positionY: { value: 5 }, positionZ: { value: 6 },
    forwardX: { value: 1 }, forwardY: { value: 0 }, forwardZ: { value: 0 },
    upX: { value: 0 }, upY: { value: 0 }, upZ: { value: 1 },
  });
  assert.equal(contexts[0]!.state, 'suspended');
  assert.equal(decodes[0]!.source, 42);
  decodes[0]!.deferred.resolve({ duration: 1 });
  await preload;
  await engine.close();
});

test('same source identity shares an in-flight decode and changed source replaces it', async () => {
  const { engine, decodes, playbacks } = harness();
  const first = engine.preload('voice', 'one.mp3');
  assert.equal(engine.preload('voice', { uri: 'one.mp3' }), first);
  await flush();
  decodes[0]!.deferred.resolve({ duration: 1 });
  await first;
  const next = engine.playAmbient('voice', 'two.mp3');
  await flush();
  assert.equal(decodes.length, 2);
  decodes[1]!.deferred.resolve({ duration: 2 });
  await next;
  assert.equal(playbacks[0]!.buffer.duration, 2);
  await engine.close();
});

test('replacement wins even when old decode resolves last', async () => {
  const { engine, decodes, playbacks } = harness();
  let finishes = 0;
  const first = engine.playAmbient('voice', 'one.mp3', { onFinish: () => { finishes += 1; } });
  await flush();
  const second = engine.playAmbient('voice', 'two.mp3');
  await flush();
  decodes[1]!.deferred.resolve({ duration: 2 });
  await second;
  decodes[0]!.deferred.resolve({ duration: 1 });
  await first;
  assert.equal(playbacks.length, 1);
  assert.equal(playbacks[0]!.buffer.duration, 2);
  assert.equal(finishes, 0);
  await engine.close();
});

for (const cleanup of ['stop', 'unload', 'stopAll', 'close'] as const) {
  test(`${cleanup} prevents playback after decoding and never fires finish`, async () => {
    const { engine, decodes, playbacks } = harness();
    let finishes = 0;
    const pending = engine.playSpatial('voice', 'one.mp3', { onFinish: () => { finishes += 1; } });
    await flush();
    if (cleanup === 'stop' || cleanup === 'unload') engine[cleanup]('voice');
    else await engine[cleanup]();
    decodes[0]!.deferred.resolve({ duration: 1 });
    await pending;
    assert.equal(playbacks.length, 0);
    assert.equal(finishes, 0);
    await engine.close();
  });
}

for (const cleanup of ['unload', 'close'] as const) {
  test(`${cleanup} while preloading does not repopulate a stale cache`, async () => {
    const { engine, decodes } = harness();
    const first = engine.preload('voice', 'one.mp3');
    await flush();
    if (cleanup === 'unload') engine.unload('voice');
    else await engine.close();
    decodes[0]!.deferred.resolve({ duration: 1 });
    await first;
    const second = engine.preload('voice', 'one.mp3');
    await flush();
    assert.equal(decodes.length, 2);
    decodes[1]!.deferred.resolve({ duration: 2 });
    assert.equal((await second).duration, 2);
    await engine.close();
  });
}

test('immediate close cancels a queued preload without creating a context', async () => {
  const { engine, contexts } = harness();
  const preload = engine.preload('voice', 'one.mp3');
  const cancelled = assert.rejects(preload, /cancelled/);
  await engine.close();
  await cancelled;
  assert.equal(contexts.length, 0);
});

test('natural completion alone fires finish once and disconnects the graph', async () => {
  const { engine, decodes, playbacks, contexts } = harness();
  let finishes = 0;
  const pending = engine.playSpatial('voice', 'one.mp3', { onFinish: () => { finishes += 1; } });
  await flush();
  decodes[0]!.deferred.resolve({ duration: 1 });
  await pending;
  assert.equal(playbacks[0]!.spatial, true);
  const node = playbacks[0]!.node;
  const ended = node.ended!;
  ended();
  ended();
  engine.stop('voice');
  await flush();
  assert.equal(finishes, 1);
  assert.equal(node.disconnects, 1);
  assert.equal(node.stops, 0);
  assert.equal(node.ended, null);
  assert.equal(contexts[0]!.state, 'suspended');
  await engine.close();
});

test('stop and replacement detach callbacks and disconnect without natural completion', async () => {
  const { engine, decodes, playbacks } = harness();
  let finishes = 0;
  const first = engine.playAmbient('voice', 'one.mp3', { onFinish: () => { finishes += 1; } });
  await flush();
  decodes[0]!.deferred.resolve({ duration: 1 });
  await first;
  const old = playbacks[0]!.node;
  const oldEnded = old.ended!;
  await engine.playAmbient('voice', 'one.mp3', { onFinish: () => { finishes += 1; } });
  oldEnded();
  assert.equal(old.stops, 1);
  assert.equal(old.disconnects, 1);
  assert.equal(finishes, 0);
  engine.stop('voice');
  assert.equal(playbacks[1]!.node.stops, 1);
  assert.equal(playbacks[1]!.node.disconnects, 1);
  assert.equal(finishes, 0);
  await engine.close();
});

test('one context resumes for playback and suspends only when all sources finish', async () => {
  const { engine, decodes, playbacks, contexts } = harness();
  const first = engine.playAmbient('a', 'one.mp3');
  const second = engine.playAmbient('b', 'two.mp3');
  await flush();
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0]!.state, 'suspended');
  for (const decode of decodes) decode.deferred.resolve({ duration: 1 });
  await Promise.all([first, second]);
  assert.equal(contexts[0]!.state, 'running');
  assert.equal(contexts[0]!.resumes, 1);
  playbacks[0]!.node.ended?.();
  await flush();
  assert.equal(contexts[0]!.state, 'running');
  playbacks[1]!.node.ended?.();
  await flush();
  assert.equal(contexts[0]!.state, 'suspended');
  await engine.close();
});

test('cancellation during resume prevents starting and returns to idle', async () => {
  const { engine, contexts, decodes, playbacks } = harness();
  const gate = deferred<void>();
  const pending = engine.playAmbient('voice', 'one.mp3');
  await flush();
  contexts[0]!.resumeGate = gate.promise;
  decodes[0]!.deferred.resolve({ duration: 1 });
  await flush();
  engine.stop('voice');
  gate.resolve();
  await pending;
  await flush();
  assert.equal(playbacks.length, 0);
  assert.equal(contexts[0]!.state, 'suspended');
  await engine.close();
});

test('a new context waits until the previous one finishes closing', async () => {
  const { engine, contexts, decodes } = harness();
  const preload = engine.preload('voice', 'one.mp3');
  await flush();
  decodes[0]!.deferred.resolve({ duration: 1 });
  await preload;
  const gate = deferred<void>();
  contexts[0]!.closeGate = gate.promise;
  const closing = engine.close();
  const pending = engine.playAmbient('voice', 'one.mp3');
  await flush();
  assert.equal(contexts.length, 1);
  gate.resolve();
  await closing;
  await flush();
  assert.equal(contexts.length, 2);
  assert.equal(contexts[0]!.state, 'closed');
  decodes[1]!.deferred.resolve({ duration: 2 });
  await pending;
  await engine.close();
});

for (const closedBeforeRejection of [false, true]) {
  test(`close rejection recovers with the previous context ${closedBeforeRejection ? 'closed' : 'open'}`, async () => {
    const { engine, contexts, decodes, playbacks } = harness();
    let finishes = 0;
    const first = engine.playAmbient('voice', 'one.mp3', {
      onFinish: () => { finishes += 1; },
    });
    await flush();
    decodes[0]!.deferred.resolve({ duration: 1 });
    await first;
    const stale = engine.playAmbient('stale', 'stale.mp3');
    await flush();
    const previous = contexts[0]!;
    const gate = deferred<void>();
    const error = new Error('close failed');
    previous.closeGate = gate.promise;
    const closing = engine.close();
    const rejected = assert.rejects(closing, (actual) => {
      assert.equal(actual, error);
      return true;
    });
    const repeatedRejected = assert.rejects(engine.close(), (actual) => {
      assert.equal(actual, error);
      return true;
    });
    const queued = engine.playAmbient('queued', 'queued.mp3');
    const stopped = engine.playAmbient('stopped', 'stopped.mp3');
    engine.stop('stopped');
    const preload = engine.preload('preload', 'preload.mp3');
    const recovered = Promise.all([queued, stopped, preload]).then(
      () => true,
      (failure: Error) => failure,
    );
    engine.setListenerTransform({ position: [9, 8, 7] });
    await flush();
    assert.equal(contexts.length, 1);
    assert.equal(decodes.length, 2);
    assert.equal(previous.closes, 1);
    assert.equal(playbacks[0]!.node.stops, 1);
    assert.equal(playbacks[0]!.node.disconnects, 1);
    if (closedBeforeRejection) previous.state = 'closed';
    gate.reject(error);
    await Promise.all([rejected, repeatedRejected]);
    await flush();
    assert.equal(contexts.length, closedBeforeRejection ? 2 : 1);
    assert.equal(decodes.length, 4);
    const current = contexts.at(-1)!;
    assert.equal(current.state, 'suspended');
    assert.equal(current.listener.positionX.value, 9);
    decodes[1]!.deferred.resolve({ duration: 1 });
    await stale;
    for (const decode of decodes.slice(2)) decode.deferred.resolve({ duration: 2 });
    assert.equal(await recovered, true);
    assert.equal(playbacks.length, 2);
    assert.equal(finishes, 0);
    const later = engine.playAmbient('later', 'later.mp3');
    await flush();
    assert.equal(decodes.length, 5);
    decodes[4]!.deferred.resolve({ duration: 3 });
    await later;
    assert.equal(contexts.length, closedBeforeRejection ? 2 : 1);
    previous.closeGate = Promise.resolve();
    await engine.close();
    assert.equal(current.state, 'closed');
    assert.equal(previous.closes, closedBeforeRejection ? 1 : 2);
    assert.equal(finishes, 0);
  });
}

test('cancelPending cancels decoding but leaves a started cue playing', async () => {
  const { engine, decodes, playbacks } = harness();
  const pending = engine.playAmbient('voice', 'one.mp3');
  await flush();
  engine.cancelPending('voice');
  decodes[0]!.deferred.resolve({ duration: 1 });
  await pending;
  assert.equal(playbacks.length, 0);
  await engine.playAmbient('voice', 'one.mp3');
  engine.cancelPending('voice');
  assert.equal(playbacks[0]!.node.stops, 0);
  engine.unload('voice');
  assert.equal(playbacks[0]!.node.stops, 1);
  await engine.close();
});

test('decode errors reject without finish and permit a retry', async () => {
  const { engine, decodes, contexts } = harness();
  let finishes = 0;
  const pending = engine.playAmbient('voice', 'one.mp3', { onFinish: () => { finishes += 1; } });
  const rejected = assert.rejects(pending, /bad audio/);
  await flush();
  decodes[0]!.deferred.reject(new Error('bad audio'));
  await rejected;
  await flush();
  assert.equal(finishes, 0);
  assert.equal(contexts[0]!.state, 'suspended');
  const retry = engine.playAmbient('voice', 'one.mp3');
  await flush();
  assert.equal(decodes.length, 2);
  decodes[1]!.deferred.resolve({ duration: 1 });
  await retry;
  await engine.close();
});

test('volume updates affect decoding requests and active sources without replay', async () => {
  const { engine, decodes, playbacks } = harness();
  const pending = engine.playSpatial('voice', 'one.mp3', { volume: 0.94, loop: true });
  await flush();
  engine.setVolume('voice', 0.5);
  decodes[0]!.deferred.resolve({ duration: 1 });
  await pending;
  const playback = playbacks[0]!;
  assert.equal(playback.node.volume, 0.5);
  engine.setVolume('voice', 0.25);
  engine.setSourcePosition('voice', [1, 2, 3]);
  engine.setSourceOrientation('voice', [1, 0, 0]);
  assert.equal(playback.node.volume, 0.25);
  assert.deepEqual(playback.node.position, [1, 2, 3]);
  assert.deepEqual(playback.node.orientation, [1, 0, 0]);
  assert.equal(playback.node.starts, 1);
  playback.node.ended?.();
  assert.equal(playback.node.disconnects, 0);
  await engine.close();
  assert.equal(playback.node.disconnects, 1);
});

test('outcome API distinguishes a successful start from cancellation while preserving legacy keys', async () => {
  const { engine, decodes, playbacks } = harness();
  const cancelled = engine.playAmbientWithOutcome('voice', 'one.mp3');
  await flush();
  engine.cancelPending('voice');
  decodes[0]!.deferred.resolve({ duration: 1 });
  assert.equal(await cancelled, 'cancelled');
  assert.equal(playbacks.length, 0);
  assert.equal(await engine.playAmbientWithOutcome('voice', 'one.mp3'), 'played');
  assert.equal(playbacks[0]!.node.starts, 1);
  assert.equal(await engine.playAmbient('voice', 'one.mp3'), 'voice');
  assert.equal(await engine.playSpatial('voice', 'one.mp3'), 'voice');
  await engine.close();
});

for (const cancelStage of ['queued', 'decode', 'resume'] as const) {
  test(`outcome API reports cancellation during ${cancelStage}`, async () => {
    const { engine, contexts, decodes, playbacks } = harness();
    const pending = engine.playAmbientWithOutcome('voice', 'one.mp3');
    const resume = deferred<void>();
    if (cancelStage !== 'queued') {
      await flush();
      if (cancelStage === 'resume') {
        contexts[0]!.resumeGate = resume.promise;
        decodes[0]!.deferred.resolve({ duration: 1 });
        await flush();
      }
    }
    engine.unload('voice');
    if (cancelStage === 'decode') decodes[0]!.deferred.resolve({ duration: 1 });
    resume.resolve();
    assert.equal(await pending, 'cancelled');
    assert.equal(playbacks.length, 0);
    await engine.close();
  });
}

test('outcome API suppresses a stale failure without interrupting a newer owner request', async () => {
  const { engine, decodes, playbacks } = harness();
  const old = engine.playAmbientWithOutcome('voice', 'one.mp3');
  await flush();
  const next = engine.playAmbientWithOutcome('voice', 'two.mp3');
  await flush();
  decodes[1]!.deferred.resolve({ duration: 2 });
  assert.equal(await next, 'played');
  decodes[0]!.deferred.reject(new Error('old load failed'));
  assert.equal(await old, 'cancelled');
  assert.equal(playbacks[0]!.node.stops, 0);
  await engine.close();
});

for (const failingStep of ['onEnded', 'stop', 'disconnect'] as const) {
  test(`cleanup still releases other resources when ${failingStep} throws`, async (t) => {
    const { engine, decodes, playbacks, contexts } = harness();
    const warnings: unknown[][] = [];
    t.mock.method(console, 'warn', (...args: unknown[]) => { warnings.push(args); });
    const pending = engine.playAmbient('voice', 'one.mp3');
    await flush();
    decodes[0]!.deferred.resolve({ duration: 1 });
    await pending;
    const node = playbacks[0]!.node;
    const calls: string[] = [];
    for (const method of ['onEnded', 'stop', 'disconnect'] as const) {
      t.mock.method(node, method, () => {
        calls.push(method);
        if (method === failingStep) throw new Error('private native error');
      });
    }
    engine.unload('voice');
    await flush();
    assert.deepEqual(calls, ['onEnded', 'stop', 'disconnect']);
    assert.deepEqual(warnings, [['Spatial audio resources could not disconnect cleanly.']]);
    assert.equal(contexts[0]!.state, 'suspended');
    await engine.close();
    assert.equal(contexts[0]!.state, 'closed');
  });
}
