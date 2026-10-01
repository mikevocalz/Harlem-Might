'use client';
/**
 * PLATFORM FORK — the Uniwind styling boundary for native.
 *
 * Uniwind's withUniwind is a module-level HOC (not a render-time hook like
 * NativeWind v5's useCssElement), so this fork has no hook at all — the §7
 * zero-hook rule now holds for the primitives without an exception.
 *
 * withUniwind derives the className props from the component's own style/color
 * props: `style` → `className`, `contentContainerStyle` →
 * `contentContainerClassName`, `tintColor` → `tintColorClassName`, and so on.
 * That is why `extra` is web-only — nothing to declare here.
 */
import React from 'react';
import { withUniwind } from 'uniwind';

export type CN = { className?: string };

export function css<P extends object>(
  Component: React.ComponentType<P>,
  displayName: string,
  _extra?: Record<string, string>,
) {
  const Wrapped = withUniwind(Component as never) as unknown as React.FC<P & CN>;
  Wrapped.displayName = `CSS(${displayName})`;
  return Wrapped;
}
