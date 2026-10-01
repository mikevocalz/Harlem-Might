import * as ViroRuntime from '@reactvision/react-viro';

export {
  Viro3DObject,
  Viro3DSceneNavigator,
  ViroAnimations,
  ViroARScene,
  ViroARPlaneSelector,
  ViroSharedFrame,
  ViroAmbientLight,
  ViroBox,
  ViroController,
  ViroDirectionalLight,
  ViroGameLoop,
  ViroMaterials,
  ViroNode,
  ViroPolyline,
  ViroQuad,
  ViroScene,
  ViroSound,
  ViroText,
  ViroVirtualButton,
  ViroVirtualJoystick,
  invertTransform,
  parseLocationTransform,
  poseCsv,
  transformDirection,
  worldToLocation,
  ViroXRSceneNavigator,
  useViroColocation,
  useViroColocationRoom,
  useViroReplicatedState,
  metaSpatialAnchorFrameSource,
  cloudAnchorFrameSource,
  visionOSSharedSpaceFrameSource,
  normaliseJoinCode,
  formatJoinCode,
  isQuest,
} from '@reactvision/react-viro';

export type ViroOpenXRRuntimeCapabilities = {
  eyeGazeExtensionAvailable: boolean;
  eyeGazeSupported: boolean;
  handTrackingAvailable: boolean;
  handAimAvailable: boolean;
  passthroughAvailable: boolean;
  planeDetectionAvailable: boolean;
  sceneUnderstandingAvailable: boolean;
  foveationAvailable: boolean;
  eyeTrackedFoveationAvailable: boolean;
  localFloorAvailable: boolean;
};

type ForkHapticOptions = {
  hand?: 'left' | 'right' | 'both' | 'active';
  amplitude?: number;
  durationSec?: number;
};

type ForkViroRuntime = typeof ViroRuntime & {
  isPico?: boolean;
  isMetaHorizonXR?: boolean;
  isKnownQuest?: boolean;
  metaHorizonFormFactor?: 'quest' | 'unknown' | null;
  isVisionOS?: boolean | (() => boolean);
  useVRViewTag?: () => number | null;
  triggerHaptic?: (viewTag: number, options?: ForkHapticOptions) => void;
  getOpenXRRuntimeCapabilities?: (
    viewTag: number,
  ) => Promise<ViroOpenXRRuntimeCapabilities | null>;
};

const forkRuntime = ViroRuntime as ForkViroRuntime;

export const isPico = Boolean(forkRuntime.isPico);
export const isMetaHorizonXR = Boolean(
  forkRuntime.isMetaHorizonXR ?? forkRuntime.isQuest,
);
export const isKnownQuest = Boolean(
  forkRuntime.isKnownQuest ?? forkRuntime.isQuest,
);
export const metaHorizonFormFactor =
  forkRuntime.metaHorizonFormFactor ??
  (forkRuntime.isQuest ? ('quest' as const) : null);

const visionRuntimeValue = forkRuntime.isVisionOS;

export const isVisionOS =
  typeof visionRuntimeValue === 'function'
    ? Boolean(visionRuntimeValue())
    : Boolean(visionRuntimeValue);

const useForkViewTag = forkRuntime.useVRViewTag ?? (() => null);

export function useViroVRViewTag() {
  return useForkViewTag();
}

export async function getOpenXRRuntimeCapabilities(
  viewTag: number | null,
): Promise<ViroOpenXRRuntimeCapabilities | null> {
  if (viewTag == null) return null;
  return forkRuntime.getOpenXRRuntimeCapabilities?.(viewTag) ?? null;
}

export function triggerViroHaptic(
  viewTag: number | null,
  options?: ForkHapticOptions,
) {
  if (viewTag == null) return;
  forkRuntime.triggerHaptic?.(viewTag, options);
}
