import { Dimensions, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { requireOptionalNativeModule } from 'expo';
import { isHorizonBuild } from '../spatial/horizonBuild';
import { navigationPresentation } from './navigationPresentation';

const capabilities = Platform.OS === 'android'
  ? requireOptionalNativeModule<{ getDeviceCapabilities(): { isFoldable: boolean; isTablet: boolean } }>('DeviceCapabilities')?.getDeviceCapabilities()
  : null;

/** Matches MoyoLearn's 64pt hardware-column detection and consumes that space once. */
export function useNavigationPresentation() {
  useWindowDimensions(); // Re-read screen geometry after rotation or folding.
  const insets = useSafeAreaInsets();
  const hardwareColumnWidth = Platform.OS === 'ios' && insets.right >= 64 ? insets.right : 0;
  const screen = Dimensions.get('screen');
  const isTablet = Platform.OS === 'ios' ? Platform.isPad
    : capabilities?.isTablet ?? Math.min(screen.width, screen.height) >= 600;
  return {
    ...navigationPresentation({
      isHorizon: isHorizonBuild,
      isFoldable: capabilities?.isFoldable ?? hardwareColumnWidth > 0,
      isTablet,
      hardwareColumnWidth,
    }),
    hardwareColumnWidth,
  };
}
