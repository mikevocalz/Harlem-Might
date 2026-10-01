/**
 * Pane resize policy.
 *
 * Kept pure and free of `react-native` imports so it is directly testable: the
 * clamping is the part with real edge cases, not the gesture plumbing.
 */

/**
 * Rendered width of `w-pane-primary` in dp.
 *
 * The token is 20rem, and metro.config.js sets `polyfills.rem: 14` to preserve
 * NativeWind's base through the Uniwind migration — so this is 20 * 14, NOT the
 * 320 you would get from a 16px root. Changing the rem polyfill changes this.
 */
export const DEFAULT_PRIMARY_WIDTH = 280;

/** Bounds for the primary pane, in dp. Mirrors --container-pane-* tokens. */
export const PRIMARY_WIDTH_MIN = 200;
export const PRIMARY_WIDTH_MAX = 420;

/** Keyboard resize step for the divider's accessible affordance. */
export const RESIZE_KEYBOARD_STEP = 16;

export function clampPrimaryWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return PRIMARY_WIDTH_MIN;
  }
  return Math.min(PRIMARY_WIDTH_MAX, Math.max(PRIMARY_WIDTH_MIN, Math.round(width)));
}

/**
 * Width after a drag, given where the drag started.
 *
 * Takes the ORIGIN plus a translation rather than an accumulated width, because
 * accumulating per-frame deltas drifts once the pointer travels past a clamp
 * boundary and comes back: the pane would refuse to shrink until the surplus
 * had been paid off.
 */
export function widthAfterDrag(originWidth: number, translationX: number): number {
  return clampPrimaryWidth(originWidth + translationX);
}
