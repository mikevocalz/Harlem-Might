'use client';

import type { GridFloorProps } from './GridFloor.types';
import { View } from '../tw';
import { SkiaWebGate } from './SkiaWebGate';

const loadGridFloor = () => import('./GridFloor.skia');

export function GridFloor(props: GridFloorProps) {
  return (
    <SkiaWebGate
      load={loadGridFloor}
      props={props}
      fallback={<View className={`flex-1 bg-black ${props.className ?? ''}`}>{props.children}</View>}
    />
  );
}
