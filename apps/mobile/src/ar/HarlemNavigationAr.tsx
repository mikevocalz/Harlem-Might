import { useLayoutEffect } from 'react';
import { ViroARSceneNavigator } from '@reactvision/react-viro';
import { View } from '@acme/ui/tw';
import { useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { HarlemNavigationArHud, type HarlemNavigationArHudProps } from './HarlemNavigationArHud';
import { HarlemNavigationArScene } from './HarlemNavigationArScene';
import { isArNavigationScreen } from './navAr';
import { NAVIGATION_AR_BUILD } from './navArBuild';
import { attachNavigationArCamera } from './navArCameraLifetime';

const SCENE = { scene: HarlemNavigationArScene as unknown as () => React.JSX.Element };

/** This boundary is mounted exactly as long as the native camera navigator. */
function NavigationArCamera() {
  useLayoutEffect(attachNavigationArCamera, []);
  return (
    <ViroARSceneNavigator
      initialScene={SCENE}
      worldAlignment="Gravity"
      // Match the native plugin's configured provider. Earth is unavailable
      // in the current build; the scene uses its compass/VIO fallback.
      provider={NAVIGATION_AR_BUILD.provider}
      autofocus
      style={{ flex: 1 }}
    />
  );
}

/**
 * AR navigation: the Viro camera scene with the 2D HUD on top. Shown inside
 * the visible Explore host while the shared session is in an AR phase. The world uses
 * Viro's default gravity alignment (−z is the camera's start direction); the
 * scene aligns it to true north itself, so iOS and Android share one path.
 */
export function HarlemNavigationAr({ cameraAllowed = true, ...props }: HarlemNavigationArHudProps & {
  /** Whether the containing host is visible and may own the camera. */
  readonly cameraAllowed?: boolean;
}) {
  const cameraNeeded = useNavigationStore((s) => isArNavigationScreen(s.session, s.arTracking));
  return (
    <View className="flex-1 bg-black">
      {cameraAllowed && cameraNeeded ? <NavigationArCamera /> : null}
      <HarlemNavigationArHud {...props} />
    </View>
  );
}
