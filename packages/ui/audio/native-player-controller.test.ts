import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createNativePlayerController,
  initialNativePlayerState,
  type NativePlayerState,
} from './native-player-controller.ts';
import { summarise } from './waveform.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolve_, reject_) => {
    resolve = resolve_;
    reject = reject_;
  });
  return { promise, resolve, reject };
}

function decoded(duration = 10) {
  let channelReads = 0;
  const samples = new Float32Array([0.2, 0.1, 0.8, 0.5]);
  return {
    duration,
    getChannelData(channel: number) {
      assert.equal(channel, 0);
      channelReads += 1;
      return samples;
    },
    samples,
    get channelReads() { return channelReads; },
  };
}
type Buffer = ReturnType<typeof decoded>;

interface Options {
  decode?(uri: string): Promise<Buffer>;
  failAt?: string;
  synchronousEnd?: boolean;
}

/**
 * Native boundary fake, following react-native-audio-api's pinned contract:
 * sources start once, stop requires a start, ended may already be queued, and
 * a closed context cannot be reused. No native audio/device is exercised here.
 */
function harness(options: Options = {}) {
  const state = initialNativePlayerState();
  const changes: Partial<NativePlayerState>[] = [];
  const calls: string[] = [];
  const timers = new Set<() => void>();
  const contexts: Context[] = [];
  const sources: Source[] = [];
  const queuedEnds: (() => void)[] = [];
  const buffer = decoded();
  const step = (name: string) => {
    calls.push(name);
    if (options.failAt === name) throw new Error(`Native ${name} failed`);
  };

  class Context {
    currentTime = 0;
    closed = false;
    async close() {
      assert.equal(this.closed, false, 'closed contexts cannot close twice');
      this.closed = true;
      step('close');
    }
  }

  class Source {
    private value: Buffer | null = null;
    private ended: (() => void) | undefined;
    started = false;
    stopped = false;
    disconnected = false;
    startOffset: number | null = null;
    readonly context: Context;
    constructor(context: Context) { this.context = context; }
    get buffer() { return this.value; }
    set buffer(value: Buffer | null) {
      step('buffer');
      this.value = value;
    }
    get onended(): (() => void) | undefined { return this.ended; }
    set onended(callback: (() => void) | null) {
      step(callback === null ? 'unlisten' : 'listen');
      this.ended = callback ?? undefined;
    }
    start(when: number, offset: number) {
      assert.equal(this.context.closed, false);
      assert.equal(this.started, false, 'buffer sources are one-shot');
      assert.equal(when, 0);
      assert.ok(Number.isFinite(offset) && offset >= 0);
      this.started = true;
      this.startOffset = offset;
      step('start');
      if (options.synchronousEnd) this.end();
    }
    stop() {
      assert.equal(this.started, true, 'stop requires a started source');
      this.stopped = true;
      step('stop');
      this.end();
    }
    disconnect() {
      this.disconnected = true;
      step('disconnect');
    }
    end() { this.ended?.(); }
    queueEnd() { if (this.ended !== undefined) queuedEnds.push(this.ended); }
  }

  const dependencies = {
    decode: (uri: string) => {
      step(`decode:${uri}`);
      return options.decode?.(uri) ?? Promise.resolve(buffer);
    },
    createContext: () => {
      step('context');
      const context = new Context();
      contexts.push(context);
      return context;
    },
    createSource: (context: Context) => {
      assert.equal(context.closed, false);
      step('source');
      const source = new Source(context);
      sources.push(source);
      return source;
    },
    connect: (context: Context, source: Source) => {
      assert.equal(source.context, context);
      step('connect');
    },
    setOnEnded: (source: Source, callback: (() => void) | null) => {
      source.onended = callback;
    },
    onChange: (change: Partial<NativePlayerState>) => {
      changes.push(change);
      Object.assign(state, change);
    },
    every: (callback: () => void, milliseconds: number) => {
      assert.equal(milliseconds, 60);
      step('timer');
      timers.add(callback);
      return () => { timers.delete(callback); };
    },
  };
  return {
    controller: createNativePlayerController(dependencies),
    createController: () => createNativePlayerController(dependencies),
    state, changes, contexts, sources, timers, buffer, calls,
    count: (name: string) => calls.filter((call) => call === name).length,
    failAt: (name?: string) => { options.failAt = name; },
    tick() { for (const callback of [...timers]) callback(); },
    flushEnds() { for (const callback of queuedEnds.splice(0)) callback(); },
  };
}

