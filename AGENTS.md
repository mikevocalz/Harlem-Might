# Required tailored foldable skill

Before foldable, dual-screen, tablet, adaptive-pane, Inspector, resizing or shared XR layout work, read **mikevocalz-foldable-layouts** in full:

https://github.com/mikevocalz/universal-spatial-starter/blob/256a97b132803fd2fb8049f7a120cef9cb641f41/.agents/skills/mikevocalz-foldable-layouts/SKILL.md

Canonical commit: `256a97b132803fd2fb8049f7a120cef9cb641f41`; Git blob SHA: `69a051ad0a924f778ed54f9222fe8af0c5eef701`. Fetch through repository tools or read an identical local copy. This is a versioned shared reference, not a claim of local installation. Record intentional pin changes; report a source-loading failure rather than claiming the skill was read.

Hardware family chooses native navigation: ordinary phones use bottom tabs; foldables (including folded covers and tabletop), tablets and headsets keep a physical RIGHT rail, also in RTL. Current usable space chooses content panes independently. Web keeps a persistent header and phone-width bottom tabs, never a side rail. Missing hinge geometry does not identify an ordinary phone.

Preserve existing Expo Router/SplitView/AdaptivePanes ownership, Zustand/refs, semantic UI, Kinetrell, Rive and platform/renderer contracts. Keep authored stage ratios and screen-specific Inspector rules; do not import PaCasa's numeric presets into unrelated screens. Use the skill's hinge-safe geometry, session-continuity and 18 acceptance scenarios. Apple-native examples must not become a cross-platform SwiftUI rewrite or mandatory glass redesign.

Read relevant existing specialist skills. No Tamagui or Bento. No runtime changes, dependency upgrades, merges or deployments solely for a skills-only task. Clearly distinguish actual device validation from browser/simulator checks.
