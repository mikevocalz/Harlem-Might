# Music artist photo audit — 2026-10-12

## Result and scope

The published catalogue contains **102 artists**: 56 have stored headshots and 46 do not. Three additional draft records (Dave East, Jim Jones, Ray Barretto) all have stored photos and are excluded from the 102. The earlier 59/46 count included those drafts.

This patch supplies **102 distinct, reviewed source-image selections**. All 102 selected source images or their exact Commons previews were fetched, decoded and visually inspected; all 102 checked image hashes are distinct. Identity is based on explicit source captions/profile attribution, not face recognition. Bloodshed is the owner's explicitly selected portrait; its independent provenance and reuse license remain unverified.

This is **not a production-completion certificate**. A working deployment/media origin has not been confirmed. Stored Payload bytes, public page rendering, web/native device display and deployed image-proxy responses remain unverified. Some full-size Commons probes were rate-limited or interrupted; per-artist exact-URL versus preview evidence is recorded in the JSON. Do not turn source coverage or a passing build into a claim that all live images load.

## Corrections

- Replace changing Wikipedia/profile metadata extraction with a deterministic, reviewed registry for the exact published catalogue. Unknown names return no photo rather than a fuzzy substitute.
- Replace Cameo's logo, T-Rex's illustration, Johnny Kemp's sleeve image, and the missing Harlem Quartet source with real artist/ensemble photographs.
- Use the owner-supplied Bloodshed photograph instead of the XXL logo. The CDN returns WEBP despite the `.jpg` URL; the existing image proxy accepts its actual media type.
- Replace James P. Johnson's distant group-scene framing and Stuart Bascombe's three-person image with individual photographs.
- Quarantine exactly five known stored source assignments: Black Ivory's sleeve, Dizzy Gillespie's distant orchestra scene, Frankie Cutlass and J. Rosamond Johnson's ambiguous two-person photos, and Harlem Gospel Choir's photo with conflicting embedded copyright metadata. Later curator replacements are preserved; quarantine is by source identity, not an unconditional artist override.
- Preserve the entire photo and ensemble membership in artist cards/detail views. Existing non-music editorial framing stays unchanged by default.
- Version both API and React Query image caches.
- Make both public photo GET routes read-only. Displaying an image no longer uploads media or rewrites the live catalogue.

## Rights and quality

82 selections have explicit compatible Commons license statements; 20 are external reference images, with no local reuse-license claim or automatic CMS ingestion. Each record links its exact source and preserves photographer/credit and available license information.

Charles Hamilton remains a low-quality but correctly attributed video-frame photograph. James P. Johnson's individual photograph is only 204×275. Several publisher/profile portraits are small. These limitations are recorded rather than hiding them with fabricated, generic or wrong-person images.

## Evidence

[Per-artist audit JSON](music-photo-audit-2026-10-12.json) records the original stored assignment, proposed source, identity basis, checked image URL/hash/dimensions, exact-original load status, rights and remaining limitations. It contains all 102 published artists, not the draft records.

## Verification

- App tests: 601 passed, including 44 music/photo tests and six new registry/policy regressions.
- Payload tests: 22 passed, including bounded public-photo fetching and DNS/redirect safety.
- Web tests: 24 passed.
- UI tests: 18 passed.
- All 20 external-reference upstream URLs: HTTP200, supported image media type, no redirect under the proxy request headers. This is an upstream check, not proof of deployed proxy access.
- App, content, UI and web TypeScript checks: passed.
- Changed app, UI and web files: ESLint passed.
- Production web build: not yet verified. An initial dependency-link root error was corrected; the next attempt was terminated with exit137 while compiling in this shared environment.
- No merge, deployment or live CMS/database mutation performed.

Repository AGENTS.md and its pinned `mikevocalz-foldable-layouts` reference were read. Existing Image, Figure, MightsEditorialImage and React Query abstractions are reused. No navigation, pane, router, hinge or device-family policy is changed. Native/headset hardware was not tested.

## Release gate

1. Confirm the actual application origin and deployed commit.
2. Review and authorize merge/deployment of this patch.
3. Verify all 102 rendered image requests and visible source/identity/framing on that build, including Bloodshed's WEBP and wide ensemble pictures.
4. Optionally approve a separate, explicit CMS media repair. This patch can display replacements without changing any live record, and external-reference images must not be silently ingested as licensed media.
