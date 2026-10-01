'use client';

import type { GridSceneProps } from './GridScene.types';
import { View } from '../tw';
import { SkiaWebGate } from './SkiaWebGate';

const loadGridScene = () => import('./GridScene.skia');

export function GridScene(props: GridSceneProps) {
  return (
    <SkiaWebGate
      load={loadGridScene}
      props={props}
      fallback={<View className={`flex-1 bg-black ${props.className ?? ''}`}>{props.children}</View>}
    />
  );
}
