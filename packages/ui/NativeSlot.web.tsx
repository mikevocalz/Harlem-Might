'use client';
import type { ReactElement } from 'react';

export interface NativeSlotProps {
  children: ReactElement;
  matchContents?: boolean;
}

/** Web has no native tree to bridge into — the child renders as-is. */
export function NativeSlot({ children }: NativeSlotProps) {
  return children;
}
