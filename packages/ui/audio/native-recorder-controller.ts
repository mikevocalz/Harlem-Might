import { frameLevel, pushLevel } from './waveform.ts';
import type { VoiceRecording } from './VoiceRecorder.types.ts';

type RecorderResult = { status: 'success' } | { status: 'error' };
type StopResult =
  | { status: 'success'; paths: string[]; duration: number }
  | { status: 'error' };

interface RecorderResource {
  enableFileOutput(): void;
  start(): Promise<RecorderResult>;
  stop(): Promise<StopResult>;
  disconnect(): void;
}

interface ContextResource {
  close(): Promise<unknown>;
}

interface AnalyserResource {
  fftSize: number;
  frequencyBinCount: number;
  getByteTimeDomainData(buffer: Uint8Array): void;
}

export interface NativeRecorderState {
  phase: 'idle' | 'starting' | 'recording' | 'stopping' | 'review';
  seconds: number;
  levels: number[];
  error: string | null;
  take: VoiceRecording | null;
}

export function initialNativeRecorderState(): NativeRecorderState {
  return { phase: 'idle', seconds: 0, levels: [], error: null, take: null };
}

interface RecorderDependencies<
  Recorder extends RecorderResource,
  Context extends ContextResource,
  Analyser extends AnalyserResource,
> {
  ensurePermission(): Promise<boolean>;
  createRecorder(): Recorder;
  createContext(): Context;
  createAnalyser(context: Context): Analyser;
  connect(recorder: Recorder, context: Context, analyser: Analyser): void;
  onChange(state: Partial<NativeRecorderState>): void;
  maxSeconds(): number | undefined;
  /** Injected by tests; production uses real intervals, never synthetic levels. */
  every?(callback: () => void, milliseconds: number): () => void;
}

/**
 * One owner for each native take, including partially acquired resources.
 * No native imports: the platform component supplies the audio graph and this
 * lifecycle can be exercised without a device or microphone permission.
 */
export function createNativeRecorderController<
  Recorder extends RecorderResource,
  Context extends ContextResource,
  Analyser extends AnalyserResource,
