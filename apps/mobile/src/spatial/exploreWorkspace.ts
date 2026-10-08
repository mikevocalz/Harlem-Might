import type { WorkspaceDefinition, WorkspaceWindowPresentation } from '@viro-external/xr-contract';
import {
  META_OFFSET_STEPS,
  resolveMetaWorkspace,
  type MetaNeutralOffset,
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
 * Place Detail's window offset, kept for the DEFERRED "Open in new window"
 * action (DECISIONS S17, docs/spatial-layout/adr/0004-detail-in-window.md).
 * One step toward the user and no horizontal shift: on a Quest 3S (Horizon OS
 * 207) an extra `start: -OffsetNear` pulled the window back over the map.
 */
export const PLACE_DETAIL_OFFSET: MetaNeutralOffset = {
  z: META_OFFSET_STEPS.near,
};

/**
 * Place Detail as its own window: 440x600 dp on the main window's end edge,
 * priority 10. NOT used by {@linkcode EXPLORE_WORKSPACE}. It is the
 * presentation an explicit "Open in new window" command would swap in once
 * the blocker in ADR 0004 is fixed: inside a promoted window, Meta's
 * `SpatialWindowRootViewGroup` reports window-relative `pageX/pageY`, while
 * RN's Pressability measures the responder region in main-surface
 * coordinates, so every move reads as leaving the press rect and cancels the
 * press. Close and Get directions did nothing on the Quest 3S.
 */
export const PLACE_DETAIL_WINDOW: WorkspaceWindowPresentation = {
  kind: 'window',
  size: { unit: 'dp', width: 440, height: 600 },
  // The offset is overridden with PLACE_DETAIL_OFFSET in resolveExploreWorkspace.
  anchor: { side: 'end', depth: 'near' },
  priority: 10,
};

/**
 * The Explore workspace on Meta Horizon OS (DECISIONS S4, S5, S12, S17;
 * design handoff §1). Everything lives in ONE main window: Discover 360 |
 * map | Detail 400 (S17). Meta, Apple and Google all put supplementary
 * detail in a split inside the window, and Meta's anchors carry no collision
 * guarantee: on the Quest 3S every offset tried put the Detail window over
 * the map.
 *
 * - The map is the main window and is never promoted.
 * - Discover is a layer in the main window's leading column (S12).
 * - Place Detail is a layer in the trailing column, mounted only while a
 *   place is selected (S5). `maxPromotedSurfaces: 0` states that nothing
 *   asks for a window by default.
 *
 * The Mights assistant is not here: it stays inline in the main window and
 * never claims a slot (S7).
 */
export const EXPLORE_WORKSPACE: WorkspaceDefinition = {
  id: 'harlem-explore',
  maxPromotedSurfaces: 0,
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
      presentation: { kind: 'layer', region: 'leading' },
      fallback: { kind: 'inline', region: 'leading' },
      requires: { kind: 'none' },
      focus: { focus: 'passive', back: 'return-to-main' },
      lifecycle: { owner: 'workspace' },
    },
    {
      id: EXPLORE_SURFACE.placeDetail,
      role: 'detail',
      presentation: { kind: 'layer', region: 'trailing' },
      fallback: { kind: 'inline', region: 'trailing' },
      requires: { kind: 'none' },
      focus: { focus: 'take-on-open', back: 'close' },
      lifecycle: { owner: 'selection', selectionKey: PLACE_SELECTION },
    },
  ],
};

function withPlaceDetailOffset(entry: MetaWorkspaceEntry): MetaWorkspaceEntry {
  if (entry.kind !== 'window' || entry.surface.id !== EXPLORE_SURFACE.placeDetail) return entry;
  return { ...entry, window: { ...entry.window, offset: PLACE_DETAIL_OFFSET } };
}

/**
 * What the Explore workspace renders right now. Pure: the selected place
 * comes from `useExplore`, spatial availability from `useSpatialScene`.
 */
export function resolveExploreWorkspace(input: {
  selectedPlaceId: string | null;
  isSpatialAvailable: boolean;
  /** Defaults to {@linkcode EXPLORE_WORKSPACE}; tests pass the deferred window variant. */
  definition?: WorkspaceDefinition;
}): MetaWorkspaceResolution {
  const resolution = resolveMetaWorkspace(
    {
      definition: input.definition ?? EXPLORE_WORKSPACE,
      activity: {
        selections: input.selectedPlaceId == null ? [] : [PLACE_SELECTION],
        openSurfaceIds: [],
      },
    },
    { isSpatialAvailable: input.isSpatialAvailable },
  );
  return { ...resolution, entries: resolution.entries.map(withPlaceDetailOffset) };
}

/** The entry for one surface, or undefined when the resolution omitted it. */
export function findExploreEntry(
  resolution: MetaWorkspaceResolution,
  surfaceId: string,
): MetaWorkspaceEntry | undefined {
  return resolution.entries.find((entry) => entry.surface.id === surfaceId);
}
