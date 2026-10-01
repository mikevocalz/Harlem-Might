'use client';
import { RNHostView } from '@expo/ui';
import type { ReactElement } from 'react';

export interface NativeSlotProps {
  children: ReactElement;
  /** Size to the child rather than filling the native container. */
  matchContents?: boolean;
}

/**
 * Embeds React Native content INSIDE an `@expo/ui` tree.
 *
 * The native containers in this kit — List, FieldGroup, Collapsible — lay out
 * native views, so their children normally have to be `@expo/ui` components,
 * which would put every list row outside the className system. `RNHostView` is
 * the inverse of `Host`: it opens a window back into React Native, so a row can
 * hold kit components (Avatar, Text, Badge) styled with Tailwind while the
 * container around it stays the platform's own.
 *
 * It takes a single element, not a fragment — the native side needs one view to
 * measure.
 */
export function NativeSlot({ children, matchContents = true }: NativeSlotProps) {
  return <RNHostView matchContents={matchContents}>{children}</RNHostView>;
}
