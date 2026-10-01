'use client';
import type { ReactNode } from 'react';
import { View } from '@acme/ui/tw';

export interface EventDragProps {
  children: ReactNode;
  /** Absolute geometry, in px. Owned here so the native fork can animate it. */
  top: number;
  height: number;
  left: number;
  width: number;
  /** Called once on release with the total vertical offset in px. */
  onCommit: (deltaY: number) => void;
  /** Pixel height of one snap increment, so the drag steps between slots. */
  snapPx: number;
  enabled?: boolean;
}

/**
 * Web fork — positions the block, but mounts no gesture.
 *
 * Rescheduling on web is keyboard-driven (Arrow Up/Down on a focused block), so
 * react-native-gesture-handler and Reanimated stay out of the Next bundle,
 * which lists neither in `transpilePackages` and has no GestureHandlerRootView.
 */
export function EventDrag({ children, top, height, left, width }: EventDragProps) {
  return (
    <View style={{ position: 'absolute', top, height, left, width }}>{children}</View>
  );
}
