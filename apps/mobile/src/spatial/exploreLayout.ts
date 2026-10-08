import { contentWidths, windowClass } from '@acme/theme';
import type { MetaWindowPlacement } from '@viro-external/meta-layout';
import { windowSizeClassForWidth } from '../navigation/split-view/constants.ts';

/**
 * Where one Explore pane sits in the main window. Every mode keeps the pane
 * MOUNTED at the same tree position, so scroll state survives a resize and a
 * `<SpatialWindow>` inside would never unregister.
 *
 * - `tiled`: in the row beside the map, `width` dp. The map narrows for it.
 * - `overlay`: drawn over the map's edge, `width` dp; the map pads its markers.
 *   Phones and tablets only: on Horizon nothing covers the map (S17).
 * - `screen`: fills the window in place of the map (single column).
 * - `collapsed`: zero width, hidden from touch and screen readers.
 * - `promoted`: zero width; the content shows in its own Horizon window.
 *   No surface is promoted today (DECISIONS S17, ADR 0004). The mode stays
 *   so an explicit "Open in new window" can return without a layout rewrite.
 */
export type ExplorePaneMode =
  | { kind: 'tiled'; width: number }
  | { kind: 'overlay'; width: number }
  | { kind: 'screen' }
  | { kind: 'collapsed' }
  | { kind: 'promoted' };

/**
 * Which full-screen pane a single-column window shows. `detail` applies only
 * while a place is selected; with no selection it falls back to the map.
 */
export type CompactPane = 'map' | 'discover' | 'detail';

/**
 * How Explore arranges its panes in the current window.
 *
 * - `single`: one pane at a time (phones below 600dp, Horizon below 840dp).
 * - `toggle`: the map is always visible; Discover opens from the map's
 *   "Places" button (a drawer over the map on tablets, a column that replaces
 *   Detail on Horizon).
 * - `columns`: Discover is a permanent column beside the map.
 */
export type ExploreArrangement = 'single' | 'toggle' | 'columns';

export interface ExploreLayoutInput {
  /** `useWindowDimensions().width` in dp. The Horizon window is user-resizable. */
  windowWidth: number;
  /** `useExplore().selectedPlaceId != null`. Detail exists only then (DECISIONS S5). */
  hasSelection: boolean;
  /** `useSpatialWindowState('place-detail').placement`; `inline` while nothing is promoted. */
  detailPlacement: MetaWindowPlacement;
  /** A quest build: the S17 three-column rules and Horizon widths apply. */
  isHorizon: boolean;
  compactPane: CompactPane;
  /** `toggle` arrangement only: the user opened Discover from the map's "Places" button. */
  discoverDrawerOpen: boolean;
}

/** A pane mode for a surface that never gets its own window (Discover, S12). */
export type InlinePaneMode = Exclude<ExplorePaneMode, { kind: 'promoted' }>;

export interface ExploreLayout {
  arrangement: ExploreArrangement;
  discover: InlinePaneMode;
  /** `null` while nothing is selected: Detail is not mounted at all. */
  detail: ExplorePaneMode | null;
  /** False in a single column while Discover or Detail covers the window. */
  showMap: boolean;
  /** dp the map's markers keep clear of on each side, for overlay panes. */
  mapInsets: { left: number; right: number };
  /** The map offers a "Places" button (Discover is reachable only through it). */
  showPlacesToggle: boolean;
  /**
   * How Discover hands the window back: `show-map` where it covers the map
   * (a phone screen or a tablet drawer), `close` where it is a column opened
   * from "Places" beside a visible map (Horizon), `null` where it is permanent.
   */
  discoverDismiss: 'show-map' | 'close' | null;
  /** Discover is showing because the user opened it from "Places"; Back closes it. */
  discoverFromToggle: boolean;
  /** Detail's dismiss control: X beside the map, Back where it covers it. */
  detailDismiss: 'close' | 'back';
  /** Detail offers "Show on map" (the map is not visible beside it). */
  showOnMapInDetail: boolean;
  /** Assistant shape: a sheet across the map in a single column, else a 400dp panel. */
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
  discoverXr: tokenDp('pane-discover-xr'),
  detailXr: tokenDp('pane-detail-xr'),
  mapMinXr: tokenDp('pane-map-min-xr'),
} as const;

