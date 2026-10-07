'use client';
/**
 * The product-site motion layer — the single place GSAP meets the DOM on the
 * public Next.js site. Lenis itself is owned one level up by SiteMotionShell
 * (createKinetrellLenis + connectGsapLenis share the clock); this module owns
 * only choreography: Kinetrell `defineMotion` documents compiled once and
 * bound to marker ids via `createGsapTimeline` + `attachScrollTrigger`.
 *
 * Marker ids (see motion-markers.ts):
 *   `mfx-<name>`  entrance target — pre-hidden by CSS while `motion-armed`
 *                 is on the root, then brought in by a timeline
 *   `mpx-<name>`  transform-only scrub target — never pre-hidden
 *   `trg-<name>`  ScrollTrigger anchor — the section root
 *
 * Reduced motion never reaches a timeline: the caller gates on
 * useBrowserReducedMotion, `motion-armed` is never set, and the static
 * composition renders unchanged.
 */
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { compileMotion, defineMotion, type CompiledMotion } from 'kinetrell/core';
import {
  attachScrollTrigger,
  createGsapTimeline,
  ensureScrollTrigger,
  type GsapTargetMap,
} from 'kinetrell/web/gsap';
import { MOTION_MARKER_SELECTOR, parseMotionMarker } from './motion-markers';

export const ARMED_CLASS = 'motion-armed';

/** Elements that get the small pointer-fine pull — the page's two CTAs. */
const MAGNETIC_TARGETS = ['mfx-hero-cta', 'mfx-close-cta'] as const;

interface Targets {
  fades: GsapTargetMap;
  scrubs: GsapTargetMap;
  triggers: Record<string, Element>;
}

function collectTargets(root: ParentNode): Targets {
  const fades: Record<string, gsap.TweenTarget> = {};
  const scrubs: Record<string, gsap.TweenTarget> = {};
  const triggers: Record<string, Element> = {};
  for (const el of root.querySelectorAll<HTMLElement>(MOTION_MARKER_SELECTOR)) {
    const marker = parseMotionMarker(el.id);
    if (!marker) continue;
    if (marker.kind === 'fade') fades[marker.name] = el;
    else if (marker.kind === 'scrub') scrubs[marker.name] = el;
    else triggers[marker.name] = el;
  }
  return { fades, scrubs, triggers };
}

/** A motion only binds if every named target exists — logs the missing ids in dev. */
function bindable(motion: CompiledMotion, map: GsapTargetMap): boolean {
  const ids = new Set([...motion.tracks.map((t) => t.target), ...Object.keys(motion.initial)]);
  const missing = [...ids].filter((id) => !(id in map));
  if (missing.length && process.env.NODE_ENV !== 'production') {
    console.warn(`[kinetrell] ${motion.id}: missing targets ${missing.join(', ')} — skipped`);
  }
  return missing.length === 0;
}

// ---------------------------------------------------------------------------
// Authored motions. Transform/opacity only; the map image (the LCP surface)
// is never a track target — nothing on the hero ever waits on JS to paint.
// ---------------------------------------------------------------------------

/**
 * Hero load: the lens resolves over the block while the copy column settles.
 * Copy moves are transform-only — a slow hydration bind shifts geometry on a
 * late replay, never paint timing. Hero markers are excluded from the
 * `motion-armed` pre-hide in globals.css for the same reason.
 */
const heroEntrance = compileMotion(
  defineMotion({
    id: 'hm.hero.enter',
    initial: {
      'hero-title': { y: 28 },
      'hero-lead': { y: 16 },
      'hero-cta': { y: 12 },
      'hero-stamp': { y: 10 },
      'hero-lens': { opacity: 0, scale: 0.94 },
    },
    tracks: [
      { target: 'hero-title', to: { y: 0 }, atMs: 120, durationMs: 560, ease: 'power2.out' },
      { target: 'hero-lead', to: { y: 0 }, atMs: 220, durationMs: 520, ease: 'power2.out' },
      { target: 'hero-cta', to: { y: 0 }, atMs: 320, durationMs: 480, ease: 'power2.out' },
      {
        target: 'hero-lens',
        to: { opacity: 1, scale: 1 },
        atMs: 150,
        durationMs: 900,
        ease: 'power2.out',
      },
      { target: 'hero-stamp', to: { y: 0 }, atMs: 500, durationMs: 480, ease: 'power2.out' },
    ],
  }),
);

