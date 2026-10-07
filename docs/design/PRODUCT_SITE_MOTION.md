# Product site motion + performance contract

Scope: `apps/web` public product site (the `(site)` route group). The
Kinetrell/Lenis/GSAP stack is the single motion owner; nothing else may
import `gsap` (enforced by `eslint-plugin-boundaries`-adjacent restricted-imports
rules in `apps/web/eslint.config.mjs` — the only exempt file is
`components/site/motion.ts`).

## Ownership

- `SiteMotionShell.tsx` — creates Lenis via `createKinetrellLenis`, bridges the
  GSAP ticker, gates all smooth scrolling behind `useBrowserReducedMotion`.
- `components/site/motion.ts` — the only file that imports `gsap`. Holds the
  homepage choreography: hero lens resolve, eyebrow/headline rise, map drift,
  chapter reveals. Reads marker ids via `motion-markers.ts`.
- `components/site/motion-markers.ts` — pure helpers that collect
  `id="mfx-*"` elements into named groups. Extracted for unit testing.

Marker convention: animation targets are addressed by `id` (`mfx-hero-*`,
`mfx-drift-*`, …), never by class. `useCssElement`-based Mights primitives
forward `id` to the DOM unchanged, while `className` is compiled through the
RNW/NativeWind `$$css` pipeline — so `id` is the stable target.

## Reduced-motion contract

- `useBrowserReducedMotion('system')` is checked synchronously via
  `matchMedia` on first bind (a state-resolved value arrives one render late
  and would flash the entrance).
- `useGSAP` is configured with `revertOnUpdate: true` — the dep-array re-run
  must tear down the first context, otherwise the pre-reduced-motion bind
  survives and tweens keep running.
- Under `reduce`: `motion-armed` is never set, every `mfx-*` element renders
  at its final state, and the hero lens is visible immediately.

## LCP-safe pre-hide

`globals.css` contains `.motion-armed [id^="mfx-"] { visibility/opacity }`
pre-hide rules so authored entrances do not flash. Hero elements are
transform-only entrances (translate/scale/rotate) — opacity never reaches 0 —
so the LCP element paints even while hydration is still in flight.

## RNW SSR atom mirror

React Native Web injects its atomic base classes (`.css-g5y9jx` View,
`.css-*` Text atoms) at hydration only. SSR HTML carries the class names but
no rules, so the nav `UL` renders `display:block` (column) in SSR and snaps to
a row at hydration — measured as a 0.172 CLS regression on the hero section.

`globals.css` mirrors the handful of atoms actually used by the site shell
(version-pinned, documented inline). Tailwind utilities still win because
utilities are emitted `!important` in this project. Result: CLS 0 desktop and
mobile, and the no-JS layout (nav, hero lens position) matches hydrated.

## Image/perf pipeline

- `MightsMapImage` emits responsive Mapbox Static `srcSet` candidates
  (`0.75x/1x/1.5x` of the layout size, proportionally scaled, capped at
  Mapbox's 1280px side limit) plus `sizes`. Non-priority images stay
  `loading="lazy"`; the hero uses `fetchPriority="high"` + eager.
- `ProductHome` renders a hoisted `<link rel="preload" imagesrcset …>` for the
  hero map so the fetch starts at head-parse.
- `Document.tsx` preconnects/dns-prefetches `api.mapbox.com`.
- Local fonts use `display: 'optional'` — they are same-origin `.woff2`/`ttf`
  files and `optional` removes swap reflow entirely.

## Measured (post-change, production build)

These numbers predate a written protocol. The comparison baseline for later work is section 18 of `PREMIUM_EXPERIENCE_AUDIT.md` (Lighthouse 13.5, 3 runs, medians, `tooling/perf/lighthouse-baseline.sh`).

| Metric | Desktop | Mobile (devtools throttle) |
| --- | --- | --- |
| Performance | 95 | 74 |
| Accessibility | 99 | 99 |
| Best practices | 100 | 100 |
| SEO | 100 | 100 |
| LCP | 1.6 s | ~17 s* |
| CLS | 0.049 → 0 | 0.049 → 0 |
| TBT | 0 ms | 60 ms |
| Speed Index | 0.6 s | 3.3 s |

\* Mobile LCP is bound by Mapbox's server-side raster render time under
Lighthouse's 4× throttling (~15–16 s simulated, ~1.3 s unthrottled). It is an
upstream cost — preconnect + preload already start the fetch at head-parse.
The remaining lever is first-party cached/pre-rendered map imagery; the image
policy currently routes all map tiles through Mapbox Static.

Pre-change baseline: desktop 86 / LCP 2.6 s / CLS 0.049, mobile 68 / CLS 0.049.
