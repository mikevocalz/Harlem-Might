import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'solito/navigation';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { isARSupportedOnDevice, isMetaHorizonXR, isPico, isVisionOS, requestRequiredPermissions } from '@reactvision/react-viro';
import { MightsButton } from '@acme/ui/mights';
import { Text, View } from '@acme/ui/tw';
import { selectSession, useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { startGuidance } from '@acme/app/features/navigation/view/runtime.ts';
import { useNavigationUi } from '@acme/app/features/navigation/view/navigationUi.store.ts';
import { isHorizonBuild } from '../spatial/horizonBuild';
import { arEntryRoute, canUseArNavigation, createArNavigationEntry, enterArNavigation, type ArEntryResult } from './arNavigationEntry';
import { getNavigationController } from './navigationRuntime';

const eligibleBuild = canUseArNavigation({ isHorizonBuild, isMetaHorizonXR, isPico, isVisionOS: isVisionOS(), platform: Platform.OS });
const entryState = createStore(() => ({ pending: false }));
const entry = createArNavigationEntry({
  getSession: () => useNavigationStore.getState().session,
  supported: async () => (await isARSupportedOnDevice()).isARSupported,
  // Camera is the only extra permission AR needs. Location belongs to the
  // existing "Use my location" flow; never request microphone or storage.
  requestCamera: async () => (await requestRequiredPermissions(['camera'])).camera === true,
  startGuidance,
  enterAR: () => enterArNavigation(getNavigationController()),
  exitAR: () => getNavigationController().exitAR(),
  setPending: (pending) => entryState.setState({ pending }),
});

const ERROR_COPY: Partial<Record<ArEntryResult, string>> = {
  unsupported: 'AR is unavailable on this device. You can keep following the map.',
  'camera-denied': 'Camera access is needed for AR. Allow it in Settings or keep using the map.',
  unavailable: 'AR could not start. Try again, or keep following the map.',
};

/** Native adapter for the existing directions and map action slots. */
export function ArNavigationButton() {
  const router = useRouter();
  const session = useNavigationStore(selectSession);
  const location = useNavigationUi((state) => state.location);
  const pending = useStore(entryState, (state) => state.pending);
  const local = useRef<ReturnType<typeof createMessageStore> | null>(null);
  if (local.current === null) local.current = createMessageStore();
  // The ref owns a stable external store; useStore subscribes to its value.
  // eslint-disable-next-line react-hooks/refs
  const message = useStore(local.current, (state) => state.message);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => { local.current?.setState({ message: undefined }); }, [session.phase]);

  if (!eligibleBuild || !arEntryRoute(session) || (location !== 'granted' && location !== 'approximate')) return null;

  return (
    <View className="min-w-0 shrink gap-2">
      <MightsButton
        variant="outline"
        disabled={pending}
        aria-label="Follow this walking route in AR"
        onPress={() => {
          local.current?.setState({ message: undefined });
          void entry.open(() => router.push('/explore-ar'), () => {
            const currentLocation = useNavigationUi.getState().location;
            return mounted.current && (currentLocation === 'granted' || currentLocation === 'approximate');
          }).then((result) => {
            if (mounted.current) local.current?.setState({ message: ERROR_COPY[result] });
          });
        }}
      >
        {pending ? 'Checking AR…' : 'Walk in AR'}
      </MightsButton>
      {message ? <Text role="alert" className="max-w-72 font-sans text-small text-text">{message}</Text> : null}
    </View>
  );
}

function createMessageStore() {
  return createStore(() => ({ message: undefined as string | undefined }));
}