/**
 * Hero scroll-out: the map drifts up inside its frame as the chapter leaves.
 * The frame bleeds 8% past its bounds (`-inset-y-[8%]`) so the drift never
 * opens a gap.
 */
const heroDrift = compileMotion(
  defineMotion({
    id: 'hm.hero.drift',
    initial: { 'hero-map': { yPercent: -4 } },
    tracks: [{ target: 'hero-map', to: { yPercent: 4 }, durationMs: 1000, ease: 'linear' }],
  }),
);

/** Chapter 2 — "Start with a block": copy, then the map card, then its doors. */
const blockEntrance = compileMotion(
  defineMotion({
    id: 'hm.block.enter',
    initial: {
      'block-copy': { opacity: 0, y: 24 },
      'block-map': { opacity: 0, y: 28 },
      'block-place-0': { opacity: 0, y: 14 },
      'block-place-1': { opacity: 0, y: 14 },
      'block-place-2': { opacity: 0, y: 14 },
    },
    tracks: [
      { target: 'block-copy', to: { opacity: 1, y: 0 }, atMs: 0, durationMs: 560, ease: 'power2.out' },
      { target: 'block-map', to: { opacity: 1, y: 0 }, atMs: 140, durationMs: 640, ease: 'power2.out' },
      { target: 'block-place-0', to: { opacity: 1, y: 0 }, atMs: 360, durationMs: 420, ease: 'power2.out' },
      { target: 'block-place-1', to: { opacity: 1, y: 0 }, atMs: 460, durationMs: 420, ease: 'power2.out' },
      { target: 'block-place-2', to: { opacity: 1, y: 0 }, atMs: 560, durationMs: 420, ease: 'power2.out' },
    ],
  }),
);

/** Places index: the header line, then the grid settles as one plate. */
const placesEntrance = compileMotion(
  defineMotion({
    id: 'hm.places.enter',
    initial: {
      'places-head': { opacity: 0, y: 22 },
      'places-grid': { opacity: 0, y: 24 },
    },
    tracks: [
      { target: 'places-head', to: { opacity: 1, y: 0 }, atMs: 0, durationMs: 560, ease: 'power2.out' },
      { target: 'places-grid', to: { opacity: 1, y: 0 }, atMs: 160, durationMs: 640, ease: 'power2.out' },
    ],
  }),
);

/**
 * Sidewalk chapter: the cobalt frame settles like a device reveal — scrubbed
 * so it lands with the scroll — while the copy resolves alongside.
 */
const sidewalkReveal = compileMotion(
  defineMotion({
    id: 'hm.sidewalk.reveal',
    initial: {
      'sidewalk-frame': { opacity: 0, y: 40, scale: 0.97 },
      'sidewalk-copy': { opacity: 0, y: 24 },
    },
    tracks: [
      {
        target: 'sidewalk-frame',
        to: { opacity: 1, y: 0, scale: 1 },
        atMs: 0,
        durationMs: 800,
        ease: 'power2.out',
      },
      { target: 'sidewalk-copy', to: { opacity: 1, y: 0 }, atMs: 160, durationMs: 600, ease: 'power2.out' },
    ],
  }),
);

/** Close: the headline lands, the CTA follows. Quiet, one pass. */
const closeEntrance = compileMotion(
  defineMotion({
    id: 'hm.close.enter',
    initial: {
      'close-title': { opacity: 0, y: 26 },
      'close-cta': { opacity: 0, y: 14 },
    },
    tracks: [
      { target: 'close-title', to: { opacity: 1, y: 0 }, atMs: 0, durationMs: 640, ease: 'power2.out' },
      { target: 'close-cta', to: { opacity: 1, y: 0 }, atMs: 240, durationMs: 480, ease: 'power2.out' },
    ],
  }),
);

