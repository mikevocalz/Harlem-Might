import { useEffect } from 'react';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { supportsPhoneArLayout, type PhoneArDeviceInput } from './phoneArDevice';

// Same stable capability module used by useNavigationPresentation. Do not
// infer a phone from window width, a folded cover or absent hinge geometry.
function readAndroidCapabilities(): PhoneArDeviceInput['androidCapabilities'] {
  if (Platform.OS !== 'android') return undefined;
  try {
    return requireOptionalNativeModule<{
      getDeviceCapabilities(): { isFoldable: boolean; isTablet: boolean };
    }>('DeviceCapabilities')?.getDeviceCapabilities();
  } catch {
    return undefined;
  }
}
const androidCapabilities = readAndroidCapabilities();
const useHardwareColumnEvidence = create(() => ({ seen: false }));

/** Fail closed until the existing shell has ordinary-phone capability evidence. */
export function usePhoneArLayout(): boolean {
  const insets = useSafeAreaInsets();
  const seenHardwareColumn = useHardwareColumnEvidence((state) => state.seen);
  const hasHardwareColumn = seenHardwareColumn || (Platform.OS === 'ios' && insets.right >= 64);
  useEffect(() => {
    if (hasHardwareColumn) useHardwareColumnEvidence.setState({ seen: true });
  }, [hasHardwareColumn]);
  return supportsPhoneArLayout({
    platform: Platform.OS,
    isPad: Platform.OS === 'ios' ? Platform.isPad : undefined,
    androidCapabilities,
    hasHardwareColumn,
  });
}
