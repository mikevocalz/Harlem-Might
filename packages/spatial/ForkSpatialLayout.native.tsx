'use client';

import type { ComponentType, ReactNode } from 'react';
import * as Viro from '@reactvision/react-viro';

type ForkExports = {
  getViroSpatialLayoutSupport?: () => {
    platform: string;
    nativeSpatialLayoutAvailable: boolean;
  };
  ViroRivePanel?: ComponentType<Record<string, unknown>>;
};

const fork = Viro as unknown as typeof Viro & ForkExports;

export function getSpatialForkCapabilities() {
  const support = fork.getViroSpatialLayoutSupport?.();
  return {
    metaSpatialWindows: support?.nativeSpatialLayoutAvailable === true,
    viroRivePanel: typeof fork.ViroRivePanel === 'function',
    platform: support?.platform ?? 'fallback',
  };
}

/**
 * Lays out the Spatial screen and its tools panel inline, in one window.
 *
 * The tools panel used to request its own Meta window here under a second
 * scene provider. Struck 2026-10-08 (DECISIONS S6): the app mounts one
 * provider in apps/mobile/app/_layout.tsx and the two window slots belong to
 * Explore's Discover and Place Detail.
 */
export function ForkSpatialLayout({
  children,
  panel,
}: {
  children: ReactNode;
  panel?: ReactNode;
}) {
  return <>{children}{panel}</>;
}
