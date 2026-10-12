import type { AudioContext, AudioListener, AudioParam } from 'react-native-audio-api';
import type {
  AmbientAudioOptions,
  PositionalAudioOptions,
  SpatialAudioListenerTransform,
  SpatialAudioSource,
  SpatialAudioVec3,
} from './types';

type Listener = {
  [Key in keyof Pick<AudioListener,
    | 'positionX' | 'positionY' | 'positionZ'
    | 'forwardX' | 'forwardY' | 'forwardZ'
    | 'upX' | 'upY' | 'upZ'
  >]: Pick<AudioParam, 'value'>;
};

export type AudioContextLifecycle = Pick<AudioContext, 'currentTime'> & {
  state: AudioContext['state'] | 'interrupted';
  listener: Listener;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
};

export type AudioPlayback = {
  start(): void;
  stop(): void;
  disconnect(): void;
  onEnded(callback: (() => void) | null): void;
  setVolume(volume: number): void;
  setPosition(position: SpatialAudioVec3): void;
  setOrientation(orientation: SpatialAudioVec3): void;
};

type Session<Context> = {
  context: Context;
  transition: Promise<void>;
};

type Request = {
  ready: boolean;
  volume: number;
};

export function setVec3(
  x: Pick<AudioParam, 'value'>,
  y: Pick<AudioParam, 'value'>,
  z: Pick<AudioParam, 'value'>,
  value: SpatialAudioVec3,
) {
  x.value = value[0];
  y.value = value[1];
  z.value = value[2];
}

export class SpatialAudioEngineCore<Buffer, Context extends AudioContextLifecycle> {
  private session: Session<Context> | null = null;
  private closing: Promise<void> = Promise.resolve();
  private closeRecovery: Promise<void> = Promise.resolve();
  private listenerTransform: SpatialAudioListenerTransform | null = null;
  private readonly buffers = new Map<string, {
    identity: string | number;
    promise: Promise<Buffer>;
  }>();
  private readonly pending = new Map<string, Request>();
  private readonly active = new Map<string, AudioPlayback>();
  private readonly createContext: () => Context;
  private readonly decode: (context: Context, source: SpatialAudioSource, key: string) => Promise<Buffer>;
  private readonly createPlayback: (
    context: Context,
    buffer: Buffer,
    options: PositionalAudioOptions,
    spatial: boolean,
  ) => AudioPlayback;

  constructor(
    createContext: () => Context,
    decode: (context: Context, source: SpatialAudioSource, key: string) => Promise<Buffer>,
    createPlayback: (
      context: Context,
      buffer: Buffer,
      options: PositionalAudioOptions,
      spatial: boolean,
    ) => AudioPlayback,
  ) {
    this.createContext = createContext;
    this.decode = decode;
    this.createPlayback = createPlayback;
  }

  private ensureSession() {
    if (!this.session) {
      this.session = { context: this.createContext(), transition: Promise.resolve() };
      if (this.listenerTransform) this.setListenerTransform(this.listenerTransform);
      this.suspendIdle();
    }
    return this.session;
  }

  private syncState(session: Session<Context>) {
    const transition = session.transition.then(async () => {
      if (this.session !== session || session.context.state === 'closed') return;
      const running = this.active.size > 0 || [...this.pending.values()].some((request) => request.ready);
      if (running && session.context.state !== 'running') await session.context.resume();
      if (!running && session.context.state === 'running') await session.context.suspend();
    });
    session.transition = transition.catch(() => {});
    return transition;
  }

  private suspendIdle() {
    if (!this.session) return;
    void this.syncState(this.session).catch((error) => {
      console.warn('Unable to suspend idle spatial audio.', error);
    });
  }

