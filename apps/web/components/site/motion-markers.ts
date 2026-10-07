/**
 * The product-site motion marker convention, as a pure parser (import-free so
 * it can be unit-tested without a DOM). Elements carry marker ids:
 *   `mfx-<name>`  entrance target — pre-hidden while `motion-armed` is set
 *   `mpx-<name>`  transform-only target (parallax/scrub), never pre-hidden
 *   `trg-<name>`  ScrollTrigger anchor — the section root
 * Markers are `id` attributes because @acme/ui resolves `className` through
 * react-native-css on web; `id` passes through to the DOM untouched.
 * See motion.ts for how the parsed names bind to Kinetrell timelines.
 */
export type MotionMarkerKind = 'fade' | 'scrub' | 'trigger';

export interface MotionMarker {
  kind: MotionMarkerKind;
  /** The id without its prefix, e.g. `hero-title` for `mfx-hero-title`. */
  name: string;
}

const PREFIXES: Record<string, MotionMarkerKind> = {
  'mfx-': 'fade',
  'mpx-': 'scrub',
  'trg-': 'trigger',
};

/** Parse a DOM id into its motion marker, or null when it isn't one. */
export function parseMotionMarker(id: string): MotionMarker | null {
  for (const prefix of Object.keys(PREFIXES)) {
    if (id.startsWith(prefix)) {
      const name = id.slice(prefix.length);
      return name.length ? { kind: PREFIXES[prefix]!, name } : null;
    }
  }
  return null;
}

/** The selector that finds every marked element under a scope. */
export const MOTION_MARKER_SELECTOR = '[id^="mfx-"], [id^="mpx-"], [id^="trg-"]';

// ---- bento group reveal -----------------------------------------------------
// A bento reveals as one unit: one trigger on the grid, one entrance per
// module, dominant module first. MightsPlaceBento (`motionKey` prop,
// packages/ui/mights/MightsPlaceBento.tsx:bentoMotionIds) emits:
//   `trg-bento-<key>`      on the grid
//   `mfx-bento-<key>-<n>`  on each module, n = 0 for the dominant one
// Keys may contain hyphens; the module index is the last segment.

const BENTO = 'bento-';

/** The trigger marker name for a bento, e.g. `bento-places`. */
export function bentoTriggerName(key: string): string {
  return `${BENTO}${key}`;
}

/** The entrance marker name for module `index` of a bento. */
export function bentoModuleName(key: string, index: number): string {
  return `${BENTO}${key}-${index}`;
}

/** The bento key from a trigger marker name, or null when it isn't a bento. */
export function parseBentoTrigger(triggerName: string): string | null {
  if (!triggerName.startsWith(BENTO)) return null;
  const key = triggerName.slice(BENTO.length);
  return key.length ? key : null;
}

/**
 * Module count of a bento: contiguous `bento-<key>-0..n-1` entrance names.
 * A gap ends the count, so a stray higher index never binds.
 */
export function countBentoModules(key: string, fadeNames: Iterable<string>): number {
  const names = new Set(fadeNames);
  let n = 0;
  while (names.has(bentoModuleName(key, n))) n += 1;
  return n;
}

export interface BentoRevealStep {
  /** Entrance marker name (without `mfx-`). */
  target: string;
  atMs: number;
  durationMs: number;
  /** Starting offset in px; the dominant module travels further. */
  fromY: number;
}

/** Dominant module's entrance, then supports at a fixed stagger after it starts. */
export const BENTO_REVEAL = {
  dominantMs: 640,
  dominantY: 24,
  supportStartMs: 180,
  supportStaggerMs: 90,
  supportMs: 480,
  supportY: 14,
} as const;

/** Timing plan for one bento: index 0 first, the rest in source order. */
export function bentoRevealPlan(key: string, moduleCount: number): BentoRevealStep[] {
  const steps: BentoRevealStep[] = [];
  for (let i = 0; i < moduleCount; i += 1) {
    const dominant = i === 0;
    steps.push({
      target: bentoModuleName(key, i),
      atMs: dominant ? 0 : BENTO_REVEAL.supportStartMs + (i - 1) * BENTO_REVEAL.supportStaggerMs,
      durationMs: dominant ? BENTO_REVEAL.dominantMs : BENTO_REVEAL.supportMs,
      fromY: dominant ? BENTO_REVEAL.dominantY : BENTO_REVEAL.supportY,
    });
  }
  return steps;
}

/**
 * Fade markers that no bound motion targets. CSS pre-hides them once
 * `motion-armed` is set, so the binder must reveal them. Hero markers are
 * never pre-hidden and are left out.
 */
export function unboundFades(fadeNames: readonly string[], bound: ReadonlySet<string>): string[] {
  return fadeNames.filter((name) => !name.startsWith('hero-') && !bound.has(name));
}
