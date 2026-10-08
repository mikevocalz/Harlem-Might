import { createContext, useContext, type ReactNode } from 'react';
import type { MetaWorkspaceResolution } from '@viro-external/meta-layout';
import { findExploreEntry } from './exploreWorkspace';
import { metaWindows } from './metaWindows';

/**
 * The Explore workspace resolution, computed once per render by the Explore
 * layout and read by every surface below it, so the layout and the detail
 * route agree on what is a window.
 */
export const ExploreWorkspaceContext = createContext<MetaWorkspaceResolution | null>(null);

/**
 * Renders one Explore surface where it is declared. No surface resolves to
 * a window today (DECISIONS S17), so this renders its children in place; it
 * stays at Place Detail's tree position for the deferred "Open in new window"
 * (ADR 0004). When a resolution does make a surface a
 * window, the content goes through `<SpatialWindow>` with the resolved
 * props; Meta then shows it inline at this spot until the OS promotes it, so
 * the content is never rendered twice. Inline and omitted surfaces render
 * their children here unchanged.
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
  if (entry?.kind === 'window') {
    return <metaWindows.Window window={entry.window}>{children}</metaWindows.Window>;
  }
  return <>{children}</>;
}