describe('native player playback', () => {
  it('preserves captured recording levels and the supplied duration', async () => {
    const h = harness();
    const levels = [0.05, 0.8, 0.2];
    await h.controller.load('note', 9.5, levels);
    assert.deepEqual(h.state.bars, summarise(levels));
    assert.equal(h.state.total, 9.5);
    assert.equal(h.buffer.channelReads, 0);
  });

  for (const levels of [undefined, []]) {
    it('derives missing or empty waveform levels from decoded audio', async () => {
      const h = harness();
      await h.controller.load('note', undefined, levels);
      assert.deepEqual(h.state.bars, summarise(Array.from(h.buffer.samples)));
      assert.equal(h.state.total, 10);
      assert.equal(h.buffer.channelReads, 1);
    });
  }

  it('pauses at the native clock position and resumes from that exact offset', async () => {
    const h = harness();
    await h.controller.load('note');
    assert.equal(h.controller.play(), true);
    const first = h.sources[0]!;
    first.queueEnd();
    h.contexts[0]!.currentTime = 2.25;
    h.controller.pause();
    assert.equal(h.state.elapsed, 2.25, 'pause publishes even between ticks');
    assert.equal(h.state.playing, false);
    assert.equal(h.timers.size, 0);
    assert.equal(first.onended, undefined);
    assert.ok(first.stopped && first.disconnected);
    h.controller.play();
    assert.equal(h.sources[1]!.startOffset, 2.25);
    h.flushEnds();
    assert.equal(h.state.playing, true, 'old stop/ended cannot reset resumed audio');
    assert.equal(h.timers.size, 1);
    h.contexts[0]!.currentTime = 3.5;
    h.tick();
    assert.equal(h.state.elapsed, 3.5);
    await h.controller.dispose();
  });

  it('ignores repeated play/pause commands without duplicate sources or offset drift', async () => {
    const h = harness();
    await h.controller.load('note');
    h.controller.play();
    h.controller.play();
    assert.equal(h.sources.length, 1);
    assert.equal(h.timers.size, 1);
    h.contexts[0]!.currentTime = 2;
    h.controller.pause();
    h.contexts[0]!.currentTime = 7;
    h.controller.pause();
    h.controller.play();
    assert.equal(h.sources[1]!.startOffset, 2);
    assert.equal(h.count('stop'), 1);
    await h.controller.dispose();
  });

  it('seeks paused notes silently and replaces playing sources without stale callbacks', async () => {
    const h = harness();
    await h.controller.load('note');
    assert.equal(h.controller.seek(4), false);
    assert.equal(h.sources.length, 0);
    h.controller.play();
    assert.equal(h.sources[0]!.startOffset, 4);
    h.sources[0]!.queueEnd();
    const oldTick = [...h.timers][0]!;
    assert.equal(h.controller.seek(6), true);
    assert.equal(h.sources[1]!.startOffset, 6);
    h.contexts[0]!.currentTime = 0.5;
    h.flushEnds();
    oldTick();
    assert.equal(h.state.elapsed, 6);
    assert.equal(h.state.playing, true);
    assert.equal(h.timers.size, 1);
    h.tick();
    assert.equal(h.state.elapsed, 6.5);
    h.controller.pause();
    h.controller.seek(-1);
    assert.equal(h.state.elapsed, 0);
    h.controller.seek(99);
    assert.equal(h.state.elapsed, 10);
    h.controller.seek(Number.NaN);
    assert.equal(h.state.elapsed, 10);
    await h.controller.dispose();
  });

  it('natural completion detaches its subscription and lets the note replay from zero', async () => {
    const h = harness();
    await h.controller.load('note');
    h.controller.play();
    h.contexts[0]!.currentTime = 11;
    h.tick();
    assert.equal(h.state.elapsed, 10, 'timer cannot overrun the slider');
    h.sources[0]!.end();
    assert.equal(h.state.elapsed, 0);
    assert.equal(h.state.playing, false);
    assert.equal(h.sources[0]!.onended, undefined);
    assert.equal(h.sources[0]!.disconnected, true);
    assert.equal(h.count('stop'), 0);
    assert.equal(h.timers.size, 0);
    h.controller.play();
    assert.equal(h.sources[1]!.startOffset, 0);
    await h.controller.dispose();
  });

  it('does not resurrect playback or a timer if start immediately reaches the end', async () => {
    const h = harness({ synchronousEnd: true });
    await h.controller.load('note');
    h.controller.seek(10);
    h.controller.play();
    assert.equal(h.state.playing, false);
    assert.equal(h.timers.size, 0);
    await h.controller.dispose();
  });
});

