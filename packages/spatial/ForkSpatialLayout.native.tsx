'use client';

import type { ComponentType, ReactNode } from 'react';
import * as Viro from '@reactvision/react-viro';

type ProviderProps = { children?: ReactNode; [key: string]: unknown };
type WindowProps = {
  children?: ReactNode;
  label: string;
  windowWidth: number;
  windowHeight: number;
  fallback?: 'inline' | 'drop';
  priority?: number;
  anchor?: unknown;
  [key: string]: unknown;
};

type ForkExports = {
  ViroSpatialSceneProvider?: ComponentType<ProviderProps>;
  ViroSpatialWindow?: ComponentType<WindowProps>;
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
 * One layout contract across all hosts.
 *
 * - User fork + Meta Horizon OS: delegates to Meta VR Layout SDK.
 * - Pico/OpenXR, ordinary Android/iOS and web: children remain inline and the
 *   immersive Viro scene owns spatial placement.
 */
export function ForkSpatialLayout({
  children,
  panel,
}: {
  children: ReactNode;
  panel?: ReactNode;
}) {
  const Provider = fork.ViroSpatialSceneProvider;
  const SpatialWindow = fork.ViroSpatialWindow;

  if (!Provider || !SpatialWindow) {
    return <>{children}{panel}</>;
  }

  return (
    <Provider>
      {children}
      {panel ? (
        <SpatialWindow
          label="harlem-might-tools"
          windowWidth={420}
          windowHeight={560}
          fallback="inline"
          priority={1}
        >
          {panel}
        </SpatialWindow>
      ) : null}
    </Provider>
  );
}
