---
name: harlem-specs-experience
description: Build and review Harlem Might's native Snap Specs screens from existing catalogue, navigation and spatial systems.
---
# Harlem Might on Specs

1. Read `docs/SPECS_EXPERIENCE.md`, `docs/ADAPTIVE_EXPLORE_LAYOUT.md`,
   `docs/ROUTING_AND_AR_NAVIGATION.md`, `docs/XR-PLATFORM-MATRIX.md`,
   and the actual `packages/app/features/specs/experience.ts`.
2. Keep the **existing** Payload readers, catalogue store, location pipeline,
   route provider and canonical navigation session as sole owners of state.
   No Specs-only Zustand store, duplicate map database, fabricated POIs or
   React Native runtime on Lens Studio.
3. Use `mikevocalz/viro-external/packages/specs` and
   `specs-devs/samples` Navigation Kit, Custom Locations, Specs Mobile Kit
   and Path Pioneer as implementation references. Apply the official SPECS 27
   CLAD toolchain instead of obsolete Spectacles 2024 skills.
4. Lens UI uses one main focused surface. Clear detail chrome while walking;
   do not copy a 3-column Quest layout. Test binocular overlap, additive
   display contrast, hand targeting, motion and walking distraction.
5. Never display route geometry before confidence, time freshness,
   permissions and actual local alignment pass; do not equate simulator GPS
   with a verified physical location.
6. Source assets for history and music from rights-cleared Harlem Might
   catalogue records. Render absent media as absent, never unrelated imagery.
7. Run `@acme/app` tests, TypeScript, Specs package build and Lens Preview
   with LEAF action/teardown tests. State exactly which environment ran.

Mandatory engineering/review skill references:
`expo/skills`, `mattpocock/skills`, `Argent/agent-device`,
`coreyhaines31/marketingskills`, `pbakaus/impeccable`,
`petergyang/no-ai-slop`, `FloWritesCode/fwc-swiftui-skills`,
`thiagobrez/react-native-arrangement-view` concepts and the sibling Viro
`specs-live-presentations` skill. Invoke only relevant stages of each.