  private load(key: string, source: SpatialAudioSource) {
    const identity = typeof source === 'object' ? source.uri : source;
    const cached = this.buffers.get(key);
    if (cached?.identity === identity) return cached.promise;
    const entry = {
      identity,
      promise: Promise.resolve().then(async (): Promise<Buffer> => {
        await this.closeRecovery;
        if (this.buffers.get(key) !== entry) throw new Error('Audio load was cancelled.');
        return this.decode(this.ensureSession().context, source, key);
      }),
    };
    this.buffers.set(key, entry);
    void entry.promise.catch(() => {
      if (this.buffers.get(key) === entry) this.buffers.delete(key);
    });
    return entry.promise;
  }

  preload(key: string, source: SpatialAudioSource) {
    return this.load(key, source);
  }

  playAmbient(key: string, source: SpatialAudioSource, options: AmbientAudioOptions = {}) {
    return this.play(key, source, options, false);
  }

  playSpatial(key: string, source: SpatialAudioSource, options: PositionalAudioOptions = {}) {
    return this.play(key, source, options, true);
  }

  private async play(
    key: string,
    source: SpatialAudioSource,
    options: PositionalAudioOptions,
    spatial: boolean,
  ) {
    this.stop(key);
    const request: Request = { ready: false, volume: options.volume ?? 1 };
    this.pending.set(key, request);
    try {
      await this.closeRecovery;
      if (this.pending.get(key) !== request) return key;
      const session = this.ensureSession();
      const buffer = await this.load(key, source);
      if (this.pending.get(key) !== request || this.session !== session) return key;
      request.ready = true;
      await this.syncState(session);
      if (this.pending.get(key) !== request || this.session !== session) return key;
      const playback = this.createPlayback(session.context, buffer, {
        ...options, volume: request.volume,
      }, spatial);
      this.active.set(key, playback);
      playback.onEnded(() => {
        if (options.loop || this.active.get(key) !== playback) return;
        this.active.delete(key);
        playback.onEnded(null);
        playback.disconnect();
        this.suspendIdle();
        options.onFinish?.();
      });
      playback.start();
      this.pending.delete(key);
      return key;
    } catch (error) {
      if (this.pending.get(key) !== request) return key;
      this.stop(key);
      throw error;
    } finally {
      this.suspendIdle();
    }
  }

  setListenerTransform(transform: SpatialAudioListenerTransform) {
    this.listenerTransform = transform;
    const listener = this.session?.context.listener;
    if (!listener) return;
    setVec3(listener.positionX, listener.positionY, listener.positionZ, transform.position);
    setVec3(listener.forwardX, listener.forwardY, listener.forwardZ, transform.forward ?? [0, 0, -1]);
    setVec3(listener.upX, listener.upY, listener.upZ, transform.up ?? [0, 1, 0]);
  }

  setSourcePosition(key: string, position: SpatialAudioVec3) {
    this.active.get(key)?.setPosition(position);
  }

  setSourceOrientation(key: string, orientation: SpatialAudioVec3) {
    this.active.get(key)?.setOrientation(orientation);
  }

  setVolume(key: string, volume: number) {
    const request = this.pending.get(key);
    if (request) request.volume = Math.max(0, volume);
    this.active.get(key)?.setVolume(Math.max(0, volume));
  }

  cancelPending(key: string) {
    this.pending.delete(key);
    this.suspendIdle();
  }

  stop(key: string) {
    this.cancelPending(key);
    const playback = this.active.get(key);
    if (playback) {
      this.active.delete(key);
      playback.onEnded(null);
      playback.stop();
      playback.disconnect();
    }
    this.suspendIdle();
  }

  stopAll() {
    for (const key of new Set([...this.pending.keys(), ...this.active.keys()])) this.stop(key);
  }

  unload(key: string) {
    this.stop(key);
    this.buffers.delete(key);
  }

  close() {
    this.stopAll();
    this.buffers.clear();
    const session = this.session;
    this.session = null;
    if (!session) return this.closing;
    const closing = session.transition.then(() => session.context.close());
    this.closing = closing;
    this.closeRecovery = closing.catch(() => {
      if (session.context.state === 'closed') return;
      this.session = session;
      if (this.listenerTransform) this.setListenerTransform(this.listenerTransform);
      this.suspendIdle();
    });
    return closing;
  }
}