/**
 * Horizon window-width breakpoints in dp (DECISIONS S17), from the theme's
 * window classes: below `toggle` a single column; from `columns` Discover is
 * a permanent column, as long as the map keeps {@linkcode EXPLORE_PANE_DP}
 * `mapMinXr`.
 */
export const HORIZON_BREAKPOINT_DP = {
  toggle: windowClass.expanded,
  columns: windowClass.large,
} as const;

const isSpatial = (placement: MetaWindowPlacement) => placement === 'spatial';

/**
 * The Explore layout for one window (design handoff §4, DECISIONS S17).
 *
 * - M1: the map is the widest visible pane and takes the flex region.
 * - M3 / S5: no selection, no Detail.
 * - Discover is the item list and stays in the main window on every build
 *   (S12). It stays mounted at every width, so scroll state survives a resize.
 * - A pane shown in its own Horizon window would be `promoted` and the map
 *   would take its width. Nothing is promoted today (S17).
 */
export function resolveExploreLayout(input: ExploreLayoutInput): ExploreLayout {
  return input.isHorizon ? resolveHorizonLayout(input) : resolveFlatLayout(input);
}

/**
 * Horizon (S17): one 1440x900dp window, Discover 360 | map | Detail 400.
 * Detail pushes the map narrower and never covers it.
 *
 * - ≥1200dp: Discover is a column. With a place selected it stays one only
 *   while the map keeps 600dp (window ≥1360dp); below that Discover folds
 *   behind "Places" so the map never drops under its minimum.
 * - 840–1199dp: Discover sits behind "Places". Opening it replaces Detail for
 *   the moment (the selection is kept), so there is at most one side column
 *   and the map keeps at least 440dp.
 * - <840dp: one pane at a time, as on a phone.
 */
function resolveHorizonLayout(input: ExploreLayoutInput): ExploreLayout {
  const { windowWidth, hasSelection } = input;
  if (windowWidth < HORIZON_BREAKPOINT_DP.toggle) return resolveSingleColumn(input);

  const detailPromoted = hasSelection && isSpatial(input.detailPlacement);
  const detailTakesRow = hasSelection && !detailPromoted;
  const mapWithThreeColumns =
    windowWidth - EXPLORE_PANE_DP.discoverXr - (detailTakesRow ? EXPLORE_PANE_DP.detailXr : 0);
  const arrangement: ExploreArrangement =
    windowWidth >= HORIZON_BREAKPOINT_DP.columns && mapWithThreeColumns >= EXPLORE_PANE_DP.mapMinXr
      ? 'columns'
      : 'toggle';

  const discoverFromToggle = arrangement === 'toggle' && input.discoverDrawerOpen;
  const discover: InlinePaneMode =
    arrangement === 'columns' || discoverFromToggle
      ? { kind: 'tiled', width: EXPLORE_PANE_DP.discoverXr }
      : { kind: 'collapsed' };

  let detail: ExplorePaneMode | null = null;
  if (detailPromoted) detail = { kind: 'promoted' };
  else if (hasSelection) {
    detail = discoverFromToggle ? { kind: 'collapsed' } : { kind: 'tiled', width: EXPLORE_PANE_DP.detailXr };
  }

  return {
    arrangement,
    discover,
    detail,
    showMap: true,
    mapInsets: { left: 0, right: 0 },
    showPlacesToggle: discover.kind === 'collapsed',
    discoverDismiss: discoverFromToggle ? 'close' : null,
    discoverFromToggle,
    detailDismiss: 'close',
    showOnMapInDetail: false,
    assistant: 'panel',
  };
}

