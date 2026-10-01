'use client';

import { useMemo, useState } from 'react';
import { BlurMask, Canvas, Circle, Fill, Group, Line, Rect, vec, useClock } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { View } from '../tw';
import type { GlyphCityProps, GlyphCityVariant } from './GlyphCity.types';

type Building = {
  x: number;
  width: number;
  height: number;
  antenna: number;
  tone: number;
  seed: number;
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildCity(width: number, height: number, variant: GlyphCityVariant): Building[] {
  const random = mulberry32(42 + variant.charCodeAt(0));
  const config = {
    downtown: { minWidth: 0.055, maxWidth: 0.11, minHeight: 0.35, maxHeight: 0.76 },
    megacity: { minWidth: 0.038, maxWidth: 0.082, minHeight: 0.42, maxHeight: 0.88 },
    district: { minWidth: 0.07, maxWidth: 0.145, minHeight: 0.25, maxHeight: 0.62 },
    ruins: { minWidth: 0.052, maxWidth: 0.105, minHeight: 0.18, maxHeight: 0.48 },
  }[variant];
  const result: Building[] = [];
  let x = -12;
  let seed = 0;

  while (x < width + 20) {
    const buildingWidth = width * (config.minWidth + random() * (config.maxWidth - config.minWidth));
    const buildingHeight = height * (config.minHeight + random() * (config.maxHeight - config.minHeight));
    result.push({
      x,
      width: buildingWidth,
      height: buildingHeight,
      antenna: random() > 0.45 ? 18 + random() * Math.max(20, height * 0.12) : 0,
      tone: Math.floor(random() * 3),
      seed: seed++,
    });
    x += buildingWidth + 6 + random() * 18;
  }
  return result;
}

function BuildingNode({
  building,
  ground,
  palette,
  tertiary,
  blinkingLights,
}: {
  building: Building;
  ground: number;
  palette: string[];
  tertiary: string;
  blinkingLights: boolean;
}) {
  const clock = useClock();
  const lightOpacity = useDerivedValue(() =>
    blinkingLights ? 0.25 + 0.75 * Math.abs(Math.sin(clock.value / 480 + building.seed)) : 0.9,
  );
  const top = ground - building.height;
  const tone = palette[building.tone] ?? palette[0] ?? '#00f3ff';
  const columns = Math.max(2, Math.floor(building.width / 18));
  const rows = Math.max(3, Math.floor(building.height / 24));

  return (
    <Group>
      <Rect x={building.x} y={top} width={building.width} height={building.height} color="#020408" opacity={0.78} />
      <Line p1={vec(building.x, ground)} p2={vec(building.x, top)} color={tone} strokeWidth={2}>
        <BlurMask blur={4} style="solid" />
      </Line>
      <Line p1={vec(building.x, top)} p2={vec(building.x + building.width, top)} color={tone} strokeWidth={2} />
      <Line p1={vec(building.x + building.width, top)} p2={vec(building.x + building.width, ground)} color={tone} strokeWidth={2} />

      {Array.from({ length: columns }, (_, column) =>
        Array.from({ length: rows }, (_, row) => {
          const selector = (building.seed * 17 + column * 7 + row * 11) % 5;
          if (selector === 0) return null;
          const gx = building.x + 10 + column * 18;
          const gy = top + 14 + row * 24;
          return selector % 2 === 0 ? (
            <Rect key={`${column}-${row}`} x={gx} y={gy} width={8} height={3} color={tone} opacity={0.28 + selector * 0.1} />
          ) : (
            <Line key={`${column}-${row}`} p1={vec(gx, gy)} p2={vec(gx + 8, gy + 6)} color={tone} opacity={0.45} strokeWidth={1} />
          );
        }),
      )}

      {building.antenna > 0 ? (
        <>
          <Line
            p1={vec(building.x + building.width / 2, top)}
            p2={vec(building.x + building.width / 2, top - building.antenna)}
            color={tertiary}
            opacity={0.75}
            strokeWidth={1.5}
          />
          <Circle
            cx={building.x + building.width / 2}
            cy={top - building.antenna}
            r={2.8}
            color={tertiary}
            opacity={lightOpacity}
          >
            <BlurMask blur={7} style="solid" />
          </Circle>
        </>
      ) : null}
    </Group>
  );
}

function Vehicle({
  index,
  color,
  speed,
  width,
  height,
}: {
  index: number;
  color: string;
  speed: number;
  width: number;
  height: number;
}) {
  const clock = useClock();
  const x = useDerivedValue(() => {
    const travel = ((clock.value / 1000) * (90 + index * 13) * speed + index * 210) % (width + 180);
    return travel - 90;
  });
  const transform = useDerivedValue(() => [{ translateX: x.value }]);
  const y = height * (0.14 + index * 0.08);

  return (
    <Group transform={transform}>
      <Line p1={vec(-70, y)} p2={vec(0, y)} color={color} opacity={0.24} strokeWidth={2}>
        <BlurMask blur={7} style="solid" />
      </Line>
      <Rect x={0} y={y - 4} width={38} height={8} color={color} opacity={0.92}>
        <BlurMask blur={5} style="solid" />
      </Rect>
    </Group>
  );
}

export default function GlyphCitySkia({
  className,
  children,
  variant = 'downtown',
  colorPrimary = '#00f3ff',
  colorSecondary = '#ff8a00',
  colorTertiary = '#fff3a3',
  backgroundColor = 'transparent',
  speed = 1,
  showVehicles = true,
  blinkingLights = true,
  opacity = 0.92,
}: GlyphCityProps) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const { width, height } = size;
  const buildings = useMemo(() => buildCity(width, height, variant), [height, variant, width]);
  const palette = [colorPrimary, colorSecondary, colorTertiary];

  return (
    <View
      className={`relative flex-1 overflow-hidden ${className ?? ''}`}
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        if (next.width !== width || next.height !== height) setSize({ width: next.width, height: next.height });
      }}
    >
      <Canvas pointerEvents="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {backgroundColor !== 'transparent' ? <Fill color={backgroundColor} /> : null}
        <Group opacity={opacity}>
          <Line p1={vec(0, height - 1)} p2={vec(width, height - 1)} color={colorPrimary} opacity={0.45} strokeWidth={2} />
          {buildings.map((building) => (
            <BuildingNode
              key={building.seed}
              building={building}
              ground={height}
              palette={palette}
              tertiary={colorTertiary}
              blinkingLights={blinkingLights}
            />
          ))}
          {showVehicles ? (
            <>
              <Vehicle index={0} color={colorSecondary} speed={speed} width={width} height={height} />
              <Vehicle index={1} color={colorPrimary} speed={speed * 0.82} width={width} height={height} />
              <Vehicle index={2} color={colorTertiary} speed={speed * 1.1} width={width} height={height} />
            </>
          ) : null}
        </Group>
      </Canvas>
      {children}
    </View>
  );
}
