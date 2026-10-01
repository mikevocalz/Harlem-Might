'use client';

import { useState } from 'react';
import { BlurMask, Canvas, Fill, Group, Line, LinearGradient, vec, useClock } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { View } from '../tw';
import type { GridSceneProps } from './GridScene.types';

function MovingLine({
  index, rows, edgeY, farY, width, speed, color, opacity, lineWidth,
}: {
  index: number; rows: number; edgeY: number; farY: number; width: number;
  speed: number; color: string; opacity: number; lineWidth: number;
}) {
  const clock = useClock();
  const y = useDerivedValue(() => {
    const phase = speed === 0 ? 0 : ((clock.value / 1000) * speed * 1.5) % 1;
    const t = (index + phase) / rows;
    return edgeY + (farY - edgeY) * t * t;
  });
  const p1 = useDerivedValue(() => vec(0, y.value));
  const p2 = useDerivedValue(() => vec(width, y.value));
  const alpha = Math.min(1, ((index + 1) / rows) / 0.35) * opacity;

  return (
    <Line p1={p1} p2={p2} color={color} opacity={alpha} strokeWidth={lineWidth}>
      <BlurMask blur={lineWidth * 2.5} style="solid" />
    </Line>
  );
}

export default function GridSceneSkia({
  className, children, horizon = 0.5, gap = 0.08, columns = 24, rows = 18,
  lineColor = '#00f3ff', glowColor = '#00f3ff', backgroundColor = '#050505',
  speed = 0.6, opacity = 0.85, lineWidth = 1, showCeiling = true, showFloor = true,
}: GridSceneProps) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const { width, height } = size;
  const horizonY = height * horizon;
  const halfGap = (height * gap) / 2;
  const floorEdgeY = horizonY + halfGap;
  const ceilingEdgeY = horizonY - halfGap;
  const columnsArray = Array.from({ length: columns + 1 }, (_, index) => index - columns / 2);
  const rowsArray = Array.from({ length: rows + 5 }, (_, index) => index);

  const planeColumns = (floor: boolean) => {
    const edgeY = floor ? floorEdgeY : ceilingEdgeY;
    const farY = floor ? height : 0;
    return columnsArray.map((offset) => {
      const centerX = width / 2;
      const xNear = centerX + offset * (width / columns);
      const xFar = centerX + offset * ((width * 2) / columns);
      return (
        <Line key={`${floor ? 'f' : 'c'}-${offset}`} p1={vec(xNear, edgeY)} p2={vec(xFar, farY)} strokeWidth={lineWidth} opacity={opacity * 0.72}>
          <LinearGradient start={vec(0, edgeY)} end={vec(0, farY)} colors={[`${lineColor}00`, lineColor, lineColor]} positions={[0, 0.35, 1]} />
        </Line>
      );
    });
  };

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
          {showFloor ? planeColumns(true) : null}
          {showCeiling ? planeColumns(false) : null}
          {showFloor ? rowsArray.map((index) => (
            <MovingLine key={`fr-${index}`} index={index} rows={rows} edgeY={floorEdgeY} farY={height} width={width} speed={speed} color={glowColor} opacity={opacity} lineWidth={lineWidth} />
          )) : null}
          {showCeiling ? rowsArray.map((index) => (
            <MovingLine key={`cr-${index}`} index={index} rows={rows} edgeY={ceilingEdgeY} farY={0} width={width} speed={speed} color={glowColor} opacity={opacity} lineWidth={lineWidth} />
          )) : null}
        </Group>
      </Canvas>
      {children}
    </View>
  );
}
