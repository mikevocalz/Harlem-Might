'use client';

import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Navigation,
  RotateCw,
  Undo2,
} from '@acme/ui/icons';
import { View } from '@acme/ui/tw';
import type { ManeuverGlyph } from '../view/maneuver';

const ICONS = {
  depart: Navigation,
  straight: ArrowUp,
  'slight-left': ArrowUpLeft,
  left: CornerUpLeft,
  'sharp-left': CornerUpLeft,
  'slight-right': ArrowUpRight,
  right: CornerUpRight,
  'sharp-right': CornerUpRight,
  uturn: Undo2,
  roundabout: RotateCw,
  arrive: Flag,
} as const satisfies Record<ManeuverGlyph, unknown>;

export interface ManeuverIconProps {
  glyph: ManeuverGlyph;
  /** `hud` is the 48dp gold tile at the top of guidance; `row` the 24dp mark in the step list. */
  size?: 'hud' | 'row';
  /** Dims passed steps in the list. */
  muted?: boolean;
}

/**
 * The maneuver arrow. Decorative: every caller prints the instruction next
 * to it, so screen readers skip the icon.
 */
export function ManeuverIcon({ glyph, size = 'row', muted = false }: ManeuverIconProps) {
  const Icon = ICONS[glyph];
  if (size === 'hud') {
    return (
      <View aria-hidden className="size-target shrink-0 items-center justify-center bg-primary">
        <Icon size={28} strokeWidth={2.5} className="text-on-primary" />
      </View>
    );
  }
  return (
    <View aria-hidden className="size-6 shrink-0 items-center justify-center">
      <Icon size={20} strokeWidth={2.25} className={muted ? 'text-text-muted' : 'text-primary'} />
    </View>
  );
}
