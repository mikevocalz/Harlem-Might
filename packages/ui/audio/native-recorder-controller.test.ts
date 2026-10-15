import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createNativeRecorderController,
  initialNativeRecorderState,
  type NativeRecorderState,
} from './native-recorder-controller.ts';
import { frameLevel } from './waveform.ts';

type StartResult = { status: 'success' } | { status: 'error' };
type StopResult =
  | { status: 'success'; paths: string[]; duration: number }
  | { status: 'error' };
const success = { status: 'success' } as const;
const recorded = { status: 'success', paths: ['file:///take.m4a'], duration: 2.4 } as const;
const takeResult = (): StopResult => ({ ...recorded, paths: [...recorded.paths] });
const failed = () => { throw new Error('Native failure'); };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolve_, reject_) => {
    resolve = resolve_;
    reject = reject_;
  });
  return { promise, resolve, reject };
}

interface Options {
  failAt?: string;
  permission?: () => Promise<boolean>;
  start?: () => Promise<StartResult>;
  stop?: () => Promise<StopResult>;
  close?: () => Promise<unknown>;
  maxSeconds?: number;
}

function harness(options: Options = {}) {
  const calls: string[] = [];
  const state = initialNativeRecorderState();
  const changes: Partial<NativeRecorderState>[] = [];
  const timers = new Map<number, { callback: () => void; milliseconds: number }>();
  let timerId = 0;
  let sample = 128;
  const step = (name: string) => {
    calls.push(name);
    if (options.failAt === name) failed();
  };
  const controller = createNativeRecorderController({
    ensurePermission: () => {
      step('permission');
      return options.permission?.() ?? Promise.resolve(true);
    },
    createRecorder: () => {
      step('recorder');
      return {
        enableFileOutput() { step('file'); },
        start() { step('start'); return options.start?.() ?? Promise.resolve(success); },
        stop() { step('stop'); return options.stop?.() ?? Promise.resolve(takeResult()); },
        disconnect() { step('disconnect'); },
      };
    },
    createContext: () => {
      step('context');
      return { close() { step('close'); return options.close?.() ?? Promise.resolve(); } };
    },
    createAnalyser: () => {
      step('analyser');
      return {
        set fftSize(value: number) { step('fft'); assert.equal(value, 1024); },
        frequencyBinCount: 8,
        getByteTimeDomainData(buffer: Uint8Array) { step('sample'); buffer.fill(sample); },
      };
    },
    connect: () => { step('connect'); },
    maxSeconds: () => options.maxSeconds,
    onChange: (change) => {
      changes.push(change);
      Object.assign(state, change);
    },
    every: (callback, milliseconds) => {
      step(`timer-${milliseconds}`);
      const id = ++timerId;
      timers.set(id, { callback, milliseconds });
      return () => { timers.delete(id); };
    },
  });
  return {
    controller, calls, state, changes, timers,
    sample(value: number) { sample = value; },
    count(name: string) { return calls.filter((call) => call === name).length; },
    tick(milliseconds: number) {
      for (const timer of [...timers.values()]) {
        if (timer.milliseconds === milliseconds) timer.callback();
      }
    },
  };
}

// Advance only JS promise continuations, never native audio or real timers.
const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };

describe('native recorder acquisition', () => {
  for (const failAt of ['permission', 'recorder', 'file', 'start', 'context', 'analyser', 'fft', 'connect', 'timer-50', 'timer-1000']) {
    it(`contains a thrown ${failAt} failure and releases everything acquired`, async () => {
      const h = harness({ failAt });
      await assert.doesNotReject(h.controller.start());
      assert.equal(h.state.phase, 'idle');
      assert.match(h.state.error ?? '', /Could not start recording/);
      assert.equal(h.state.take, null);
      assert.equal(h.timers.size, 0);
      const createdRecorder = !['permission', 'recorder'].includes(failAt);
      const createdContext = ['analyser', 'fft', 'connect', 'timer-50', 'timer-1000'].includes(failAt);
      assert.equal(h.count('stop'), Number(createdRecorder));
      assert.equal(h.count('disconnect'), Number(createdRecorder));
      assert.equal(h.count('close'), Number(createdContext));
    });
  }

  it('denied permission does not construct a recorder', async () => {
    const h = harness({ permission: async () => false });
    await h.controller.start();
    assert.deepEqual(h.calls, ['permission']);
    assert.match(h.state.error ?? '', /Microphone access is needed/);
  });

  it('contains a rejected permission request', async () => {
    const h = harness({ permission: async () => failed() });
    await assert.doesNotReject(h.controller.start());
    assert.equal(h.state.phase, 'idle');
    assert.equal(h.count('recorder'), 0);
  });

  for (const start of [async () => failed(), async () => ({ status: 'error' } as const)]) {
    it('releases a recorder whose start rejects or returns an error', async () => {
      const h = harness({ start });
      await assert.doesNotReject(h.controller.start());
      assert.equal(h.count('stop'), 1);
      assert.equal(h.count('disconnect'), 1);
      assert.equal(h.count('context'), 0);
      assert.equal(h.state.phase, 'idle');
    });
  }
});

