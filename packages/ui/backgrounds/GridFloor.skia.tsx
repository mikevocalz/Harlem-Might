'use client';

import { useState } from 'react';
import { BlurMask, Canvas, Fill, Group, Line, LinearGradient, vec, useClock } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { View } from '../tw';
import type { GridFloorProps } from './GridFloor.types';

function AnimatedRow({
  index, rows, horizonY, height, width, speed, color, opacity, lineWidth,
}: {
  index: number; rows: number; horizonY: number; height: number; width: number;
  speed: number; color: string; opacity: number; lineWidth: number;
}) {
  const clock = useClock();
  const y = useDerivedValue(() => {
    const phase = speed === 0 ? 0 : ((clock.value / 1000) * speed * 1.5) % 1;
    const t = (index + phase) / rows;
    return horizonY + (height - horizonY) * t * t;
  });
  const p1 = useDerivedValue(() => vec(0, y.value));
  const p2 = useDerivedValue(() => vec(width, y.value));
  const alpha = Math.min(1, ((index + 1) / rows) / 0.35) * opacity;

  return (
    <Line p1={p1} p2={p2} color={color} opacity={alpha} strokeWidth={lineWidth}>
      <BlurMask blur={lineWidth * 2.25} style="solid" />
    </Line>
  );
}

export default function GridFloorSkia({
  className, children, horizon = 0.45, columns = 24, rows = 18,
  lineColor = '#00f3ff', backgroundColor = '#050505', glowColor = '#00f3ff',
  speed = 0.6, opacity = 0.85, lineWidth = 1,
}: GridFloorProps) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const { width, height } = size;
  const horizonY = height * horizon;
  const columnIndexes = Array.from({ length: columns + 1 }, (_, index) => index - columns / 2);
  const rowIndexes = Array.from({ length: rows + 4 }, (_, index) => index);

  return (
    <View
      className={`relative flex-1 overflow-hidden ${className ?? ''}`}
      style={{ backgroundColor }}
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        if (next.width !== width || next.height !== height) setSize({ width: next.width, height: next.height });
      }}
    >
      <Canvas pointerEvents="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <Fill color={backgroundColor} />
        <Group>
          {columnIndexes.map((offset) => {
            const centerX = width / 2;
            const xTop = centerX + offset * (width / columns);
            const xBottom = centerX + offset * ((width * 2) / columns);
            return (
              <Line key={offset} p1={vec(xTop, horizonY)} p2={vec(xBottom, height)} strokeWidth={lineWidth} opacity={opacity * 0.72}>
                <LinearGradient start={vec(0, horizonY)} end={vec(0, height)} colors={[`${lineColor}00`, lineColor, lineColor]} positions={[0, 0.35, 1]} />
              </Line>
            );
          })}
          {rowIndexes.map((index) => (
            <AnimatedRow key={index} index={index} rows={rows} horizonY={horizonY} height={height} width={width} speed={speed} color={glowColor} opacity={opacity} lineWidth={lineWidth} />
          ))}
        </Group>
      </Canvas>
      {children}
    </View>
  );
}
