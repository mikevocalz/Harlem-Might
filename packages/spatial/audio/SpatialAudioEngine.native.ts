import { AudioContext, type AudioBuffer, type AudioBufferSourceNode, type AudioNode } from 'react-native-audio-api';
import { SpatialAudioEngineCore } from './SpatialAudioEngineCore.ts';
import { createAudioPlayback } from './createAudioPlayback.ts';
import type { PositionalAudioOptions } from './types';

function createPlayback(
  context: AudioContext,
  buffer: AudioBuffer,
  options: PositionalAudioOptions,
  spatial: boolean,
) {
  return createAudioPlayback<AudioBuffer, AudioNode, AudioBufferSourceNode>(
    context, buffer, options, spatial,
    (source, callback) => { source.onended = callback; },
  );
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
