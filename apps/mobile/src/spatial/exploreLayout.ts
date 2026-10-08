import { contentWidths } from '@acme/theme';
import type { MetaWindowPlacement } from '@viro-external/meta-layout';
import type { WindowSizeClass } from '../navigation/split-view/constants.ts';

/**
 * Where one Explore pane sits in the main window. Every mode keeps the pane
 * MOUNTED at the same tree position, so a `<SpatialWindow>` inside never
 * unregisters and scroll state survives a resize.
 *
 * - `tiled`: in the row beside the map, `width` dp.
 * - `overlay`: drawn over the map's edge, `width` dp; the map pads its markers.
 * - `screen`: fills the window in place of the map (compact).
 * - `collapsed`: zero width, hidden from touch and screen readers.
 * - `promoted`: zero width; the content shows in its own Horizon window.
 */
export type ExplorePaneMode =
  | { kind: 'tiled'; width: number }
  | { kind: 'overlay'; width: number }
  | { kind: 'screen' }
  | { kind: 'collapsed' }
  | { kind: 'promoted' };

/**
 * Which full-screen pane a compact window shows. `detail` applies only while
 * a place is selected; with no selection it falls back to the map.
 */
export type CompactPane = 'map' | 'discover' | 'detail';

export interface ExploreLayoutInput {
  sizeClass: WindowSizeClass;
  /** `useExplore().selectedPlaceId != null`. Detail exists only then (DECISIONS S5). */
  hasSelection: boolean;
  /** `useSpatialWindowState('discover').placement`. */
  discoverPlacement: MetaWindowPlacement;
  /** `useSpatialWindowState('place-detail').placement`. */
  detailPlacement: MetaWindowPlacement;
  /** A quest build: large windows give Detail the 440dp Horizon width. */
  isHorizon: boolean;
  compactPane: CompactPane;
  /** Medium only: the Discover drawer is open. */
  discoverDrawerOpen: boolean;
}

export interface ExploreLayout {
  discover: ExplorePaneMode;
  /** `null` while nothing is selected: Detail is not mounted at all. */
  detail: ExplorePaneMode | null;
  /** False on compact while Discover or Detail covers the window. */
  showMap: boolean;
  /** dp the map's markers keep clear of on each side, for overlay panes. */
  mapInsets: { left: number; right: number };
  /** The map offers a "Places" button (Discover is reachable only through it). */
  showPlacesToggle: boolean;
  /** Discover offers a "Map" button (it is covering the map). */
  showMapToggle: boolean;
  /** Detail's dismiss control: X beside the map, Back where it covers it. */
  detailDismiss: 'close' | 'back';
  /** Detail offers "Show on map" (the map is not visible beside it). */
  showOnMapInDetail: boolean;
  /** Assistant shape: a sheet across the map on compact, else a 400dp panel. */
  assistant: 'panel' | 'sheet';
}

/** Reads a `'320px'`-style width token as dp. */
function tokenDp(token: keyof typeof contentWidths): number {
  const value = contentWidths[token];
  if (!value.endsWith('px')) {
    throw new Error(`contentWidths['${token}'] is ${value}; Explore pane widths must be px.`);
  }
  return Number.parseFloat(value);
}

/** Explore pane widths in dp, from `@acme/theme` `contentWidths`. */
export const EXPLORE_PANE_DP = {
  discover: tokenDp('pane-discover'),
  discoverNarrow: tokenDp('pane-discover-narrow'),
  detail: tokenDp('pane-detail'),
  detailXr: tokenDp('pane-detail-xr'),
} as const;

const isSpatial = (placement: MetaWindowPlacement) => placement === 'spatial';

/**
 * The Explore layout for one window (design handoff §4). Rules:
 *
 * - M1: the map is the widest visible pane. It takes the flex region; Discover
 *   and Detail are fixed widths, and Detail overlays instead of tiling where
 *   tiling would squeeze the map (medium, expanded).
 * - M3 / S5: no selection, no Detail.
 * - A pane shown in its own Horizon window is `promoted`, and the map takes
 *   its width. `pending` renders inline, so a slow promotion never blanks it.
 * - Discover stays mounted on every size class, including compact, so
 *   shrinking the main window never unregisters its window.
 */
export function resolveExploreLayout(input: ExploreLayoutInput): ExploreLayout {
  const { sizeClass, hasSelection, isHorizon } = input;
  const compact = sizeClass === 'compact';

  let detail: ExplorePaneMode | null = null;
  if (hasSelection) {
    if (isSpatial(input.detailPlacement)) detail = { kind: 'promoted' };
    else if (compact) detail = input.compactPane === 'detail' ? { kind: 'screen' } : { kind: 'collapsed' };
    else if (sizeClass === 'medium' || sizeClass === 'expanded') {
      detail = { kind: 'overlay', width: EXPLORE_PANE_DP.detail };
    } else if (sizeClass === 'large') {
      detail = { kind: 'tiled', width: isHorizon ? EXPLORE_PANE_DP.detailXr : EXPLORE_PANE_DP.detail };
    } else {
      detail = { kind: 'tiled', width: EXPLORE_PANE_DP.detailXr };
    }
  }

  const detailCoversWindow = detail?.kind === 'screen';

  let discover: ExplorePaneMode;
  if (isSpatial(input.discoverPlacement)) discover = { kind: 'promoted' };
  else if (compact) {
    discover = input.compactPane === 'discover' && !detailCoversWindow ? { kind: 'screen' } : { kind: 'collapsed' };
  } else if (sizeClass === 'medium') {
    discover = input.discoverDrawerOpen
      ? { kind: 'overlay', width: EXPLORE_PANE_DP.discover }
      : { kind: 'collapsed' };
  } else if (sizeClass === 'expanded') {
    discover = { kind: 'tiled', width: EXPLORE_PANE_DP.discoverNarrow };
  } else {
    discover = { kind: 'tiled', width: EXPLORE_PANE_DP.discover };
  }

  const showMap = !(discover.kind === 'screen' || detailCoversWindow);
  const discoverReachableOnlyByToggle =
    discover.kind !== 'promoted' && (compact || sizeClass === 'medium');

  return {
    discover,
    detail,
    showMap,
    mapInsets: {
      left: discover.kind === 'overlay' ? discover.width : 0,
      right: detail?.kind === 'overlay' ? detail.width : 0,
    },
    showPlacesToggle: showMap && discoverReachableOnlyByToggle && discover.kind !== 'overlay',
    showMapToggle: discover.kind === 'screen' || discover.kind === 'overlay',
    detailDismiss: detailCoversWindow ? 'back' : 'close',
    showOnMapInDetail: detailCoversWindow,
    assistant: compact ? 'sheet' : 'panel',
  };
}

/** Width in dp a pane takes out of the main window's row. */
export function paneRowWidth(mode: ExplorePaneMode | null): number {
  return mode?.kind === 'tiled' ? mode.width : 0;
}

/** What Back does in Explore, most transient surface first (handoff §1). */
export type ExploreBackAction = 'close-assistant' | 'close-detail' | 'show-map' | 'close-drawer';

/**
 * Back closes the assistant panel, then Detail, then a Discover screen or
 * drawer that covers the map. `null` means Explore has nothing to close and
 * the system handles Back.
 */
export function exploreBackAction(input: {
  assistantOpen: boolean;
  layout: ExploreLayout;
}): ExploreBackAction | null {
  if (input.assistantOpen) return 'close-assistant';
  if (input.layout.detail) return 'close-detail';
  if (input.layout.discover.kind === 'screen') return 'show-map';
  if (input.layout.discover.kind === 'overlay') return 'close-drawer';
  return null;
}
