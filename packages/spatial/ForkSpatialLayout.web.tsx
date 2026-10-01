'use client';

import type { ReactNode } from 'react';

export function getSpatialForkCapabilities() {
  return {
    metaSpatialWindows: false,
    viroRivePanel: false,
    platform: 'web',
  };
}

/**
 * Meta's system spatial windows do not exist in a browser. Web keeps the same
 * app-facing layout contract and renders the tools inline while the Viro scene
 * owns immersive placement.
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
