import { createContext, useContext } from 'react';

/**
 * Which SplitView panes are currently shown in their own Meta Horizon window
 * (`useSpatialWindowState(label).placement === 'spatial'`).
 *
 * A promoted pane's content lives in the system window, so its inline slot
 * would be an empty strip. The Android split view collapses that slot to zero
 * width but keeps it MOUNTED: the `<SpatialWindow>` inside must stay at the
 * same tree position, or it unregisters, loses the slot, falls back inline
 * and re-promotes in a loop.
 *
 * - `primary`: the leading column.
 * - `detail`: the router-driven detail pane; the map column takes its width.
 *
 * Provided by the screen that owns the windows (Explore). Absent everywhere
 * else, which means nothing is promoted.
 */
export type PanePromotion = {
  readonly primary: boolean;
  readonly detail: boolean;
};

export const NO_PANE_PROMOTION: PanePromotion = { primary: false, detail: false };

export const PanePromotionContext = createContext<PanePromotion>(NO_PANE_PROMOTION);

export function usePanePromotion(): PanePromotion {
  return useContext(PanePromotionContext);
}
