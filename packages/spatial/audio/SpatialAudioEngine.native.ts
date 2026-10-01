import { Image } from 'react-native';
import {
  AudioContext,
  type AudioBuffer,
  type AudioBufferSourceNode,
  type GainNode,
  type PannerNode,
} from 'react-native-audio-api';
import type {
  AmbientAudioOptions,
  PositionalAudioOptions,
  SpatialAudioListenerTransform,
  SpatialAudioSource,
  SpatialAudioVec3,
} from './types';

type ActivePlayback = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner?: PannerNode;
};

function sourceUri(source: SpatialAudioSource) {
  if (typeof source === 'string') return source;
  if (typeof source === 'number') {
    return Image.resolveAssetSource(source)?.uri ?? null;
  }
  return source.uri;
}

function setVec3(
  x: { value: number },
  y: { value: number },
  z: { value: number },
  value: SpatialAudioVec3,
) {
  x.value = value[0];
  y.value = value[1];
  z.value = value[2];
}

/**
 * Shared native audio engine for the spatial starter.
 *
 * - Ambient lane: theme music / UI beds / non-positional audio.
 * - Spatial lane: 3D sources positioned with PannerNode relative to
 *   AudioContext.listener.
 *
 * The engine is stateful by design and lives outside React. No useState is
 * needed; game/XR stores can push listener/source transforms directly.
 */
export class SpatialAudioEngine {
  private context: AudioContext | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly active = new Map<string, ActivePlayback>();

  private ensureContext() {
    this.context ??= new AudioContext();
    return this.context;
  }

  async preload(key: string, source: SpatialAudioSource) {
    if (this.buffers.has(key)) return this.buffers.get(key)!;

    const uri = sourceUri(source);
    if (!uri) {
      throw new Error(`Unable to resolve audio source for "${key}".`);
    }

    const context = this.ensureContext();
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
    player.start(context.currentTime);

    return key;
  }

  async playSpatial(
    key: string,
    source: SpatialAudioSource,
    options: PositionalAudioOptions = {},
  ) {
    const context = this.ensureContext();
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
    player.start(context.currentTime);

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
