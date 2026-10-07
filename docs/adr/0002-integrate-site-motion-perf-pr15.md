# ADR 0002: integrate PR #15 and PR #14 into main

**Status:** Accepted (recorded after the fact)
**Date:** 2026-10-07
**Deciders:** Mike Allen (repo owner)

## Context

The premium-experience pack (`00-shared-contract.md`, "First: inspect current main and open work") asks every phase to decide whether to build on PR #15 (`feat(web): finish product-home motion layer + perf hardening`), wait for it, or port its changes by hand. It also forbids regressing #15's CLS fixes, responsive Mapbox static loading, motion ownership, reduced-motion behaviour, no-JS behaviour and measured performance work.

#15 (`d98cd9d`) touched 15 files: a Kinetrell-owned motion layer (`apps/web/components/site/motion.ts`, `motion-markers.ts` with a test), `ProductHome.tsx`, responsive `srcSet`/`sizes` plus a hero preload in `MightsMapImage.tsx`, an RNW SSR atom mirror and motion-arming CSS in `globals.css`, `display: 'optional'` fonts, Mapbox preconnect in `Document.tsx`, and `docs/design/PRODUCT_SITE_MOTION.md`, which records desktop 95 / mobile 74 and CLS 0.049 → 0.

PR #14 added the TraceSift launcher (`package.json:23-24`) and `docs/performance/tracesift.md`.

Neither PR could merge cleanly because `main` had failed CI since the viro-external merge on 2026-10-06. Three dependencies resolved only on the author's machine: `expo-horizon-core` pointed at a gitignored `expo-pico/.vendor` clone, `@expo-pico/core` was a `file:` sibling, and a `@reactvision/react-viro` override linked `../viro-specs-preview`, a worktree that no longer existed (`eea5ad6` commit message).

## Decision

Fix CI on the #15 branch first, then merge #15 and #14 into `main` instead of rebasing pack work on an open branch.

- `eea5ad6` (`ci: resolve sibling dependencies so CI installs again`): uses the npm release of `expo-horizon-core` (57.0.2), clones the public `expo-pico` beside the checkout in `.github/workflows/ci.yml`, drops the dead `react-viro` link override from `pnpm-workspace.yaml`, and runs `pnpm turbo build typecheck lint --filter='!mobile'`. The mobile exclusion is recorded as a DEFER with its reason in `ci.yml`: the mobile `/viro-external` route imports panels that exist only on viro-external's unmerged, private `codex/specs-generated-preview` branch.
- Merged #15 as `3cfc16b`, then #14 as `9a54c80` (its branch had `main` merged in at `4f27681`), on 2026-10-07. #16 (docs) followed as `cc5d386`.

## Options considered

| Option | For | Against |
|---|---|---|
| A. Fix CI, merge #15 and #14, base the pack on `main` (chosen) | One baseline. #15's measured work becomes the floor that later phases can't regress. Phases branch from `main`. | Ships with mobile excluded from CI until viro-external lands |
| B. Base the pack on the open #15 branch | No CI fix needed up front | Every phase rebases on a moving branch, and CI stays red, so the per-phase gates (`pnpm typecheck`, lint, build) can't run in CI |
| C. Port #15's changes by hand | Avoids merging an unreviewed motion layer | Duplicates 609 lines of measured work, and the pack forbids regressing exactly those changes |

## Consequences

- Easier: every phase starts from `main` with green web CI. This audit re-measured #15's numbers on the merged build. CLS is 0 on all 5 routes for both presets. Home is desktop 95 / mobile 75 against the doc's 95 / 74 (section 18).
- Harder: mobile typecheck, lint and build run in no CI job. A Phase change to `packages/app` or `packages/ui` that breaks mobile can merge silently. Mitigation: run `pnpm --filter mobile typecheck` locally in every phase gate until the DEFER is lifted.
- `motion.ts` is now the only web GSAP owner (`SiteMotionShell.tsx:11-17`). Later phases register through its marker contract (`motion-markers.ts`) and never add their own `useEffect` + `gsap` blocks.
- `PRODUCT_SITE_MOTION.md`'s numbers don't record their protocol ("devtools throttle", no machine or runs). This audit's protocol (section 18) replaces them as the comparison baseline.
- Revisit when viro-external's `codex/specs-generated-preview` merges and CI gets read access: remove `--filter='!mobile'`.

## Follow-ups

- Every phase gate runs `pnpm --filter mobile typecheck` locally until the CI DEFER lifts.
- `PRODUCT_SITE_MOTION.md` points at the protocol in `docs/design/PREMIUM_EXPERIENCE_AUDIT.md` section 18.
