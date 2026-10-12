import { useEffect } from 'react';
import { ViroARSceneNavigator } from '@reactvision/react-viro';
import { View } from '@acme/ui/tw';
import { useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { HarlemNavigationArHud, type HarlemNavigationArHudProps } from './HarlemNavigationArHud';
import { HarlemNavigationArScene } from './HarlemNavigationArScene';
import { useNavAr } from './navAr.store';
import { isArNavigationScreen } from './navAr';
import { NAVIGATION_AR_BUILD } from './navArBuild';

const SCENE = { scene: HarlemNavigationArScene as unknown as () => React.JSX.Element };

/**
 * Phone AR navigation: the Viro camera scene with the 2D HUD on top. Shown by
 * the AR route while the shared session is in an AR phase. The world uses
 * Viro's default gravity alignment (−z is the camera's start direction); the
 * scene aligns it to true north itself, so iOS and Android share one path.
 */
export function HarlemNavigationAr({ cameraAllowed = true, ...props }: HarlemNavigationArHudProps & {
  /** The current route must meet the ordinary-phone layout contract. */
  readonly cameraAllowed?: boolean;
}) {
  const cameraNeeded = useNavigationStore((s) => isArNavigationScreen(s.session, s.arTracking));
  // AR-only state (placement, notice) lives for one visit; the navigation
  // session outlives it.
  useEffect(() => () => useNavAr.getState().reset(), []);
  return (
    <View className="flex-1 bg-black">
      {cameraAllowed && cameraNeeded ? <ViroARSceneNavigator
        initialScene={SCENE}
        worldAlignment="Gravity"
        // Match the native plugin's configured provider. Earth is unavailable
        // in the current build; the scene uses its compass/VIO fallback.
        provider={NAVIGATION_AR_BUILD.provider}
        autofocus
        style={{ flex: 1 }}
      /> : null}
      <HarlemNavigationArHud {...props} />
    </View>
  );
}
