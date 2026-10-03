// NeonBlade-derived geometry, rebuilt on Harlem Mights tokens. clip-path only;
// the cut is the ornament, so nothing else decorates these shapes. Literal
// strings on purpose: Tailwind only generates classes it can read verbatim.

/** One diagonal corner cut, bottom-right, 12px — buttons. */
export const cornerCut =
  '[clip-path:polygon(0_0,100%_0,100%_calc(100%-12px),calc(100%-12px)_100%,0_100%)]';

/** One rectangular notch, 56×18, cut from the top-right corner — cards. */
export const notch =
  '[clip-path:polygon(0_0,calc(100%-56px)_0,calc(100%-56px)_18px,100%_18px,100%_100%,0_100%)]';

/** Mona Sans at the condensed end of its width axis — the display voice. */
export const condensed = '[font-stretch:75%]';
export const semiCondensed = '[font-stretch:87.5%]';
