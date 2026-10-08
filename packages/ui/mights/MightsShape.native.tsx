'use client';
import { useCallback, useState } from 'react';
import { Pressable, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Link } from 'solito/link';
import { useCSSVariable } from 'uniwind';
import { css } from '../html/css';
import type { Size } from './geometry.native';

// Shared plumbing for the native Mights forks: measure a box, then paint the
// cut silhouette behind its content as stacked SVG layers. Each layer is one
// path at an inset, which reproduces the web's "clipped box inside a clipped
// box" rails without clip-path.

/**
 * React Native's Pressable with a className. The kit's `tw` Pressable is typed
 * from its web fork (a real <button>), which has no onPressIn/onPressOut; the
 * cut shapes need those to repaint their SVG fills while pressed, and SVG
 * fills cannot follow an `active:` class.
 */
export const PressableSurface = css(Pressable, 'MightsPressable');

/** Props {@linkcode PressableLink} accepts: a solito `href` plus Pressable's own. */
export type PressableLinkProps = Omit<React.ComponentProps<typeof Pressable>, 'onPress' | 'children' | 'role'> & {
  href: string;
  children: React.ReactNode;
};

/**
 * solito's `Link` with a className. Every route in the kit goes through solito
 * (expo-router on native, next/link on web); absolute URLs open in the system
 * browser. On native, solito 5's Link renders React Native's Pressable and
 * spreads every extra prop onto it (build/link/core.native.js), so press-in,
 * hit slop and accessibility props reach the Pressable. Its published type is
 * the Next.js link props, hence the cast.
 */
export const PressableLink = css(
  Link as unknown as React.ComponentType<PressableLinkProps>,
  'MightsLink',
);

/** One filled path in a {@linkcode MightsShape}, painted in array order. */
export interface ShapeLayer {
  /** Distance from every edge, in dp. 0 = the outer silhouette. */
  inset: number;
  /** Resolved colour, from {@linkcode useMightsColors}. */
  color: string;
  /** 0–1; stands in for the web's `/70`-style alpha modifiers. */
  opacity?: number;
}

/** Tracks a view's size from `onLayout`; undefined until the first layout. */
export function useLayoutSize(): [Size | undefined, (event: LayoutChangeEvent) => void] {
  const [size, setSize] = useState<Size>();
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);
  return [size, onLayout];
}

const TOKENS = [
  '--color-primary',
  '--color-primary-pressed',
  '--color-surface',
  '--color-surface-raised',
  '--color-border-strong',
  '--color-rule-rail',
  '--color-accent',
] as const;

/** Semantic colours the SVG layers need. SVG fills cannot take a className. */
export interface MightsColors {
  primary: string;
  primaryPressed: string;
  surface: string;
  surfaceRaised: string;
  borderStrong: string;
  ruleRail: string;
  accent: string;
}

// An unresolved token paints nothing rather than react-native-svg's default
// black; Uniwind already logs the missing variable in development.
const color = (value: string | number | undefined) => (value === undefined ? 'transparent' : String(value));

/** Reads the active theme's semantic colours, re-rendering on theme change. */
export function useMightsColors(): MightsColors {
  const [primary, primaryPressed, surface, surfaceRaised, borderStrong, ruleRail, accent] = useCSSVariable([...TOKENS]);
  return {
    primary: color(primary),
    primaryPressed: color(primaryPressed),
    surface: color(surface),
    surfaceRaised: color(surfaceRaised),
    borderStrong: color(borderStrong),
    ruleRail: color(ruleRail),
    accent: color(accent),
  };
}

/**
 * Paints `layers` behind its siblings, filling the parent absolutely. Render
 * it as the first child of a measured, relatively positioned view.
 */
export function MightsShape({
  size,
  path,
  layers,
}: {
  size: Size | undefined;
  path: (size: Size, inset: number) => string;
  layers: readonly ShapeLayer[];
}) {
  if (!size || size.width <= 0 || size.height <= 0) return null;
  return (
    <Svg
      width={size.width}
      height={size.height}
      style={{ position: 'absolute', left: 0, top: 0 }}
      pointerEvents="none"
      accessible={false}
    >
      {layers.map((layer, i) => (
        <Path key={i} d={path(size, layer.inset)} fill={layer.color} fillOpacity={layer.opacity ?? 1} />
      ))}
    </Svg>
  );
}