describe('native player note replacement and disposal', () => {
  it('drops the old buffer/state while a replacement loads, then uses a fresh context', async () => {
    const replacement = deferred<Buffer>();
    const h = harness({ decode: (uri) => uri === 'old' ? Promise.resolve(decoded()) : replacement.promise });
    await h.controller.load('old');
    h.controller.play();
    h.contexts[0]!.currentTime = 3;
    h.tick();
    h.sources[0]!.queueEnd();
    const oldTick = [...h.timers][0]!;
    const loading = h.controller.load('new');
    assert.deepEqual(h.state, initialNativePlayerState());
    assert.equal(h.contexts[0]!.closed, true);
    assert.equal(h.sources[0]!.disconnected, true);
    assert.equal(h.controller.play(), false);
    assert.equal(h.controller.seek(4), false);
    replacement.resolve(decoded(20));
    await loading;
    h.controller.play();
    assert.equal(h.contexts.length, 2);
    assert.equal(h.sources[1]!.startOffset, 0);
    oldTick();
    h.flushEnds();
    assert.equal(h.state.playing, true);
    assert.equal(h.state.elapsed, 0);
    assert.equal(h.state.total, 20);
    await h.controller.dispose();
  });

  for (const staleOutcome of ['resolve', 'reject'] as const) {
    it(`ignores a stale decoder ${staleOutcome} after a newer note loads`, async () => {
      const old = deferred<Buffer>();
      const h = harness({ decode: (uri) => uri === 'old' ? old.promise : Promise.resolve(decoded(20)) });
      const loading = h.controller.load('old');
      await h.controller.load('new');
      const changes = h.changes.length;
      if (staleOutcome === 'resolve') old.resolve(decoded(5));
      else old.reject(new Error('Old decoding failed'));
      await loading;
      assert.equal(h.changes.length, changes);
      assert.equal(h.state.total, 20);
      assert.equal(h.state.error, null);
      await h.controller.dispose();
    });
  }

  it('clears a decoding error when a different note begins loading', async () => {
    const replacement = deferred<Buffer>();
    const h = harness({ decode: (uri) => uri === 'bad' ? Promise.reject(new Error('Bad file')) : replacement.promise });
    await h.controller.load('bad');
    assert.match(h.state.error ?? '', /could not be opened/);
    assert.equal(h.controller.play(), false);
    const loading = h.controller.load('good');
    assert.equal(h.state.error, null);
    replacement.resolve(decoded());
    await loading;
    assert.equal(h.controller.play(), true);
    await h.controller.dispose();
  });

  it('unmount releases once and suppresses queued end/timer callbacks and future controls', async () => {
    const h = harness();
    await h.controller.load('note');
    h.controller.play();
    h.sources[0]!.queueEnd();
    const queuedTick = [...h.timers][0]!;
    const changes = h.changes.length;
    await h.controller.dispose();
    await h.controller.dispose();
    h.flushEnds();
    queuedTick();
    h.controller.play();
    h.controller.pause();
    h.controller.seek(2);
    await h.controller.load('ignored');
    assert.equal(h.changes.length, changes);
    assert.equal(h.count('close'), 1);
    assert.equal(h.count('stop'), 1);
    assert.equal(h.count('disconnect'), 1);
    assert.equal(h.timers.size, 0);
    assert.equal(h.sources[0]!.onended, undefined);
  });

  for (const staleOutcome of ['resolve', 'reject'] as const) {
    it(`survives effect cleanup/recreation with an old decode ${staleOutcome}`, async () => {
      const old = deferred<Buffer>();
      const h = harness({ decode: (uri) => uri === 'old' ? old.promise : Promise.resolve(decoded(20)) });
      const loading = h.controller.load('old');
      await h.controller.dispose();
      const current = h.createController();
      await current.load('new');
      current.play();
      const changes = h.changes.length;
      if (staleOutcome === 'resolve') old.resolve(decoded());
      else old.reject(new Error('Disposed decode failed'));
      await loading;
      assert.equal(h.changes.length, changes);
      assert.equal(h.state.playing, true);
      assert.equal(h.state.total, 20);
      await current.dispose();
    });
  }
});

describe('native player native failures', () => {
  for (const failAt of ['context', 'source', 'buffer', 'connect', 'listen', 'start', 'timer']) {
    it(`contains a ${failAt} failure, releases partial resources, and allows retry`, async () => {
      const h = harness({ failAt });
      await h.controller.load('note');
      assert.equal(h.controller.play(), false);
      assert.equal(h.state.playing, false);
      assert.match(h.state.error ?? '', /could not be played/);
      assert.equal(h.timers.size, 0);
      assert.equal(h.count('close'), Number(failAt !== 'context'));
      assert.equal(h.count('disconnect'), Number(!['context', 'source'].includes(failAt)));
      assert.equal(h.count('stop'), Number(['start', 'timer'].includes(failAt)));
      h.failAt();
      assert.equal(h.controller.play(), true);
      assert.equal(h.state.error, null);
      await h.controller.dispose();
    });
  }

  for (const failAt of ['unlisten', 'stop', 'disconnect', 'close']) {
    it(`contains cleanup ${failAt} failure without skipping independent resource release`, async () => {
      const h = harness();
      await h.controller.load('note');
      h.controller.play();
      h.sources[0]!.queueEnd();
      h.failAt(failAt);
      const changes = h.changes.length;
      await assert.doesNotReject(h.controller.dispose());
      h.flushEnds();
      assert.equal(h.count('unlisten'), 1);
      assert.equal(h.count('stop'), 1);
      assert.equal(h.count('disconnect'), 1);
      assert.equal(h.count('close'), 1);
      assert.equal(h.timers.size, 0);
      assert.equal(h.changes.length, changes);
    });
  }
});
