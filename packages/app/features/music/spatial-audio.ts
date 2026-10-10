/** Portable spatial music engine contract.
 * The YouTube iframe is NEVER an input to this engine.
 * Implementation adapters must use licensed standalone audio and report actual capabilities.
 */
export type SpatialAudioCapabilities = {
  supported: boolean;
  panner: boolean;
  headTracking: boolean;
  hrtf: boolean;
  ambisonics: boolean;
  reason?: string;
};

export type Vector3 = Readonly<{ x: number; y: number; z: number }>;
export type ListenerPose = Readonly<{
  position: Vector3;
  forward: Vector3;
  up: Vector3;
}>;

export type SpatialTrack = Readonly<{
  url: string;
  title: string;
  /** URL of licensing provenance attached to this separately hosted recording. */
  licenseSourceUrl: string;
  format: 'mono' | 'stereo' | 'ambisonic';
}>;

export interface SpatialMusicEngine {
  getCapabilities(): SpatialAudioCapabilities;
  /** Must be called following an explicit user gesture. Never autoplay. */
  play(track: SpatialTrack): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  setSourcePosition(position: Vector3): void;
  setListenerPose(pose: ListenerPose): void;
  dispose(): Promise<void>;
}

/** No misleading spatial playback when the native module is unavailable. */
export const unavailableSpatialMusicEngine: SpatialMusicEngine = {
  getCapabilities: () => ({
    supported: false, panner: false, headTracking: false, hrtf: false, ambisonics: false,
    reason: 'Spatial music requires a compatible device and separately licensed audio.',
  }),
  play: async () => { throw new Error('Spatial music is not available on this device.'); },
  pause: async () => {},
  stop: async () => {},
  setSourcePosition: () => {},
  setListenerPose: () => {},
  dispose: async () => {},
};
