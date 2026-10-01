export type SpatialAudioVec3 = readonly [number, number, number];

export type SpatialAudioSource =
  | number
  | string
  | {
      uri: string;
    };

export type SpatialAudioDistanceModel =
  | 'linear'
  | 'inverse'
  | 'exponential';

export type AmbientAudioOptions = {
  loop?: boolean;
  volume?: number;
};

export type PositionalAudioOptions = AmbientAudioOptions & {
  position?: SpatialAudioVec3;
  orientation?: SpatialAudioVec3;
  distanceModel?: SpatialAudioDistanceModel;
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
  coneInnerAngle?: number;
  coneOuterAngle?: number;
  coneOuterGain?: number;
};

export type SpatialAudioListenerTransform = {
  position: SpatialAudioVec3;
  forward?: SpatialAudioVec3;
  up?: SpatialAudioVec3;
};
