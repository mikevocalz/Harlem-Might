import { summarise } from './waveform.ts';

interface BufferResource {
  duration: number;
  getChannelData(channel: number): Float32Array;
}

interface ContextResource {
  currentTime: number;
  close(): Promise<unknown>;
}

interface SourceResource<Buffer> {
  buffer: Buffer | null;
  start(when: number, offset: number): void;
  stop(): void;
  disconnect(): void;
}

export interface NativePlayerState {
  playing: boolean;
  elapsed: number;
  total: number;
  bars: number[];
  error: string | null;
}

export function initialNativePlayerState(): NativePlayerState {
  return { playing: false, elapsed: 0, total: 0, bars: [], error: null };
}

interface PlayerDependencies<
  Buffer extends BufferResource,
  Context extends ContextResource,
  Source extends SourceResource<Buffer>,
> {
  decode(uri: string): Promise<Buffer>;
  createContext(): Context;
  createSource(context: Context): Source;
  connect(context: Context, source: Source): void;
  setOnEnded(source: Source, callback: (() => void) | null): void;
  onChange(state: Partial<NativePlayerState>): void;
  /** Tests drive the native clock and intervals independently. */
  every?(callback: () => void, milliseconds: number): () => void;
}

/** One owner for a decoded note, its context, and each one-shot playback. */
export function createNativePlayerController<
  Buffer extends BufferResource,
  Context extends ContextResource,
  Source extends SourceResource<Buffer>,
>(dependencies: PlayerDependencies<Buffer, Context, Source>) {
  interface Playback {
    node: Source;
    started: boolean;
    startedAt: number;
  }

  let disposed = false;
  let generation = 0;
  let buffer: Buffer | null = null;
  let context: Context | null = null;
  let active: Playback | null = null;
  let clearTicker: (() => void) | null = null;
  let offset = 0;
  let total = 0;
  const every = dependencies.every ?? ((callback, milliseconds) => {
    const timer = setInterval(callback, milliseconds);
    return () => clearInterval(timer);
  });
  const publish = (state: Partial<NativePlayerState>) => {
    if (!disposed) dependencies.onChange(state);
  };
  const position = () => active !== null && context !== null
    ? Math.min(total, offset + Math.max(0, context.currentTime - active.startedAt))
    : offset;

  function releaseSource(stop: boolean): boolean {
    const playback = active;
    // Detach before stop: native ended callbacks can already be queued.
    active = null;
    clearTicker?.();
    clearTicker = null;
    if (playback === null) return true;
    let released = true;
    try {
      dependencies.setOnEnded(playback.node, null);
    } catch {
      released = false;
    }
    try {
      if (stop && playback.started) playback.node.stop();
    } catch {
      released = false;
    }
    try {
      playback.node.disconnect();
    } catch {
      released = false;
    }
    return released;
  }

  async function releaseContext() {
    const previous = context;
    context = null;
    try {
      await previous?.close();
    } catch {
      // An abandoned graph must never reject into the next note or unmount.
      // Its sources have already been stopped and disconnected independently.
    }
  }

  async function load(uri: string, duration?: number, levels?: readonly number[]) {
    if (disposed) return;
    const currentGeneration = ++generation;
    releaseSource(true);
    void releaseContext();
    buffer = null;
    offset = 0;
    total = 0;
    publish(initialNativePlayerState());
    try {
      const decoded = await dependencies.decode(uri);
      if (disposed || generation !== currentGeneration) return;
      const bars = levels !== undefined && levels.length > 0
        ? summarise(levels)
        : summarise(Array.from(decoded.getChannelData(0)));
      buffer = decoded;
      total = duration ?? decoded.duration;
      publish({ total, bars });
    } catch {
      if (!disposed && generation === currentGeneration) {
        publish({ error: 'This recording could not be opened.' });
      }
    }
  }

  function play(): boolean {
    if (disposed || buffer === null || active !== null) return false;
    try {
      const audioContext = context ?? dependencies.createContext();
      context = audioContext;
      const node = dependencies.createSource(audioContext);
      const playback: Playback = { node, started: false, startedAt: audioContext.currentTime };
      active = playback;
      node.buffer = buffer;
      dependencies.connect(audioContext, node);
      dependencies.setOnEnded(node, () => {
        if (disposed || active !== playback) return;
        const released = releaseSource(false);
        offset = 0;
        publish({
          playing: false, elapsed: 0,
          error: released ? null : 'The audio session could not close cleanly.',
        });
      });
      // start() can fail after the native source has been scheduled.
      playback.startedAt = audioContext.currentTime;
      playback.started = true;
      node.start(0, offset);
      if (active !== playback) return false;
      clearTicker = every(() => {
        if (!disposed && active === playback) publish({ elapsed: position() });
      }, 60);
      publish({ playing: true, error: null });
      return true;
    } catch {
      releaseSource(true);
      void releaseContext();
      publish({ playing: false, error: 'This recording could not be played.' });
      return false;
    }
  }

  function pause() {
    if (disposed || active === null) return;
    offset = position();
    const released = releaseSource(true);
    publish({
      playing: false, elapsed: offset,
      error: released ? null : 'The audio session could not close cleanly.',
    });
  }

  function seek(seconds: number): boolean {
    if (disposed || buffer === null || !Number.isFinite(seconds)) return false;
    const wasPlaying = active !== null;
    const released = releaseSource(true);
    offset = Math.max(0, Math.min(seconds, total));
    publish({
      elapsed: offset, playing: false,
      error: released ? null : 'The audio session could not close cleanly.',
    });
    return wasPlaying && play();
  }

  return {
    load, play, pause, seek,
    dispose(): Promise<void> {
      disposed = true;
      generation += 1;
      buffer = null;
      releaseSource(true);
      return releaseContext();
    },
  };
}
