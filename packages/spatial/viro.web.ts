export { Viro3DSceneNavigator } from '@reactvision/react-viro/dist/components/Viro3DSceneNavigator.web';
export { ViroAmbientLight } from '@reactvision/react-viro/dist/components/ViroAmbientLight.web';
export { ViroBox } from '@reactvision/react-viro/dist/components/ViroBox.web';
export { ViroDirectionalLight } from '@reactvision/react-viro/dist/components/ViroDirectionalLight.web';
export { ViroGameLoop } from '@reactvision/react-viro/dist/components/ViroGameLoop.web';
export { ViroNode } from '@reactvision/react-viro/dist/components/ViroNode.web';
export { ViroPolyline } from '@reactvision/react-viro/dist/components/ViroPolyline.web';
export { ViroQuad } from '@reactvision/react-viro/dist/components/ViroQuad.web';
export { ViroScene } from '@reactvision/react-viro/dist/components/ViroScene.web';
export { ViroText } from '@reactvision/react-viro/dist/components/ViroText.web';
export { ViroVirtualButton } from '@reactvision/react-viro/dist/components/ViroVirtualButton.web';
export { ViroVirtualJoystick } from '@reactvision/react-viro/dist/components/ViroVirtualJoystick.web';
export { ViroMaterials } from '@reactvision/react-viro/dist/components/Material/ViroMaterials.web';

export const isQuest = false;
export const isPico = false;
export const isMetaHorizonXR = false;
export const isKnownQuest = false;
export const metaHorizonFormFactor = null;

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

export function ViroController() {
  return null;
}

export function ViroXRSceneNavigator() {
  return null;
}

type ForkHapticOptions = {
  hand?: 'left' | 'right' | 'both' | 'active';
  amplitude?: number;
  durationSec?: number;
};

export function useViroVRViewTag() {
  return null;
}

export async function getOpenXRRuntimeCapabilities(
  _viewTag: number | null,
): Promise<ViroOpenXRRuntimeCapabilities | null> {
  return null;
}

export function triggerViroHaptic(
  _viewTag: number | null,
  _options?: ForkHapticOptions,
) {
  // Headset haptics are native-only. Keep the shared race scene portable on web.
}