describe('native recorder cancellation and repeated controls', () => {
  it('cancelling immediately prevents even a permission request', async () => {
    const h = harness();
    const starting = h.controller.start();
    const cancelling = h.controller.cancel();
    await Promise.all([starting, cancelling]);
    assert.deepEqual(h.calls, []);
    assert.equal(h.state.phase, 'idle');
  });

  for (const action of ['cancel', 'dispose', 'stop'] as const) {
    it(`${action} while permission is pending prevents later acquisition`, async () => {
      const permission = deferred<boolean>();
      const h = harness({ permission: () => permission.promise });
      const starting = h.controller.start();
      await flush();
      const finishing = h.controller[action]();
      const changes = h.changes.length;
      permission.resolve(true);
      await Promise.all([starting, finishing]);
      assert.equal(h.count('recorder'), 0);
      assert.equal(h.state.take, null);
      if (action === 'dispose') assert.equal(h.changes.length, changes);
      else assert.equal(h.state.phase, 'idle');
    });

    it(`${action} while native start is pending stops the late acquisition once`, async () => {
      const start = deferred<StartResult>();
      const h = harness({ start: () => start.promise });
      const starting = h.controller.start();
      await flush();
      assert.equal(h.count('start'), 1);
      const finishing = h.controller[action]();
      assert.equal(h.count('stop'), 0, 'stopping before start settles can resurrect the microphone');
      const changes = h.changes.length;
      start.resolve(success);
      await Promise.all([starting, finishing]);
      assert.equal(h.count('stop'), 1);
      assert.equal(h.count('disconnect'), 1);
      assert.equal(h.count('context'), 0);
      assert.equal(h.timers.size, 0);
      assert.equal(h.state.take, null);
      if (action === 'dispose') assert.equal(h.changes.length, changes);
    });
  }

  it('contains late acquisition and cleanup rejections after unmount', async () => {
    const start = deferred<StartResult>();
    const h = harness({ start: () => start.promise, stop: async () => failed() });
    const starting = h.controller.start();
    await flush();
    const disposed = h.controller.dispose();
    const changes = h.changes.length;
    start.reject(new Error('start rejected after unmount'));
    await assert.doesNotReject(Promise.all([starting, disposed]));
    assert.equal(h.count('stop'), 1);
    assert.equal(h.count('disconnect'), 1);
    assert.equal(h.changes.length, changes);
    await h.controller.start();
    assert.equal(h.count('recorder'), 1, 'disposed controllers cannot acquire another microphone');
  });

  it('latches rapid starts and repeated stop/cancel/dispose calls', async () => {
    const stop = deferred<StopResult>();
    const close = deferred<void>();
    const h = harness({ stop: () => stop.promise, close: () => close.promise });
    await Promise.all([h.controller.start(), h.controller.start(), h.controller.start()]);
    assert.equal(h.count('recorder'), 1);
    const stopping = h.controller.stop();
    const again = h.controller.stop();
    const cancelling = h.controller.cancel();
    const disposed = h.controller.dispose();
    await h.controller.start();
    await flush();
    assert.equal(h.count('recorder'), 1);
    assert.equal(h.count('stop'), 1);
    assert.equal(h.count('disconnect'), 1);
    assert.equal(h.count('close'), 1);
    assert.equal(h.timers.size, 0);
    stop.resolve(takeResult());
    close.resolve();
    await Promise.all([stopping, again, cancelling, disposed]);
    assert.equal(h.state.take, null, 'cancelled pending stop must never publish a take');
  });

  it('blocks a new start until context cleanup settles, then records a fresh take', async () => {
    const close = deferred<void>();
    const h = harness({ close: () => close.promise });
    await h.controller.start();
    h.sample(150);
    h.tick(50);
    const stopping = h.controller.stop();
    await flush();
    await h.controller.start();
    assert.equal(h.count('recorder'), 1);
    close.resolve();
    await stopping;
    h.controller.reset();
    assert.deepEqual(h.state, initialNativeRecorderState());
    await h.controller.start();
    h.sample(128);
    h.tick(50);
    await h.controller.stop();
    assert.equal(h.count('recorder'), 2);
    assert.deepEqual(h.state.take?.levels, [0], 'previous take samples must not leak into a new recording');
  });
});

