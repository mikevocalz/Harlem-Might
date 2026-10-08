import { contentWidths, spacing } from '@acme/theme';
import type { MetaWindowProps } from '@viro-external/meta-layout';

/**
 * Where Horizon OS 207 puts the far edge of a window attached OUTSIDE the
 * main window's start or end edge, in dp past that edge. Measured on a
 * Quest 3S (ADR 0005): with `anchor` `{parent:'end', child:'start'}` or
 * `{parent:'start', child:'end'}` the child's far edge sat 0.152 m (160dp)
 * past the main window's edge for widths 300, 400 and 440dp and heights
 * 400 and 600dp. The window grows back toward the main window from there,
 * so anything wider than 160dp overlaps it. Meta's offsets cannot correct
 * this: the SDK clamps them to ±5 steps, and 5 horizontal steps measured
 * 9.9 mm.
 */
export const OUTWARD_FAR_EDGE_DP = 160;

/**
 * The gap in dp between the main window and a window of `widthDp` attached
 * outside its start or end edge. Negative means the windows overlap by
 * that much.
 */
export function outwardWindowGapDp(widthDp: number): number {
  return OUTWARD_FAR_EDGE_DP - widthDp;
}

function px(value: string): number {
  if (!value.endsWith('px')) throw new Error(`Expected a px token, got ${value}.`);
  return Number.parseFloat(value);
}

/** The rail window's size in dp, from `@acme/theme` tokens. */
export const RAIL_WINDOW_DP = (() => {
  const item = px(spacing['target-primary']);
  const gap = px(spacing['xr-inline']);
  const padding = px(spacing['xr-stack']);
  const items = 5;
  return {
    width: px(contentWidths['rail-window-xr']),
    item,
    gap,
    padding,
    height: items * item + (items - 1) * gap + 2 * padding,
  };
})();

/**
 * The app's navigation rail as its own Horizon window on the main window's
 * start edge, like a visionOS tab bar ornament (DECISIONS S18). Same depth
 * as the main window (no offset) and centred on it vertically. Priority 20
 * so navigation wins a slot over any content window.
 */
export const RAIL_WINDOW: MetaWindowProps = {
  label: 'rail',
  windowWidth: RAIL_WINDOW_DP.width,
  windowHeight: RAIL_WINDOW_DP.height,
  priority: 20,
  promotable: true,
  fallback: 'drop',
  anchor: { parent: 'start', child: 'end' },
};
