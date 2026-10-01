# Phase 8 proposal — hinge awareness via `WindowInfoTracker` / `FoldingFeature`

**Proposal only. No code was written for this, by instruction.**

## What exists today

Pane placement is driven entirely by `useWindowDimensions()` width in dp, mapped
to the Material 3 width classes. That is correct for phones, tablets, desktop
windowing and split-screen. It is *blind* to one thing: on a foldable, part of
the window may be physically occluded or angled.

An unfolded Pixel Fold or Galaxy Z Fold reports a single wide window. We happily
render a sidebar + detail into it. Neither we nor React Native know that a hinge
runs down the middle of that window, so a pane boundary can land on the fold and
a detail pane can straddle it.

## What the native seam would buy

`androidx.window.layout.WindowInfoTracker` emits a `WindowLayoutInfo` stream of
`DisplayFeature`s. The one that matters is `FoldingFeature`, which carries:

- `bounds` — the hinge rectangle **in window coordinates**, which is the piece
  we cannot derive from JS at all
- `orientation` — `VERTICAL` / `HORIZONTAL`
- `state` — `FLAT` / `HALF_OPENED`
- `occlusionType` — `NONE` / `FULL`
- `isSeparating`

Concretely it enables three things:

1. **Snap the pane split to the hinge.** Instead of `w-pane-primary`, the leading
   pane takes the width of the hinge's leading edge, so the divider *is* the
   fold. This is the single biggest visual win and is impossible to fake from
   width alone.
2. **Avoid straddling.** When `isSeparating` is true and a pane would span the
   hinge, choose a different arrangement rather than splitting content across a
   physical seam.
3. **Tabletop posture.** `HALF_OPENED` + `HORIZONTAL` is the laptop-style
   posture; the convention is content above the fold, controls below. For the
   schedule calendar that is a genuinely better layout: grid on top, booking
   controls on the bottom half.

## Cost

- A new Android native module: a `TurboModule` or Expo module wrapping
  `WindowInfoTracker.getOrCreate(activity).windowLayoutInfo(activity)`, which is
  a Kotlin `Flow` bound to activity lifecycle, bridged to JS as an event
  emitter. Adds `androidx.window:window` (~ a few hundred KB).
- Lifecycle correctness is the real cost, not the API surface: the flow must be
  collected on `STARTED` and cancelled on `STOPPED`, and re-emit on
  configuration change. Getting this wrong leaks an activity reference.
- Testing requires either physical foldables or the Android Studio foldable
  emulators with posture controls. Neither is in this project's current loop, so
  it would ship largely unverified — the same objection that kept the scroll-sync
  Reanimated work out of Phase 6.
- iOS parity is nil. It becomes a permanently Android-only branch in a module
  whose entire selling point is a byte-identical call site.

## Where it belongs

**Upstream in `react-native-screens`, not in this app.**

Reasons:

1. It is not app logic. Hinge geometry is a platform capability, exactly like the
   window size class, and every adaptive Android app needs the identical binding.
2. `react-native-screens` already owns the Android windowing seam and already
   ships the unwired C++ (`RNSSplitScreenShadowNode`, `…ComponentDescriptor`,
   `…State`). If `split/` ever gains a real Android implementation, hinge
   awareness belongs inside it, and an app-level module would then be duplicate
   machinery competing with the native one.
3. Solving it here means every consumer of this pattern re-solves it, each with
   their own lifecycle bugs.

## Recommendation

Do not build it in this app. The width-class layout is correct on every device
including foldables — it is merely *unaware* of the hinge, which is a polish
gap, not a correctness bug. If foldables become a target, the right first move is
an upstream issue on `react-native-screens` proposing `FoldingFeature` plumbed
through the existing gamma window seam, since that is where the Android split
implementation would have to live anyway.

Interim mitigation available with zero native code: keep pane widths tokenised
(already true), so if a hinge binding ever arrives, only `constants.ts` changes.
