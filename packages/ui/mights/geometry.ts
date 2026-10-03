// NeonBlade-derived geometry (measured from neonbladeui.neuronrush.com),
// rebuilt on Harlem Might tokens. clip-path only; the cut is the ornament.
// Literal strings on purpose: Tailwind only generates classes it can read.

/** One diagonal corner cut, bottom-right, 20px — NeonBlade's md button. */
export const cornerCut =
  '[clip-path:polygon(0_0,100%_0,100%_calc(100%-20px),calc(100%-20px)_100%,0_100%)]';

/** 12px cut for compact controls (nav actions, chips). */
export const cornerCutSm =
  '[clip-path:polygon(0_0,100%_0,100%_calc(100%-12px),calc(100%-12px)_100%,0_100%)]';

/** Card silhouette: 45° trapezoid notches centred on the top and bottom
 *  edges (140px wide, 8px deep), plus a 20px cut at the bottom-right corner. */
export const notch =
  '[clip-path:polygon(0_0,calc(50%-78px)_0,calc(50%-70px)_8px,calc(50%+70px)_8px,calc(50%+78px)_0,100%_0,100%_calc(100%-20px),calc(100%-20px)_100%,calc(50%+78px)_100%,calc(50%+70px)_calc(100%-8px),calc(50%-70px)_calc(100%-8px),calc(50%-78px)_100%,0_100%)]';

/** Mona Sans at the condensed end of its width axis — the display voice. */
export const condensed = '[font-stretch:75%]';
export const semiCondensed = '[font-stretch:87.5%]';
/** Expanded width for UI labels (nav, buttons): the HUD voice. */
export const expanded = '[font-stretch:112.5%]';
