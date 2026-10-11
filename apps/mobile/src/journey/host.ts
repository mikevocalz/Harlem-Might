import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { NO_LOCATION_SOURCE, createBrowserLocationSource } from '@acme/app/features/navigation/view/locationSource.ts';
import { useNavigationHost } from '@acme/app/features/navigation/ui/useNavigationHost.ts';
import { configureJourneyRuntime } from '@acme/app/features/journey/runtime.ts';
import { contentReaders } from '../site/content-readers';
import { createExpoLocationSource } from '../navigation/expoLocationSource';
import { isHorizonBuild } from '../spatial/horizonBuild';
import { mountWatchCompanion, stopWatchHandoff } from './watchHandoff';

configureJourneyRuntime({ readers: contentReaders });
const source = () => {
  if (isHorizonBuild) return NO_LOCATION_SOURCE;
  if (Platform.OS === 'web') return createBrowserLocationSource(navigator.geolocation, navigator.permissions);
  // Guarded lazy import: older binaries lack the newly added native location module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  try { return createExpoLocationSource(require('expo-location') as typeof import('expo-location')); }
  catch { return NO_LOCATION_SOURCE; } // An older native binary can still browse.
};

/** Location and paired transport belong to the root, so changing routes cannot create another feed. */
export function useWalkJourneyHost() {
  useNavigationHost(source);
  useEffect(() => {
    const unmount = mountWatchCompanion();
    const background = AppState.addEventListener('change', state => { if (state !== 'active') void stopWatchHandoff(); });
    return () => { unmount(); background.remove(); void stopWatchHandoff(); };
  }, []);
}
