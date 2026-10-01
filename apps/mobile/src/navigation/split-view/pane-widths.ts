/**
 * Pane widths in dp.
 *
 * The layout normally sizes panes with the `w-pane-*` classes backed by
 * `--container-pane-*`. A collapse ANIMATION needs the same values as numbers,
 * because an animated width has to interpolate towards a number, not a class.
 *
 * These mirror `packages/theme/tokens.ts` at the app's rem polyfill of 14
 * (metro.config.js `polyfills.rem`), the same basis `DEFAULT_PRIMARY_WIDTH`
 * already uses. A test asserts the two stay in step.
 */
export const REM = 14;

export const PANE_WIDTH_DP = {
  primary: 20 * REM,
  primaryNarrow: 16 * REM,
  supplementary: 21 * REM,
  inspector: 20 * REM,
} as const;

export type PaneWidthKey = keyof typeof PANE_WIDTH_DP;