/** Phones, tablets and the web-like flat build: Material width classes. */
function resolveFlatLayout(input: ExploreLayoutInput): ExploreLayout {
  const sizeClass = windowSizeClassForWidth(input.windowWidth);
  if (sizeClass === 'compact') return resolveSingleColumn(input);

  let detail: ExplorePaneMode | null = null;
  if (input.hasSelection) {
    if (isSpatial(input.detailPlacement)) detail = { kind: 'promoted' };
    else if (sizeClass === 'medium' || sizeClass === 'expanded') {
      detail = { kind: 'overlay', width: EXPLORE_PANE_DP.detail };
    } else if (sizeClass === 'large') {
      detail = { kind: 'tiled', width: EXPLORE_PANE_DP.detail };
    } else {
      detail = { kind: 'tiled', width: EXPLORE_PANE_DP.detailXr };
    }
  }

  let discover: InlinePaneMode;
  if (sizeClass === 'medium') {
    discover = input.discoverDrawerOpen
      ? { kind: 'overlay', width: EXPLORE_PANE_DP.discover }
      : { kind: 'collapsed' };
  } else if (sizeClass === 'expanded') {
    discover = { kind: 'tiled', width: EXPLORE_PANE_DP.discoverNarrow };
  } else {
    discover = { kind: 'tiled', width: EXPLORE_PANE_DP.discover };
  }

  const arrangement: ExploreArrangement = sizeClass === 'medium' ? 'toggle' : 'columns';
  const discoverFromToggle = discover.kind === 'overlay';

  return {
    arrangement,
    discover,
    detail,
    showMap: true,
    mapInsets: {
      left: discover.kind === 'overlay' ? discover.width : 0,
      right: detail?.kind === 'overlay' ? detail.width : 0,
    },
    showPlacesToggle: arrangement === 'toggle' && !discoverFromToggle,
    discoverDismiss: discoverFromToggle ? 'show-map' : null,
    discoverFromToggle,
    detailDismiss: 'close',
    showOnMapInDetail: false,
    assistant: 'panel',
  };
}

/** One pane at a time: the map, Discover, or Detail with Back. */
function resolveSingleColumn(input: ExploreLayoutInput): ExploreLayout {
  let detail: ExplorePaneMode | null = null;
  if (input.hasSelection) {
    if (isSpatial(input.detailPlacement)) detail = { kind: 'promoted' };
    else detail = input.compactPane === 'detail' ? { kind: 'screen' } : { kind: 'collapsed' };
  }
  const detailCoversWindow = detail?.kind === 'screen';
  const discover: InlinePaneMode =
    input.compactPane === 'discover' && !detailCoversWindow ? { kind: 'screen' } : { kind: 'collapsed' };
  const showMap = !(discover.kind === 'screen' || detailCoversWindow);

  return {
    arrangement: 'single',
    discover,
    detail,
    showMap,
    mapInsets: { left: 0, right: 0 },
    showPlacesToggle: showMap,
    discoverDismiss: discover.kind === 'screen' ? 'show-map' : null,
    discoverFromToggle: false,
    detailDismiss: detailCoversWindow ? 'back' : 'close',
    showOnMapInDetail: detailCoversWindow,
    assistant: 'sheet',
  };
}

/** Width in dp a pane takes out of the main window's row. */
export function paneRowWidth(mode: ExplorePaneMode | null): number {
  return mode?.kind === 'tiled' ? mode.width : 0;
}

/** What Back does in Explore, most transient surface first (handoff §1). */
export type ExploreBackAction = 'close-assistant' | 'close-detail' | 'show-map' | 'close-drawer';

/**
 * Back closes the assistant panel, then a visible Detail, then a Discover
 * screen, then a Discover opened from "Places", then a Detail the user moved
 * away from ("Show on map", or Discover opened over it). `null` means Explore
 * has nothing to close and the system handles Back.
 */
export function exploreBackAction(input: {
  assistantOpen: boolean;
  layout: ExploreLayout;
}): ExploreBackAction | null {
  const { layout } = input;
  if (input.assistantOpen) return 'close-assistant';
  if (layout.detail && layout.detail.kind !== 'collapsed') return 'close-detail';
  if (layout.discover.kind === 'screen') return 'show-map';
  if (layout.discoverFromToggle) return 'close-drawer';
  if (layout.detail) return 'close-detail';
  return null;
}
