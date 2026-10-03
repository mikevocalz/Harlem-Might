import React from 'react';
import { router } from 'expo-router';
import { ViroXRSceneNavigator } from '@reactvision/react-viro';
import { ViroExternalTestScene } from '../../components/ViroExternalTestScene';

/**
 * Headset test route for @viro-external/ui panels.
 * Open with: adb shell am start -a android.intent.action.VIEW -d harlemmight://viro-external
 */
export default function ViroExternalRoute() {
  return (
    <ViroXRSceneNavigator
      vrInitialScene={{ scene: ViroExternalTestScene }}
      arInitialScene={{ scene: ViroExternalTestScene }}
      passthroughEnabled
      handTrackingEnabled
      onExitViro={() => router.back()}
      style={{ flex: 1 }}
    />
  );
}
