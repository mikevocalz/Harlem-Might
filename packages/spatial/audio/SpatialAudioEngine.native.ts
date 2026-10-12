import { AudioContext, type AudioBuffer, type PannerNode } from 'react-native-audio-api';
import { SpatialAudioEngineCore, setVec3 } from './SpatialAudioEngineCore.ts';
import type { AudioPlayback } from './SpatialAudioEngineCore.ts';
import type { PositionalAudioOptions } from './types';

function createPlayback(
  context: AudioContext,
  buffer: AudioBuffer,
  options: PositionalAudioOptions,
  spatial: boolean,
): AudioPlayback {
  if (spatial && buffer.numberOfChannels > 2) {
    throw new Error('Positional audio supports mono or stereo sources only.');
  }
  const source = context.createBufferSource();
  let gain: ReturnType<AudioContext['createGain']>;
  try {
    gain = context.createGain();
  } catch (error) {
    try { source.disconnect(); } catch { /* Preserve the construction error. */ }
    throw error;
  }
  let panner: PannerNode | undefined;
  const disconnect = () => {
    let failed = false;
    for (const node of [source, gain, panner]) {
      try { node?.disconnect(); } catch { failed = true; }
    }
    if (failed) throw new Error('Audio graph could not disconnect cleanly.');
  };
  try {
    source.buffer = buffer;
    source.loop = options.loop ?? false;
    gain.gain.value = options.volume ?? 1;
    source.connect(gain);
    if (spatial) {
      panner = context.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = options.distanceModel ?? 'inverse';
      panner.refDistance = options.refDistance ?? 1;
      panner.maxDistance = options.maxDistance ?? 10000;
      panner.rolloffFactor = options.rolloffFactor ?? 1;
      panner.coneInnerAngle = options.coneInnerAngle ?? 360;
      panner.coneOuterAngle = options.coneOuterAngle ?? 360;
      panner.coneOuterGain = options.coneOuterGain ?? 0;
      setVec3(panner.positionX, panner.positionY, panner.positionZ, options.position ?? [0, 0, -1]);
      setVec3(panner.orientationX, panner.orientationY, panner.orientationZ, options.orientation ?? [0, 0, 1]);
      gain.connect(panner);
      panner.connect(context.destination);
    } else {
      gain.connect(context.destination);
    }
  } catch (error) {
    try { disconnect(); } catch { /* Preserve the construction error. */ }
    throw error;
  }
  return {
    start: () => source.start(context.currentTime),
    stop: () => {
      try {
        source.stop();
      } catch {
        // Already ended.
      }
    },
    disconnect,
    onEnded: (callback) => { source.onended = callback; },
    setVolume: (volume) => { gain.gain.value = volume; },
    setPosition: (position) => {
      if (panner) setVec3(panner.positionX, panner.positionY, panner.positionZ, position);
    },
    setOrientation: (orientation) => {
      if (panner) setVec3(panner.orientationX, panner.orientationY, panner.orientationZ, orientation);
    },
  };
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
export class SpatialAudioEngine extends SpatialAudioEngineCore<AudioBuffer, AudioContext> {
  constructor() {
    super(
      () => new AudioContext(),
      (context, source) => context.decodeAudioData(typeof source === 'object' ? source.uri : source),
      createPlayback,
    );
  }
}

export const spatialAudio = new SpatialAudioEngine();
