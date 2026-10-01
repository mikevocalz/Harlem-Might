import type {
  AmbientAudioOptions,
  PositionalAudioOptions,
  SpatialAudioListenerTransform,
  SpatialAudioSource,
  SpatialAudioVec3,
} from './types';

type WebPlayback = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner?: PannerNode;
};

function sourceUri(source: SpatialAudioSource) {
  if (typeof source === 'string') return source;
  if (typeof source === 'number') {
    throw new Error(
      'Bundled React Native numeric audio sources are not available on web. Pass a public URL instead.',
    );
  }
  return source.uri;
}

function setParam(param: AudioParam, value: number) {
  param.setValueAtTime(value, 0);
}

function setVec3(
  x: AudioParam,
  y: AudioParam,
  z: AudioParam,
  value: SpatialAudioVec3,
) {
  setParam(x, value[0]);
  setParam(y, value[1]);
  setParam(z, value[2]);
}

export class SpatialAudioEngine {
  private context: AudioContext | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly active = new Map<string, WebPlayback>();

  private ensureContext() {
    if (typeof window === 'undefined') {
      throw new Error('Spatial audio is only available in the browser.');
    }
    this.context ??= new window.AudioContext();
    return this.context;
  }

  async preload(key: string, source: SpatialAudioSource) {
    if (this.buffers.has(key)) return this.buffers.get(key)!;

    const context = this.ensureContext();
    const uri = sourceUri(source);
    const buffer = await fetch(uri)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to load audio "${key}": ${response.status} ${response.statusText}`,
          );
        }
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data));

    this.buffers.set(key, buffer);
    return buffer;
  }

  async playAmbient(
    key: string,
    source: SpatialAudioSource,
    options: AmbientAudioOptions = {},
  ) {
    const context = this.ensureContext();
    if (context.state === 'suspended') await context.resume();
    const buffer = await this.preload(key, source);
    this.stop(key);

    const player = context.createBufferSource();
    const gain = context.createGain();
    player.buffer = buffer;
    player.loop = options.loop ?? false;
    gain.gain.value = options.volume ?? 1;
    player.connect(gain);
    gain.connect(context.destination);
    this.active.set(key, { source: player, gain });
    player.onended = () => {
      if (!player.loop) this.active.delete(key);
    };
    player.start();

    return key;
  }

  async playSpatial(
    key: string,
    source: SpatialAudioSource,
    options: PositionalAudioOptions = {},
  ) {
    const context = this.ensureContext();
    if (context.state === 'suspended') await context.resume();
    const buffer = await this.preload(key, source);
    this.stop(key);

    const player = context.createBufferSource();
    const gain = context.createGain();
    const panner = context.createPanner();

    player.buffer = buffer;
    player.loop = options.loop ?? false;
    gain.gain.value = options.volume ?? 1;
    panner.panningModel = 'equalpower';
    panner.distanceModel = options.distanceModel ?? 'inverse';
    panner.refDistance = options.refDistance ?? 1;
    panner.maxDistance = options.maxDistance ?? 10000;
    panner.rolloffFactor = options.rolloffFactor ?? 1;
    panner.coneInnerAngle = options.coneInnerAngle ?? 360;
    panner.coneOuterAngle = options.coneOuterAngle ?? 360;
    panner.coneOuterGain = options.coneOuterGain ?? 0;

    setVec3(
      panner.positionX,
      panner.positionY,
      panner.positionZ,
      options.position ?? [0, 0, -1],
    );
    setVec3(
      panner.orientationX,
      panner.orientationY,
      panner.orientationZ,
      options.orientation ?? [0, 0, 1],
    );

    player.connect(gain);
    gain.connect(panner);
    panner.connect(context.destination);
    this.active.set(key, { source: player, gain, panner });
    player.onended = () => {
      if (!player.loop) this.active.delete(key);
    };
    player.start();

    return key;
  }

  setListenerTransform(transform: SpatialAudioListenerTransform) {
    const listener = this.ensureContext().listener;
    setVec3(
      listener.positionX,
      listener.positionY,
      listener.positionZ,
      transform.position,
    );
    setVec3(
      listener.forwardX,
      listener.forwardY,
      listener.forwardZ,
      transform.forward ?? [0, 0, -1],
    );
    setVec3(
      listener.upX,
      listener.upY,
      listener.upZ,
      transform.up ?? [0, 1, 0],
    );
  }

  setSourcePosition(key: string, position: SpatialAudioVec3) {
    const panner = this.active.get(key)?.panner;
    if (!panner) return;
    setVec3(panner.positionX, panner.positionY, panner.positionZ, position);
  }

  setSourceOrientation(key: string, orientation: SpatialAudioVec3) {
    const panner = this.active.get(key)?.panner;
    if (!panner) return;
    setVec3(
      panner.orientationX,
      panner.orientationY,
      panner.orientationZ,
      orientation,
    );
  }

  setVolume(key: string, volume: number) {
    const gain = this.active.get(key)?.gain;
    if (!gain) return;
    gain.gain.value = Math.max(0, volume);
  }

  stop(key: string) {
    const playback = this.active.get(key);
    if (!playback) return;
    playback.source.onended = null;
    try {
      playback.source.stop();
    } catch {
      // Already ended.
    }
    this.active.delete(key);
  }

  stopAll() {
    for (const key of [...this.active.keys()]) this.stop(key);
  }

  unload(key: string) {
    this.stop(key);
    this.buffers.delete(key);
  }

  async close() {
    this.stopAll();
    this.buffers.clear();
    const context = this.context;
    this.context = null;
    if (context) await context.close();
  }
}

export const spatialAudio = new SpatialAudioEngine();
