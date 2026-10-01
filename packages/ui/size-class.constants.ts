export type SizeClass = 'compact' | 'regular';

/**
 * §9.1 — size class keys off WINDOW width, never device type: a detail pane at
 * 500pt or an OS split-screen half renders like a phone.
 */
export const REGULAR_MIN_WIDTH = 768;
