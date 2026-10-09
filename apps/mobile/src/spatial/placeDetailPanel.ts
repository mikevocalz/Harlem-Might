import type { MetaWindowPlacement } from '@viro-external/meta-layout';

/**
 * The `AppRegistry` name Place Detail registers under when it shows as its
 * own Horizon OS panel (DECISIONS S20, ADR 0006).
 */
export const PLACE_DETAIL_PANEL = 'PlaceDetailPanel';

/**
 * The panel's size, written into the quest manifest's `<layout>` element by
 * the `spatial-panels` config plugin (app.config.ts). Width 400 matches the
 * in-window Detail column (`pane-detail-xr`), height 600 the brief.
 */
export const PLACE_DETAIL_PANEL_DP = { width: 400, height: 600 } as const;

/**
 * Where the Place Detail panel is.
 *
 * - `closed`: no panel; nothing asked for one.
 * - `opening`: launch handed to the OS, the panel has not reported in.
 * - `open`: the panel's activity is up.
 * - `failed`: the launch threw. Detail shows in the main window's column
 *   (S17) until the selection clears.
 */
export type PlaceDetailPanelStatus = 'closed' | 'opening' | 'open' | 'failed';

/**
 * What the Explore layout should ask of the panel now, or `null` for nothing.
 * Pure. A selection opens the panel only from `closed`, so a failed launch is
 * not retried for the same selection; clearing the selection closes it.
 */
export function placeDetailPanelCommand(input: {
  selectedPlaceId: string | null;
  status: PlaceDetailPanelStatus;
  isAvailable: boolean;
}): 'open' | 'close' | null {
  const { selectedPlaceId, status, isAvailable } = input;
  if (selectedPlaceId != null) {
    return isAvailable && status === 'closed' ? 'open' : null;
  }
  return status === 'opening' || status === 'open' ? 'close' : null;
}

/**
 * Detail's placement for `resolveExploreLayout`. While the panel is opening
 * or open, Detail is `spatial`, so the main window drops its column and the
 * map takes the width. Otherwise Detail is `inline`: the S17 column is the
 * fallback.
 */
export function placeDetailPlacement(status: PlaceDetailPanelStatus): MetaWindowPlacement {
  return status === 'opening' || status === 'open' ? 'spatial' : 'inline';
}
