import type { WorkspaceDefinition } from '@viro-external/xr-contract';
import {
  META_OFFSET_STEPS,
  resolveMetaWorkspace,
  type MetaLogicalOffset,
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
 * Place Detail's offset: one step outward from the main window's end edge (a
 * negative `start` moves an end-anchored window away from start) and one step
 * toward the user, which is Meta's own example for an end window.
 *
 * `WorkspaceAnchorIntent` in viro-external has `depth` but no horizontal gap
 * tier, so the resolver emits `{ z: 1 }` only. Until that contract grows a
 * gap, this app passes Meta's exact prop here. Both keys are logical, so the
 * SDK logs no ModeMismatch (LAYOUT_RESEARCH.md §1.2, §5).
 */
export const PLACE_DETAIL_OFFSET: MetaLogicalOffset = {
  // -OffsetNear. TypeScript widens a negated constant to number, so the step is
  // spelled out; the test pins it to -META_OFFSET_STEPS.near.
  start: -1,
  z: META_OFFSET_STEPS.near,
};

/**
 * The Explore workspace on Meta Horizon OS (DECISIONS S4, S5, S12; design
 * handoff §1). Meta's "Primary content and details" pattern: the item list
 * and selection stay in the primary window, and the detail sits beside it.
 *
 * - The map is the main window and is never promoted.
 * - Discover is the item list, so it is a layer in the main window's leading
 *   pane. It never asks for a window. Struck as a window on 2026-10-08 (S12):
 *   at 360x600 beside a 1280 dp main window it overlapped the map on the
 *   Quest 3S, and it cost Detail a slot.
 * - Place Detail is the only supporting window: 440x600 dp on the main
 *   window's end edge, priority 10, mounted only while a place is selected,
 *   falling back inline into the trailing pane.
 *
 * The Mights assistant is not here: it stays inline in the main window and
 * never claims a slot (S7).
 */
export const EXPLORE_WORKSPACE: WorkspaceDefinition = {
  id: 'harlem-explore',
  maxPromotedSurfaces: 1,
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
      presentation: {
        kind: 'window',
        size: { unit: 'dp', width: 440, height: 600 },
        // Offset is overridden with PLACE_DETAIL_OFFSET in resolveExploreWorkspace.
        anchor: { side: 'end', depth: 'near' },
        priority: 10,
      },
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
}): MetaWorkspaceResolution {
  const resolution = resolveMetaWorkspace(
    {
      definition: EXPLORE_WORKSPACE,
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
