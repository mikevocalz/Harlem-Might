'use client';
import { useSyncExternalStore } from 'react';
import { REGULAR_MIN_WIDTH, type SizeClass } from './size-class.constants';

export type { SizeClass };
export { REGULAR_MIN_WIDTH };

/**
 * PLATFORM FORK — web.
 *
 * `useWindowDimensions()` reports a width of 0 during server rendering, so the
 * shared implementation classified every prerendered page as `compact` and
 * shipped the PHONE layout in the HTML, swapping to the wide layout only after
 * hydration. That is a visible flash on desktop, which is most of the traffic.
 *
 * `matchMedia` has no such problem on the client and gives an explicit
 * `getServerSnapshot`, so the server pass is a deliberate choice rather than an
 * artefact of an unmeasurable window.
 *
 * SSR resolves to `regular` — desktop-first. There is genuinely no viewport on
 * the server, so one of the two has to be wrong somewhere: this way desktop is
 * correct on first paint and narrow viewports self-correct on hydration. Screens
 * that must be right on phones at first paint should branch in CSS (Tailwind
 * responsive variants) rather than here, since CSS needs no viewport guess.
 */
const QUERY = `(min-width: ${REGULAR_MIN_WIDTH}px)`;

function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

function getSnapshot(): SizeClass {
  return window.matchMedia(QUERY).matches ? 'regular' : 'compact';
}

function getServerSnapshot(): SizeClass {
  return 'regular';
}

export function useSizeClass(): SizeClass {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
