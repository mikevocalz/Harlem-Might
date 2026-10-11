# Required FWC foldable-screen skill

For implementation, debugging, review, tests, or documentation involving foldables, tablets, dual screens, SplitView, adaptive panes, inspectors, or resizing, load **FloWritesCode/fwc-swiftui-skills / swiftui-iphone-duo**. This supplements the existing repository contracts; it does not override explicit navigation-rail placement, hardware-family behavior, state-management, routing, UI, or XR requirements.

Source: https://github.com/FloWritesCode/fwc-swiftui-skills

Reviewed upstream revision: `3a6c74be7bf9cbc6b19c2025922f6b364542c000`. Read both the [SKILL.md](https://github.com/FloWritesCode/fwc-swiftui-skills/blob/3a6c74be7bf9cbc6b19c2025922f6b364542c000/skills/swiftui-iphone-duo/SKILL.md) and [complete reference.md](https://github.com/FloWritesCode/fwc-swiftui-skills/blob/3a6c74be7bf9cbc6b19c2025922f6b364542c000/skills/swiftui-iphone-duo/reference.md). Use a local installation when present, otherwise read through repository tools. The optional project-scope installation command is `npx skills add FloWritesCode/fwc-swiftui-skills --skill swiftui-iphone-duo`; that command tracks upstream, so inspect its changes and record the actual installed revision.

Apply the source in the correct layer:

- Keep React Native/Expo's existing UI components, router, SplitView/AdaptivePanes and state store. Improve shared abstractions and platform adapters; do not create a parallel SwiftUI app or duplicate navigation tree.
- Use SwiftUI APIs only in Apple-native code after checking the installed SDK and deployment target, with appropriate compiler/runtime availability protection. `swiftui-liquid-glass` is relevant only to Apple-native chrome work, not a mandate for a glass redesign or a deployment-target increase.
- Preserve Android's Expo Modules 2 and Jetpack WindowManager/FoldingFeature integration where present, including reported hinge bounds, occlusion, separating folds, book/tabletop posture, and all reported display features. Apple-specific API examples do not replace Android's own posture-aware behavior.
- Keep web layouts container-responsive and use semantic components from the app's UI layer. Do not invent fold geometry or infer physical hardware from viewport width. Preserve XR panel, Rive and renderer contracts; adaptive layout alone does not establish native compositor/system-window support.
- Adapt content to current usable container space and intermediate widths while preserving explicit hardware-specific navigation policies. Protect critical controls, text, faces, scan targets and media focal points from reported folds/occlusions; respect safe areas, RTL and readable text widths. Preserve navigation, selection, scroll, draft input, playback, camera and game/session state through resizing without unnecessary remounts.
- Verify compact/intermediate/expanded layouts, fold/unfold, book/tabletop, spanning where supported, rotation, keyboard, RTL, large text, focus and screen readers. Record the actual platform and checks run; simulated geometry and browser checks are not physical-device validation.

Preserve the shared skills baseline: `expo/skills`, `mattpocock/skills`, `Argent/agent-device`, `coreyhaines31/marketingskills`, `pbakaus/impeccable`, and `petergyang/no-ai-slop`. Use relevant specialist skills too. Animation remains within the project's Kinetrell policy; do not introduce Tamagui, Bento or an unrelated animation stack.

This records a required skill source, not a claim that the full upstream pack is installed or that foldable support is implemented. Report the skills read, affected platforms/files, verification evidence and outstanding SDK/hardware blockers in each relevant PR. Do not upgrade dependencies, rewrite application code, merge or deploy solely to add this requirement.
