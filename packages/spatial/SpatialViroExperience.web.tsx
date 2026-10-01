'use client';

import type { ComponentType } from 'react';
import { useEffect } from 'react';
import { Text, View } from '@acme/ui/tw';
import {
  Viro3DSceneNavigator,
  ViroVirtualButton,
  ViroVirtualJoystick,
} from './viro';
import { SpatialDemoScene } from './SpatialDemoScene';
import { TabletopThreeExperience } from './TabletopThreeExperience.web';
import { gridRace, useGridRaceStore } from './gridRaceStore';
import { useTabletopSessionStore } from './tabletopSessionStore';

type WebNavigatorProps = {
  initialScene: { scene: ComponentType<any> };
  webRendererOptions: { assetBaseUrl: string };
  style?: Record<string, unknown>;
};

const WebViro3DSceneNavigator =
  Viro3DSceneNavigator as unknown as ComponentType<WebNavigatorProps>;

export function SpatialViroExperience() {
  const phase = useGridRaceStore((state) => state.phase);
  const tabletopMode = useTabletopSessionStore((state) => state.mode);

  useEffect(() => {
    if (tabletopMode !== 'idle') return;

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isTurnKey =
        key === 'arrowleft' || key === 'a' || key === 'arrowright' || key === 'd';
      const isBoostKey =
        key === 'arrowup' || key === 'w' || key === ' ' || key === 'shift';

      if (isTurnKey || isBoostKey) event.preventDefault();

      if (!event.repeat && (key === 'arrowleft' || key === 'a')) {
        gridRace.queueTurn(-1);
      }
      if (!event.repeat && (key === 'arrowright' || key === 'd')) {
        gridRace.queueTurn(1);
      }
      if (isBoostKey) {
        gridRace.setBoost(true);
      }
      if (!event.repeat && key === 'enter' && gridRace.getState().phase === 'gateway') {
        gridRace.startRace();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'arrowup' || key === 'w' || key === ' ' || key === 'shift') {
        gridRace.setBoost(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      gridRace.setBoost(false);
    };
  }, [tabletopMode]);

  if (tabletopMode === 'solo') {
    return <TabletopThreeExperience />;
  }

  if (tabletopMode === 'host' || tabletopMode === 'guest') {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-black px-6">
        <Text className="text-center text-sm font-bold uppercase tracking-[0.18em] text-cyan-100">
          Physical tabletop co-location requires the native Viro runtime
        </Text>
        <Text className="max-w-xl text-center text-xs leading-5 text-white/55">
          Use Solo / AI here to exercise the identical deterministic core through
          Three.js WebGPU + TypeGPU. Host / Join uses Viro shared spatial frames on
          supported native device families.
        </Text>
      </View>
    );
  }

  return (
    <View className="relative flex-1">
      <WebViro3DSceneNavigator
        initialScene={{ scene: SpatialDemoScene }}
        webRendererOptions={{ assetBaseUrl: '/viro/wasm/' }}
        style={{ flex: 1 }}
      />

      <View className="pointer-events-box-none absolute inset-0">
        <View className="absolute bottom-4 left-4 gap-2">
          <Text className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">
            {phase === 'gateway' ? 'Select gate or start race' : 'Stick / A-D / arrows turn • push up / W / Space / A-button boosts'}
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
    </View>
  );
}
