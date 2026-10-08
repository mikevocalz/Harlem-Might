import React from 'react';
import { useRouter } from 'solito/navigation';
import { ViroXRSceneNavigator } from '@reactvision/react-viro';
import { ViroExternalTestScene } from '../components/ViroExternalTestScene';

/**
 * Headset test route for @viro-external/ui panels. Not in any nav (DECISIONS
 * S13); reachable only by deep link:
 * adb shell am start -a android.intent.action.VIEW -d harlemmight://viro-external
 *
 * DEFER (2026-10-08): deleting this file and ViroExternalTestScene waits on
 * the viro-external Step 2 harness decision. Before a release build, either
 * delete both or move them into a dev-only route group so the route can't
 * ship.
 */
export default function ViroExternalRoute() {
  const router = useRouter();
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
