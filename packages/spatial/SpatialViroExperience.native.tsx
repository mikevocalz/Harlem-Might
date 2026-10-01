'use client';

import type { ComponentType } from 'react';
import { useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { Text, View } from '@acme/ui/tw';
import {
  isPico,
  isMetaHorizonXR,
  Viro3DSceneNavigator,
  ViroVirtualButton,
  ViroVirtualJoystick,
  ViroXRSceneNavigator,
} from './viro';
import { SpatialDemoScene } from './SpatialDemoScene';
import { TabletopColocationScene } from './TabletopColocationScene.native';
import { TabletopThreeExperience } from './TabletopThreeExperience.native';
import { GridCoreSpinner } from './rive-fx/GridFxStage.native';
import { gridRace, useGridRaceStore } from './gridRaceStore';
import { tabletopSession, useTabletopSessionStore } from './tabletopSessionStore';

type HeadsetNavigatorProps = {
  initialScene?: { scene: ComponentType<any> };
  arInitialScene?: { scene: ComponentType<any> };
  vrInitialScene?: { scene: ComponentType<any> };
  vrModeEnabled?: boolean;
  passthroughEnabled?: boolean;
  handTrackingEnabled?: boolean;
  trackingOrigin?: 'eye' | 'floor';
  provider?: 'reactvision' | 'arcore' | 'none';
  hdrEnabled?: boolean;
  pbrEnabled?: boolean;
  bloomEnabled?: boolean;
  shadowsEnabled?: boolean;
  multisamplingEnabled?: boolean;
  onExitViro?: () => void;
  style?: Record<string, unknown>;
};

const HeadsetNavigator =
  ViroXRSceneNavigator as unknown as ComponentType<HeadsetNavigatorProps>;

const GRID_FX_RIV_SOURCE =
  process.env.EXPO_PUBLIC_GRID_FX_RIV_URL ?? '';

function FlatPreviewControls() {
  const phase = useGridRaceStore((state) => state.phase);

  return (
    <View className="pointer-events-box-none absolute inset-0">
      <View className="absolute bottom-4 left-4 gap-2">
        <Text className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">
          {phase === 'gateway' ? 'Select gate or start race' : 'Tap stick left/right to turn • push up or A to boost'}
        </Text>
        <ViroVirtualJoystick
          controllerId="grid-racer"
          stickSide="left"
          radius={52}
          tintColor="rgba(0,243,255,0.72)"
          onStickChange={(event) => {
            const { x, y } = event.nativeEvent;
            gridRace.setStick(x, y);
          }}
          style={{ width: 104, height: 104 }}
        />
      </View>
      <ViroVirtualButton
        controllerId="grid-racer"
        button="A"
        size={58}
        tintColor="rgba(255,122,0,0.78)"
        onPressIn={() => gridRace.setBoost(true)}
        onPressOut={() => gridRace.setBoost(false)}
        style={{ position: 'absolute', right: 30, bottom: 38, width: 58, height: 58 }}
      />
    </View>
  );
}

export function SpatialViroExperience() {
  const headset = isMetaHorizonXR || isPico;
  const tabletopMode = useTabletopSessionStore((state) => state.mode);
  const sharedTabletop = tabletopMode === 'host' || tabletopMode === 'guest';
  const questSpatialPermission = useTabletopSessionStore(
    (state) => state.questSpatialPermission,
  );
  const setQuestSpatialPermission = useTabletopSessionStore(
    (state) => state.setQuestSpatialPermission,
  );

  useEffect(() => {
    if (!sharedTabletop || !isMetaHorizonXR || Platform.OS !== 'android') {
      if (!isMetaHorizonXR) setQuestSpatialPermission('granted');
      return;
    }

    let cancelled = false;
    void PermissionsAndroid.request(
      'horizonos.permission.USE_ANCHOR_API' as never,
    )
      .then((result) => {
        if (cancelled) return;
        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        setQuestSpatialPermission(granted ? 'granted' : 'denied');
        if (!granted) {
          tabletopSession.setState({
            error:
              'Spatial Data permission is required to detect Quest tables/floors for tabletop placement.',
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setQuestSpatialPermission('denied');
        tabletopSession.setState({
          error: 'Unable to request Horizon OS Spatial Data permission.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [sharedTabletop, setQuestSpatialPermission]);

  if (tabletopMode === 'solo' && !headset) {
    return <TabletopThreeExperience />;
  }

  if (sharedTabletop && isMetaHorizonXR && questSpatialPermission !== 'granted') {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-black px-6">
        {GRID_FX_RIV_SOURCE ? (
          <GridCoreSpinner source={GRID_FX_RIV_SOURCE} size={104} />
        ) : null}
        <Text className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-100">
          {questSpatialPermission === 'checking'
            ? 'Authorizing spatial placement…'
            : 'Spatial placement permission required'}
        </Text>
        <Text className="max-w-lg text-center text-xs leading-5 text-white/55">
          Meta Horizon tabletop mode needs Spatial Data access so Viro can read
          the room-model floor/table planes used for mat placement.
        </Text>
      </View>
    );
  }

  if (sharedTabletop) {
    return (
      <HeadsetNavigator
        initialScene={{ scene: TabletopColocationScene }}
        arInitialScene={{ scene: TabletopColocationScene }}
        vrInitialScene={{ scene: TabletopColocationScene }}
        vrModeEnabled
        passthroughEnabled={isMetaHorizonXR}
        handTrackingEnabled
        trackingOrigin="floor"
        provider="reactvision"
        hdrEnabled={false}
        pbrEnabled
        bloomEnabled={false}
        shadowsEnabled
        multisamplingEnabled
        onExitViro={() => {
          tabletopSession.getState().setSpatialViewOpen(false);
        }}
        style={{ flex: 1 }}
      />
    );
  }

  if (headset) {
    return (
      <HeadsetNavigator
        initialScene={{ scene: SpatialDemoScene }}
        vrInitialScene={{ scene: SpatialDemoScene }}
        vrModeEnabled
        passthroughEnabled={false}
        handTrackingEnabled
        trackingOrigin="floor"
        onExitViro={() => {
          tabletopSession.getState().setSpatialViewOpen(false);
        }}
        style={{ flex: 1 }}
      />
    );
  }

  return (
    <View className="relative flex-1">
      <Viro3DSceneNavigator
        initialScene={{ scene: SpatialDemoScene as never }}
        onExitViro={() => {
          tabletopSession.getState().setSpatialViewOpen(false);
        }}
        style={{ flex: 1 }}
      />
      <FlatPreviewControls />
    </View>
  );
}
