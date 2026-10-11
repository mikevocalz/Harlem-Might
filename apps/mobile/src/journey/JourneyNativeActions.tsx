import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'solito/navigation';
import { isMetaHorizonXR, isPico, isVisionOS, isARSupportedOnDevice } from '@reactvision/react-viro';
import { JourneyDeviceActions } from '@acme/app/features/journey/JourneyDeviceActions.tsx';
import { useNavigationUi } from '@acme/app/features/navigation/view/navigationUi.store.ts';
import { verifiedArrival } from '@acme/app/features/journey/cues.ts';
import { liveProgress } from '@acme/app/features/journey/model.ts';
import { navigationFixStore, useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { navigationController } from '@acme/app/features/navigation/view/runtime.ts';
import { useJourneyClock } from '@acme/app/features/journey/useJourneyClock.ts';
import { useJourney } from '@acme/app/features/journey/useJourney.ts';
import { currentJourneyStop } from '@acme/app/features/journey/runtime.ts';
import { canUseArNavigation, enterArNavigation } from '../ar/arNavigationEntry';
import { isHorizonBuild } from '../spatial/horizonBuild';
import { startWatchHandoff, stopWatchHandoff, watchHandoffState } from './watchHandoff';

export function JourneyNativeActions() {
  const router = useRouter();
  const journey = useJourney();
  const navigation = useNavigationStore(s => s.session);
  const watch = useSyncExternalStore(watchHandoffState.subscribe, watchHandoffState.getSnapshot, watchHandoffState.getSnapshot);
  const supportedBuild = canUseArNavigation({ isHorizonBuild, isMetaHorizonXR, isPico, isVisionOS: isVisionOS(), platform: Platform.OS });
  const [deviceSupportsAR, setDeviceSupportsAR] = useState(false);
  useEffect(() => {
    let active = true;
    if (supportedBuild) void isARSupportedOnDevice().then(result => { if (active) setDeviceSupportsAR(result.isARSupported); }).catch(() => {});
    return () => { active = false; };
  }, [supportedBuild]);
  const now = useJourneyClock();
  const eligible = (at: number) => {
    const state = useNavigationStore.getState(); const fixes = navigationFixStore.getState(); const stop = currentJourneyStop(); const ui = useNavigationUi.getState();
    return !!stop && (verifiedArrival(state, fixes, at, stop.slug, ui.location, ui.online) || !!liveProgress(state, fixes, at, ui.online, stop.slug, ui.location));
  };
  const arAvailable = deviceSupportsAR && supportedBuild && journey.session?.status === 'active' && (navigation.phase === 'navigating' || navigation.phase === 'arrived') && eligible(now);
  return <JourneyDeviceActions watchEnabled={watch.enabled} watchBusy={watch.busy} watchMessage={watch.message}
    onWatch={() => { if (watch.enabled) void stopWatchHandoff(); else void startWatchHandoff(); }} arAvailable={arAvailable}
    onAr={() => {
      if (!arAvailable || !eligible(Date.now())) return;
      const controller = navigationController();
      if (useNavigationStore.getState().session.phase === 'arrived') { controller.setArTracking({ kind: 'initializing' }); router.push('/explore-ar'); }
      else if (enterArNavigation(controller)) router.push('/explore-ar');
    }} />;
}
