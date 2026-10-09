import { useEffect } from 'react';
import { ViroARSceneNavigator } from '@reactvision/react-viro';
import { View } from '@acme/ui/tw';
import { HarlemNavigationArHud, type HarlemNavigationArHudProps } from './HarlemNavigationArHud';
import { HarlemNavigationArScene } from './HarlemNavigationArScene';
import { useNavAr } from './navAr.store';

const SCENE = { scene: HarlemNavigationArScene as unknown as () => React.JSX.Element };

/**
 * Phone AR navigation: the Viro camera scene with the 2D HUD on top. Shown by
 * the AR route while the shared session is in an AR phase. The world uses
 * Viro's default gravity alignment (−z is the camera's start direction); the
 * scene aligns it to true north itself, so iOS and Android share one path.
 */
export function HarlemNavigationAr(props: HarlemNavigationArHudProps) {
  // AR-only state (placement, notice) lives for one visit; the navigation
  // session outlives it.
  useEffect(() => () => useNavAr.getState().reset(), []);
  return (
    <View className="flex-1 bg-black">
      <ViroARSceneNavigator initialScene={SCENE} worldAlignment="Gravity" autofocus style={{ flex: 1 }} />
      <HarlemNavigationArHud {...props} />
    </View>
  );
}
