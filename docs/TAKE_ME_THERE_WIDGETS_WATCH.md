# Harlem Might — Take Me There: Widgets, Watch, Haptics

## Product contract

Discover a published place, walk or cultural story on a widget; continue on
the phone; optionally hand off an active walk to Apple Watch or Wear OS; when
arriving, offer the verified history of the place and, if supported, a Viro AR
view from the phone. Navigation is useful even when the user declines AR.

## Implementation sequence

1. [x] Shared, tested content and walk-session contracts in `@acme/widgets`.
2. [ ] Expo SDK 58 `expo-widgets` iOS home/Lock Screen target and ActivityKit
   prototype; do not load app state or asynchronous work in widget functions.
3. [ ] `react-native-android-widget` home widget via Expo plugin, task handler
   registered once alongside `expo-router/entry`; verify widget resize/snapshot.
4. [ ] Apple Watch SwiftUI native target via `@bacons/apple-targets` and Android
   Compose Wear OS module; independent watch networking + paired-device sync.
5. [ ] Mapbox walking-route adapter + navigation progress policy, with preloaded
   offline stops and on-device local instructions when reliable.
6. [ ] Pulsar semantic cues on phones, WK haptics / Android watch vibration on
   watches; never rely on always-on background haptic execution.
7. [ ] Device QA and release gates.

## Widget catalog

- **This Is Harlem**: editor-approved sourced daily story. Small/medium/large.
- **Happening in Harlem**: nearest current sourced and verified event. Never
  display stale, postponed, cancelled or unsourced events as current.
- **My Harlem**: saved CMS place; signed-out users get a clear CTA, not fake saves.
- **Take Me There**: current walk and next confirmed stop; live progress comes
  from foreground navigation or native system-supported background surfaces.

All widgets share brand theme tokens, but each native renderer uses platform
idioms. Android launcher widgets, WidgetKit extensions and watch applications
have different lifecycles and need separate tests.

## Native ownership

- iOS widget extension: **Expo Widgets only**.
- Apple Watch and its complication targets: **@bacons/apple-targets**, with
  a target ownership/entitlements check to avoid duplicate widget bundles.
- Android home widgets: **react-native-android-widget**.
- Wear OS: **Jetpack Compose**, Wear Tiles on supported stable APIs.
- Shared: **packages/widgets**. Do not invent a universal widget rendering
  runtime; this is a shared contract and UI design system.
- Pulsar is already in `apps/mobile/package.json` and `@acme/ui/haptics.native`.
  Extend the semantic vocabulary rather than installing a duplicate library.

## Review / acceptance gates

- iOS + Android: widget refresh from real Payload-published content and from
  emptied/expired data; CTA deep links open the *correct* app destination.
- Native watch: cold start without paired phone; dropped sync, airplane mode,
  session reconciliation and resuming a pause.
- Navigation: no automatic stop completion without a verified arrival or user
  confirmation; respect step-free accessibility evidence.
- Haptics: muted/off, accessibility prompts, no feedback on routine background
  refresh; reduced motion.
- Privacy: no session token, precise location, member email or private saves
  in public widget timeline storage.
- QA: baseline screenshots, dynamic type, VoiceOver / TalkBack, battery,
  network, light/dark mode, resizing and event cancellation.

## Engineering resources / skills

- https://github.com/EvanBacon/expo-apple-targets/tree/main/skills/apple-targets
- https://docs.expo.dev/versions/v58.0.0/sdk/widgets/
- https://saleksovski.github.io/react-native-android-widget/docs
- https://github.com/expo/skills
- https://github.com/Argent/agent-device
- https://github.com/mattpocock/skills
- https://github.com/pbakaus/impeccable
- https://github.com/petergyang/no-ai-slop
- https://github.com/mikevocalz/Kinetrell
- https://docs.swmansion.com/pulsar/sdk/react-native/

Use product design, iOS/watchOS, Android/Wear OS, Expo, animation, backend
security, reliability, accessibility and device-QA reviewers for each PR.
No placeholders disguised as production events, live locations or linked
watch sessions.
