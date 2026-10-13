import type { AudioBuffer, AudioBufferSourceNode, AudioParam, PannerNode } from 'react-native-audio-api';
import { setVec3, type AudioPlayback } from './SpatialAudioEngineCore.ts';
import type { PositionalAudioOptions } from './types';

type Connectable<Node> = {
  connect(destination: Node): unknown;
  disconnect(): void;
};

type Source<Buffer> = Pick<AudioBufferSourceNode, 'loop' | 'start' | 'stop'> & {
  buffer: Buffer | null;
};

type Panner = {
  // The native pin supports equalpower only; DOM can also report HRTF. We
  // deliberately write only the common equalpower value below.
  panningModel: PannerNode['panningModel'] | globalThis.PannerNode['panningModel'];
} & Pick<PannerNode,
  | 'distanceModel' | 'refDistance' | 'maxDistance' | 'rolloffFactor'
  | 'coneInnerAngle' | 'coneOuterAngle' | 'coneOuterGain'
> & {
  [Key in 'positionX' | 'positionY' | 'positionZ' | 'orientationX' | 'orientationY' | 'orientationZ']:
    Pick<AudioParam, 'value'>;
};

type GraphContext<Node, BufferSource> = {
  readonly currentTime: number;
  readonly destination: Node;
  createBufferSource(): BufferSource;
  createGain(): Node & { readonly gain: Pick<AudioParam, 'value'> };
  createPanner(): Node & Panner;
};

/** Own one source's graph; session, cache and completion ownership stay in the engine core. */
export function createAudioPlayback<
  Buffer extends Pick<AudioBuffer, 'numberOfChannels'>,
  Node extends Connectable<Node>,
  BufferSource extends Node & Source<Buffer>,
>(
  context: GraphContext<Node, BufferSource>,
  buffer: Buffer,
  options: PositionalAudioOptions,
  spatial: boolean,
  // Native and DOM onended accessors have different event/read types. Bind the
  // callback at the platform edge so each assignment keeps its real SDK contract.
  setOnEnded: (source: BufferSource, callback: (() => void) | null) => void,
): AudioPlayback {
  if (spatial && buffer.numberOfChannels > 2) {
    throw new Error('Positional audio supports mono or stereo sources only.');
  }
  const source = context.createBufferSource();
  let gain: ReturnType<typeof context.createGain>;
  try {
    gain = context.createGain();
  } catch (error) {
    try { source.disconnect(); } catch { /* Preserve the construction error. */ }
    throw error;
  }
  let panner: ReturnType<typeof context.createPanner> | undefined;
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
      panner.panningModel = 'equalpower' satisfies PannerNode['panningModel'] & globalThis.PannerNode['panningModel'];
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
    onEnded: (callback) => { setOnEnded(source, callback); },
    setVolume: (volume) => { gain.gain.value = volume; },
    setPosition: (position) => {
      if (panner) setVec3(panner.positionX, panner.positionY, panner.positionZ, position);
    },
    setOrientation: (orientation) => {
      if (panner) setVec3(panner.orientationX, panner.orientationY, panner.orientationZ, orientation);
    },
  };
}
