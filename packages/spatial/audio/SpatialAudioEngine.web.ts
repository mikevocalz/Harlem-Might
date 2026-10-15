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

export class SpatialAudioEngine extends SpatialAudioEngineCore<AudioBuffer, AudioContext> {
  constructor() {
    super(
      () => {
        if (typeof window === 'undefined') {
          throw new Error('Spatial audio is only available in the browser.');
        }
        return new window.AudioContext();
      },
      async (context, source, key) => {
        if (typeof source === 'number') {
          throw new Error('Bundled React Native numeric audio sources are not available on web. Pass a public URL instead.');
        }
        const response = await fetch(typeof source === 'string' ? source : source.uri);
        if (!response.ok) {
          throw new Error(`Failed to load audio "${key}": ${response.status} ${response.statusText}`);
        }
        return context.decodeAudioData(await response.arrayBuffer());
      },
      createPlayback,
    );
  }
}

export const spatialAudio = new SpatialAudioEngine();
