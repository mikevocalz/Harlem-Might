import { semantic } from '@acme/theme';

/**
 * Contract shared by the Rive file (rive/scene.rml) and both runtimes.
 * Property names must match the `ExploreLoader` view model; the RML carries
 * the same names and its defaults are the dark token values below.
 */
export const EXPLORE_LOADER_ARTBOARD = 'ExploreLoader';
export const EXPLORE_LOADER_MACHINE = 'Loader';
export const EXPLORE_LOADER_VIEW_MODEL = 'ExploreLoader';

export const EXPLORE_LOADER_BINDINGS = {
  ringPrimary: 'ringPrimary',
  ringAccent: 'ringAccent',
  core: 'core',
  track: 'track',
  phase: 'phase',
  progress: 'progress',
} as const;

/**
 * `enter` is not a phase the host sets — the state machine always enters
 * through its draw-in timeline, then runs `loading` until told otherwise.
 */
export type ExploreLoaderPhase = 'loading' | 'complete' | 'error' | 'reduced';

export interface ExploreLoaderColors {
  ringPrimary: string;
  ringAccent: string;
  core: string;
  track: string;
}

/**
 * Every loader colour is a theme token, resolved per scheme at runtime — a
 * theme change needs no .riv rebuild. Defaults mirror the RML authoring
 * defaults (dark, because the map canvas is `map-canvas` dark).
 */
export function exploreLoaderColors(scheme: 'light' | 'dark' = 'dark'): ExploreLoaderColors {
  return {
    ringPrimary: semantic.primary[scheme],
    ringAccent: semantic.spatial[scheme],
    core: semantic.primary[scheme],
    track: semantic['rule-rail'][scheme],
  };
}