describe('native recorder finish and review', () => {
  it('keeps a successful take for review with its measured waveform and native duration', async () => {
    const h = harness();
    await h.controller.start();
    assert.equal(h.state.phase, 'recording');
    h.tick(50);
    h.sample(144);
    h.tick(50);
    h.tick(1000);
    assert.equal(h.state.seconds, 1);
    const levels = [0, frameLevel(new Uint8Array(8).fill(144))];
    assert.deepEqual(h.state.levels, levels);
    await h.controller.stop();
    assert.equal(h.state.phase, 'review');
    assert.deepEqual(h.state.take, { uri: recorded.paths[0], duration: recorded.duration, levels });
    assert.equal(h.timers.size, 0);
    await h.controller.stop();
    assert.equal(h.count('stop'), 1);
    assert.equal(h.count('close'), 1);
  });

  it('auto-stops exactly once at the latest maxSeconds limit', async () => {
    const options = { maxSeconds: 3 };
    const h = harness(options);
    await h.controller.start();
    h.tick(1000);
    assert.equal(h.count('stop'), 0);
    options.maxSeconds = 2;
    h.tick(1000);
    h.tick(1000);
    await h.controller.stop();
    assert.equal(h.state.seconds, 2);
    assert.equal(h.state.phase, 'review');
    assert.equal(h.count('stop'), 1);
    assert.equal(h.timers.size, 0);
  });

  for (const stop of [() => failed(), async () => failed(), async () => ({ status: 'error' } as const), async () => ({ ...takeResult(), status: 'success' as const, paths: [], duration: 0 })]) {
    it('cleans up after thrown, rejected, failed, or empty native stops', async () => {
      const h = harness({ stop });
      await h.controller.start();
      await assert.doesNotReject(h.controller.stop());
      assert.equal(h.count('disconnect'), 1);
      assert.equal(h.count('close'), 1);
      assert.equal(h.state.phase, 'idle');
      assert.equal(h.state.take, null);
      assert.match(h.state.error ?? '', /Nothing was recorded/);
      assert.equal(h.timers.size, 0);
    });
  }

  it('closes the graph without waiting for a rejected stop', async () => {
    const stop = deferred<StopResult>();
    const h = harness({ stop: () => stop.promise, close: async () => failed() });
    await h.controller.start();
    const stopping = h.controller.stop();
    await flush();
    assert.equal(h.count('close'), 1);
    assert.equal(h.timers.size, 0);
    stop.reject(new Error('stop failed'));
    await assert.doesNotReject(stopping);
    assert.equal(h.state.phase, 'idle');
  });

  for (const failAt of ['disconnect', 'close']) {
    it(`contains a thrown ${failAt} error without losing a valid take`, async () => {
      const h = harness({ failAt });
      await h.controller.start();
      await assert.doesNotReject(h.controller.stop());
      assert.equal(h.count('close'), 1);
      assert.equal(h.state.phase, 'review');
      assert.ok(h.state.take);
      assert.match(h.state.error ?? '', /could not close cleanly/);
    });
  }

  it('contains a rejected close when discarding a recording', async () => {
    const h = harness({ close: async () => failed() });
    await h.controller.start();
    await assert.doesNotReject(h.controller.cancel());
    assert.equal(h.state.phase, 'idle');
    assert.equal(h.state.take, null);
    assert.equal(h.timers.size, 0);
  });

  it('unmounting an active take closes all resources without late UI updates', async () => {
    const h = harness({ close: async () => failed(), stop: async () => failed() });
    await h.controller.start();
    const changes = h.changes.length;
    await assert.doesNotReject(h.controller.dispose());
    h.tick(50);
    h.tick(1000);
    assert.equal(h.count('stop'), 1);
    assert.equal(h.count('disconnect'), 1);
    assert.equal(h.count('close'), 1);
    assert.equal(h.changes.length, changes);
    assert.equal(h.timers.size, 0);
  });

  it('stops and reports a failed waveform read instead of leaving a hot microphone', async () => {
    const h = harness({ failAt: 'sample' });
    await h.controller.start();
    h.tick(50);
    await h.controller.stop();
    assert.equal(h.state.phase, 'idle');
    assert.match(h.state.error ?? '', /Recording stopped unexpectedly/);
    assert.equal(h.count('stop'), 1);
    assert.equal(h.count('close'), 1);
    assert.equal(h.timers.size, 0);
  });
});
