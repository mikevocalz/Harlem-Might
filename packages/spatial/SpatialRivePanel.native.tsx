'use client';

import type { ComponentType } from 'react';
import * as Viro from '@reactvision/react-viro';
import { ViroQuad, ViroText } from './viro';

export type SpatialRiveBindingValue =
  | string
  | number
  | boolean
  | { kind: 'enum'; value: string }
  | { kind: 'color'; value: number }
  | { kind: 'trigger'; serial: number };

export type SpatialRiveBindings = Record<string, SpatialRiveBindingValue>;

type ForkRivePanel = ComponentType<{
  source: {
    rivBytes: ArrayBuffer;
    artboard?: string;
    stateMachine?: string;
    fit?: 'contain' | 'cover' | 'fill';
  };
  bindings?: SpatialRiveBindings;
  width: number;
  height: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  resolution?: { width: number; height: number };
  androidRoute?: 'ahb' | 'surface-texture';
}>;

const ViroRivePanel = (
  Viro as unknown as { ViroRivePanel?: ForkRivePanel }
).ViroRivePanel;

export function SpatialRivePanel({
  bytes,
  bindings,
  artboard = 'LightCycleScoreboard',
  stateMachine = 'Main',
  position = [0, 0.1, -2.2],
  rotation,
  width = 1.3,
  height = 0.8,
}: {
  bytes?: ArrayBuffer;
  bindings?: SpatialRiveBindings;
  artboard?: string;
  stateMachine?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
}) {
  if (bytes && ViroRivePanel) {
    return (
      <ViroRivePanel
        source={{
          rivBytes: bytes,
          artboard,
          stateMachine,
          fit: 'contain',
        }}
        bindings={bindings}
        width={width}
        height={height}
        position={position}
        rotation={rotation}
        resolution={{ width: 1040, height: 640 }}
        androidRoute="ahb"
      />
    );
  }

  return (
    <>
      <ViroQuad
        position={position}
        rotation={rotation}
        width={width}
        height={height}
        materials={['spatialDark']}
      />
      <ViroText
        position={[position[0], position[1], position[2] + 0.01]}
        rotation={rotation}
        width={Math.max(1.8, width * 1.8)}
        height={0.5}
        scale={[0.4, 0.4, 0.4]}
        text={
          ViroRivePanel
            ? 'Set EXPO_PUBLIC_LIGHTCYCLE_SCOREBOARD_RIV_URL to load the Rive scoreboard'
            : 'Viro fork Rive bridge available after fork override'
        }
        style={{
          fontSize: 18,
          color: '#2cf6ff',
          textAlign: 'center',
        }}
      />
    </>
  );
}