>(dependencies: RecorderDependencies<Recorder, Context, Analyser>) {
  interface Session {
    phase: 'starting' | 'recording' | 'stopping';
    cancelled: boolean;
    recorder: Recorder | null;
    context: Context | null;
    timers: (() => void)[];
    samples: number[];
    levels: number[];
    seconds: number;
    acquisition: Promise<void>;
    completion: Promise<void> | null;
  }

  let active: Session | null = null;
  let disposed = false;
  const every = dependencies.every ?? ((callback, milliseconds) => {
    const timer = setInterval(callback, milliseconds);
    return () => clearInterval(timer);
  });
  const publish = (state: Partial<NativeRecorderState>) => {
    if (!disposed) dependencies.onChange(state);
  };
  const clearTimers = (session: Session) => {
    for (const clear of session.timers.splice(0)) clear();
  };

  async function release(session: Session) {
    // Detach ownership before native calls. Repeated stop/cancel/dispose share
    // completion and cannot stop or close the same resources a second time.
    const recorder = session.recorder;
    const context = session.context;
    session.recorder = null;
    session.context = null;
    let cleanupFailed = false;
    const stopped = (async () => {
      try {
        return recorder === null ? null : await recorder.stop();
      } catch {
        return null;
      }
    })();
    try {
      recorder?.disconnect();
    } catch {
      cleanupFailed = true;
    }
    // Closing the graph must not depend on stop resolving or succeeding.
    const closed = (async () => {
      try {
        await context?.close();
      } catch {
        cleanupFailed = true;
      }
    })();
    const [result] = await Promise.all([stopped, closed]);
    return { result, cleanupFailed };
  }

  function finish(session: Session, keep: boolean, error?: string): Promise<void> {
    if (session.completion !== null) return session.completion;
    session.phase = 'stopping';
    clearTimers(session);
    // The latch is installed before notifying subscribers or invoking native
    // cleanup. New starts stay blocked until both native operations settle.
    session.completion = Promise.resolve().then(async () => {
      const { result, cleanupFailed } = await release(session);
      if (active !== session) return;
      active = null;
      const path = result?.status === 'success' ? result.paths[0] : undefined;
      if (!session.cancelled && keep && path && result?.status === 'success') {
        publish({
          phase: 'review',
          take: { uri: path, duration: result.duration, levels: [...session.samples] },
          error: cleanupFailed ? 'The audio session could not close cleanly.' : null,
        });
      } else {
        publish({
          phase: 'idle',
          take: null,
          error: session.cancelled ? null : (error ?? 'Nothing was recorded. Please try again.'),
        });
      }
    });
    publish({ phase: 'stopping' });
    return session.completion;
  }

  async function acquire(session: Session) {
    try {
      if (session.cancelled) return;
      const granted = await dependencies.ensurePermission();
      if (session.cancelled) return;
      if (!granted) {
        await finish(session, false, 'Microphone access is needed to record a voice note.');
        return;
      }
      // Save each resource as soon as its constructor succeeds, before any
      // configuration or graph setup that may throw.
      const recorder = dependencies.createRecorder();
      session.recorder = recorder;
      recorder.enableFileOutput();
      const started = await recorder.start();
      if (session.cancelled) return;
      if (started.status === 'error') throw new Error('Native recorder could not start');
      const context = dependencies.createContext();
      session.context = context;
      const analyser = dependencies.createAnalyser(context);
      analyser.fftSize = 1024;
      dependencies.connect(recorder, context, analyser);
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      session.phase = 'recording';
      session.timers.push(every(() => {
        if (session.phase !== 'recording' || session.cancelled) return;
        try {
          analyser.getByteTimeDomainData(buffer);
          const level = frameLevel(buffer);
          session.samples.push(level);
          session.levels = pushLevel(session.levels, level);
          publish({ levels: session.levels });
        } catch {
          void finish(session, false, 'Recording stopped unexpectedly. Please try again.');
        }
      }, 50));
      session.timers.push(every(() => {
        if (session.phase !== 'recording' || session.cancelled) return;
        session.seconds += 1;
        publish({ seconds: session.seconds });
        const limit = dependencies.maxSeconds();
        if (limit !== undefined && session.seconds >= limit) void finish(session, true);
      }, 1000));
      publish({ phase: 'recording' });
    } catch {
      await finish(session, false, 'Could not start recording. Check the microphone permission.');
    } finally {
      // A cancelled native start can still resolve after the UI disappears.
      // Wait for that start before stopping, so it cannot resurrect the mic.
      if (session.cancelled) await finish(session, false);
    }
  }

  function start(): Promise<void> {
    if (disposed || active !== null) return active?.acquisition ?? Promise.resolve();
    const session: Session = {
      phase: 'starting', cancelled: false, recorder: null, context: null,
      timers: [], samples: [], levels: [], seconds: 0,
      acquisition: Promise.resolve(), completion: null,
    };
    active = session;
    // Defer acquisition one microtask so reentrant cancellation sees its latch.
    session.acquisition = Promise.resolve().then(() => acquire(session));
    publish({ ...initialNativeRecorderState(), phase: 'starting' });
    return session.acquisition;
  }

  function cancel(): Promise<void> {
    const session = active;
    if (session === null) return Promise.resolve();
    session.cancelled = true;
    clearTimers(session);
    publish({ phase: 'stopping', take: null });
    return session.phase === 'starting' ? session.acquisition : finish(session, false);
  }

  return {
    start,
    stop(): Promise<void> {
      const session = active;
      if (session === null) return Promise.resolve();
      // Stop during acquisition cancels it; there is no valid take to review.
      return session.phase === 'starting' ? cancel() : finish(session, true);
    },
    cancel,
    reset() {
      if (!disposed && active === null) publish(initialNativeRecorderState());
    },
    dispose(): Promise<void> {
      disposed = true;
      return cancel();
    },
  };
}
