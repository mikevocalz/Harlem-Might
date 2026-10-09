import type { ExploreLoaderPhase } from './bindings';

/**
 * Props shared by the web and native `ExploreLoader`. `source` is the
 * platform asset: a URL string on web (`/rive/explore-loader.riv`) or a
 * bundled `require()` id on native — always local, never fetched at load
 * time beyond the bundled asset.
 */
export interface ExploreLoaderProps {
  source: string | number;
  /** Rendered size in px; the artboard is square. */
  size?: number;
  /**
   * Drives the state machine: `loading` spins, `complete` collapses the
   * rings for the reveal, `error` settles and dims, `reduced` swaps
   * rotation for a slow opacity pulse.
   */
  phase?: ExploreLoaderPhase;
  /** Real progress 0–1 fills the outer ring; omit for indeterminate. */
  progress?: number;
  /** Colour scheme for the token binding (default 'dark' — the map canvas). */
  scheme?: 'light' | 'dark';
  /** Screen-reader label; announced once on mount as a progressbar. */
  label?: string;
  className?: string;
}
