import type { WorkspaceDefinition } from '@viro-external/xr-contract';
import {
  resolveMetaWorkspace,
  type MetaWorkspaceEntry,
  type MetaWorkspaceResolution,
} from '@viro-external/meta-layout';

/** Stable surface ids. Meta uses them as `SpatialWindow` labels. */
export const EXPLORE_SURFACE = {
  map: 'map',
  discover: 'discover',
  placeDetail: 'place-detail',
} as const;

/** The selection key Place Detail's lifecycle follows (`useExplore().selectedPlaceId`). */
export const PLACE_SELECTION = 'place';

/**
 * The Explore workspace on Meta Horizon OS (DECISIONS S4, S5; design
 * handoff §1). The map is the main window and never promoted. Discover sits
 * start-side and Place Detail end-side, each 600 dp tall so their edges line
 * up around the 800 dp main window. Detail outranks Discover (20 vs 10), so
 * if the OS grants one slot, the window the user just asked for wins. Detail
 * exists only while a place is selected, so it never shows empty. Both fall
 * back inline into the SplitView panes they already occupy.
 *
 * The Mights assistant is not here: it stays inline in the main window and
 * never claims a slot (S7).
 */
export const EXPLORE_WORKSPACE: WorkspaceDefinition = {
  id: 'harlem-explore',
  surfaces: [
    {
      id: EXPLORE_SURFACE.map,
      role: 'main',
      presentation: { kind: 'main' },
      fallback: { kind: 'inline', region: 'overlay' },
      requires: { kind: 'none' },
      focus: { focus: 'primary', back: 'exit' },
      lifecycle: { owner: 'workspace' },
    },
    {
      id: EXPLORE_SURFACE.discover,
      role: 'discover',
      presentation: {
        kind: 'window',
        size: { unit: 'dp', width: 360, height: 600 },
        anchor: { side: 'start', depth: 'near' },
        priority: 10,
      },
      fallback: { kind: 'inline', region: 'leading' },
      requires: { kind: 'none' },
      focus: { focus: 'passive', back: 'return-to-main' },
      lifecycle: { owner: 'workspace' },
    },
    {
      id: EXPLORE_SURFACE.placeDetail,
      role: 'detail',
      presentation: {
        kind: 'window',
        size: { unit: 'dp', width: 440, height: 600 },
        anchor: { side: 'end', depth: 'near' },
        priority: 20,
      },
      fallback: { kind: 'inline', region: 'trailing' },
      requires: { kind: 'none' },
      focus: { focus: 'take-on-open', back: 'close' },
      lifecycle: { owner: 'selection', selectionKey: PLACE_SELECTION },
    },
  ],
};

/**
 * What the Explore workspace renders right now. Pure: the selected place
 * comes from `useExplore`, spatial availability from `useSpatialScene`.
 */
export function resolveExploreWorkspace(input: {
  selectedPlaceId: string | null;
  isSpatialAvailable: boolean;
}): MetaWorkspaceResolution {
  return resolveMetaWorkspace(
    {
      definition: EXPLORE_WORKSPACE,
      activity: {
        selections: input.selectedPlaceId == null ? [] : [PLACE_SELECTION],
        openSurfaceIds: [],
      },
    },
    { isSpatialAvailable: input.isSpatialAvailable },
  );
}

/** The entry for one surface, or undefined when the resolution omitted it. */
export function findExploreEntry(
  resolution: MetaWorkspaceResolution,
  surfaceId: string,
): MetaWorkspaceEntry | undefined {
  return resolution.entries.find((entry) => entry.surface.id === surfaceId);
}