// ---------------------------------------------------------------------------

const DESKTOP = '(min-width: 768px)';
const FINE_POINTER = '(pointer: fine)';

/** ≤6px pull toward the pointer on desktop CTAs. Native geometry untouched. */
function armMagnets(root: ParentNode): () => void {
  if (!window.matchMedia(FINE_POINTER).matches) return () => {};
  const off: Array<() => void> = [];
  for (const id of MAGNETIC_TARGETS) {
    const el = root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!el) continue;
    const moveX = gsap.quickTo(el, 'x', { duration: 0.25, ease: 'power2.out' });
    const moveY = gsap.quickTo(el, 'y', { duration: 0.25, ease: 'power2.out' });
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      moveX(gsap.utils.clamp(-6, 6, (e.clientX - (r.left + r.width / 2)) * 0.18));
      moveY(gsap.utils.clamp(-6, 6, (e.clientY - (r.top + r.height / 2)) * 0.18));
    };
    const onLeave = () => {
      moveX(0);
      moveY(0);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    off.push(() => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    });
  }
  return () => off.forEach((fn) => fn());
}

/**
 * All home choreography, bound once when ProductHome mounts. Marker ids are
 * unique to the home page, so the document is a safe query scope. The caller
 * passes `reduced`; under reduced motion nothing binds and `motion-armed`
 * is never set — the page is its own static composition.
 */
export function useHomeMotion(reduced: boolean) {
  useGSAP(() => {
    // `reduced` resolves a tick after mount (the hook reads matchMedia in an
    // effect); the synchronous check keeps even the first bind silent.
    if (reduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!ensureScrollTrigger()) return;
    const scope: ParentNode = document;
    const armedHost = document.documentElement;
    armedHost.classList.add(ARMED_CLASS);
    const { fades, scrubs, triggers } = collectTargets(scope);
    const all = { ...fades, ...scrubs };
    const desktop = window.matchMedia(DESKTOP).matches;

    // Hero entrance — authored load sequence, plays once, no trigger. Only
    // replay it when hydration was fast; on a slow bind the static
    // composition stays instead of a flash-and-replay over the LCP surface.
    if (bindable(heroEntrance, fades) && performance.now() < 1800) {
      createGsapTimeline(heroEntrance, fades).play();
    }

    // Hero map drift — desktop only.
    if (desktop && triggers.hero && bindable(heroDrift, all)) {
      attachScrollTrigger(createGsapTimeline(heroDrift, all), {
        trigger: triggers.hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.6,
      });
    }

    // Chapter 2 — the block.
    if (triggers.block && bindable(blockEntrance, all)) {
      attachScrollTrigger(createGsapTimeline(blockEntrance, all), {
        trigger: triggers.block,
        start: 'top 78%',
      });
    }

    // Places index.
    if (triggers.places && bindable(placesEntrance, all)) {
      attachScrollTrigger(createGsapTimeline(placesEntrance, all), {
        trigger: triggers.places,
        start: 'top 80%',
      });
    }

    // Sidewalk — the frame settles with scroll.
    if (triggers.sidewalk && bindable(sidewalkReveal, all)) {
      attachScrollTrigger(createGsapTimeline(sidewalkReveal, all), {
        trigger: triggers.sidewalk,
        start: 'top 82%',
        end: 'center 55%',
        scrub: 0.5,
      });
    }

    // Close.
    if (triggers.close && bindable(closeEntrance, all)) {
      attachScrollTrigger(createGsapTimeline(closeEntrance, all), {
        trigger: triggers.close,
        start: 'top 78%',
      });
    }

    const offMagnets = armMagnets(scope);
    return () => {
      offMagnets();
      armedHost.classList.remove(ARMED_CLASS);
    };
  }, { dependencies: [reduced], revertOnUpdate: true });
}
