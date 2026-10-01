'use client';
/**
 * PLATFORM FORK — the styling boundary for web.
 *
 * Uniwind is Metro/Vite-only (docs.uniwind.dev/faq: "Next.js — not officially
 * supported"), so the web build still resolves classNames through
 * react-native-css's useCssElement, which converts className into the styleq
 * `style` array react-native-web understands. The native fork uses Uniwind's
 * withUniwind HOC instead.
 *
 * `extra` maps additional className props onto their style props (native gets
 * these for free — withUniwind derives them from the component's own props).
 */
import React from 'react';
import { useCssElement } from 'react-native-css';

export type CN = { className?: string };

const CLASS_NAME_TO_STYLE = { className: 'style' } as const;

export function css<P extends object>(
  Component: React.ComponentType<P>,
  displayName: string,
  extra?: Record<string, string>,
) {
  const mapping = extra ? { ...CLASS_NAME_TO_STYLE, ...extra } : CLASS_NAME_TO_STYLE;
  const Wrapped = (props: P & CN) =>
    useCssElement(Component as React.ComponentType<object>, props as object, mapping as never);
  Wrapped.displayName = `CSS(${displayName})`;
  return Wrapped as React.FC<P & CN>;
}
