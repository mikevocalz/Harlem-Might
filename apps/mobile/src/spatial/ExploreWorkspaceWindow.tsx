import { createContext, useContext, type ReactNode } from 'react';
import type { MetaWorkspaceResolution } from '@viro-external/meta-layout';
import { ExploreTypeContext } from '@acme/app';
import { findExploreEntry } from './exploreWorkspace';
import { useHostedSpatialWindow } from './useHostedSpatialWindow';

/**
 * The Explore workspace resolution, computed once per render by the Explore
 * layout and read by every surface below it, so the layout and the detail
 * route agree on what is a window.
 */
export const ExploreWorkspaceContext = createContext<MetaWorkspaceResolution | null>(null);

/**
 * Renders one Explore surface. No surface resolves to a window today
 * (DECISIONS S17, S18; ADR 0005), so this renders its children in place.
 *
 * When a resolution does make a surface a window, the content goes to
 * `SpatialWindowHost` at the main surface's origin, where presses inside a
 * promoted window work (ADR 0005), and this spot renders it in place only
 * while the window is not `spatial`. The hosted copy loses this position's
 * providers, so it gets the Horizon type scale here.
 *
 * @throws When rendered outside {@linkcode ExploreWorkspaceContext}.
 */
export function ExploreWorkspaceWindow({
  surfaceId,
  children,
}: {
  surfaceId: string;
  children: ReactNode;
}) {
  const resolution = useContext(ExploreWorkspaceContext);
  if (!resolution) {
    throw new Error(
      `<ExploreWorkspaceWindow surfaceId="${surfaceId}"> must be rendered inside ExploreWorkspaceContext.`,
    );
  }
  const entry = findExploreEntry(resolution, surfaceId);
  const placement = useHostedSpatialWindow(
    entry?.kind === 'window' ? entry.window : null,
    <ExploreTypeContext.Provider value="xr">{children}</ExploreTypeContext.Provider>,
  );
  if (placement === 'spatial') return null;
  return <>{children}</>;
}
