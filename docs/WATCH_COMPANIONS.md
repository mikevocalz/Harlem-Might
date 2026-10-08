# Harlem Might · Watch Companion Engineering Plan

This branch **stacks on PR #38** (which stacks on PR #37). Wear OS and watchOS
consume the public `@acme/widgets` schema; personal walk sessions and secure
paired-device handoff require the next integration phase.

## Apple Watch (SwiftUI)

- Target source: `apps/mobile/targets/harlem-watch`, owned by
  `@bacons/apple-targets@5.0.0` with `type: 'watch'`.
- iOS phone home-screen widgets remain owned **exclusively by Expo Widgets**.
  Apple Targets must not generate a duplicate phone WidgetKit extension.
- `HarlemMightWatchApp` is native SwiftUI, tabs Now / Walks / Today / Saved.
- Public refresh uses `URLSession`, typed Codable snapshots, and offline
  cached highlights; only dates within `expiresAt` are current.
- Mandatory provisioning: configure the watch target Info.plist
  `HARLEM_WIDGET_FEED_URL` (full HTTPS `/api/experience/widgets` URL) through
  Apple Targets target configuration and the project's signing/build pipeline.
  The app deliberately reports **not configured** when this key is missing.
- A watch standalone build must work without iPhone; offline cached public
  stories can display while fresh. Member saves and live walk progress **must
  not** appear until independent authorized watch login and secure transfer.
- Add WatchConnectivity (`WCSession`) for the paired iPhone, and authenticated
  HTTPS fallback for independent cellular/Wi-Fi use. Transport is not yet built.
- The event source is a read-only public CMS projection; it is not a real-time
  navigation service, and can be stale when disconnected.
- Add a watchOS WidgetKit complication *in a dedicated watch-widget target*
  only after compiling the standalone watch app and validating target
  entitlements. Watch complications must not reuse the phone widget extension.

## Android Wear OS (Kotlin/Compose)

- Isolated Android project: `apps/wearos`. No full Expo runtime on the watch.
- Native Compose Material 3 Now / Walks / Events / Saved views. No HealthKit,
  Fit, or health permissions required for a cultural tour.
- Supply `HARLEM_WIDGET_FEED_URL` in local/CI Gradle properties.
- **Before merge:** create the Gradle wrapper using the installed Android
  Gradle Plugin/Gradle supported version; do not check in a guessed generated
  wrapper. Run `:app:assembleDebug` and `:app:lintDebug`.
- Implement Google Wearable Data Layer sync for paired phone/watch and
  authenticated HTTPS when standalone. The public feed intentionally does
  not expose personal saves or live route progress.
- Add Tiles/complications with stable Wear OS APIs only after wearable
  device tests. Avoid alpha dependencies in production without an approved
  compatibility matrix.

## Take Me There secure handoff (follow-on milestone)

1. Phone accepts a published curated Walk and constructs a `WalkSession`.
2. User opts into transferring the minimum necessary stop names/IDs, route
   summary and current session revision to the watch.
3. Native watch persists encrypted member-scoped session state; no user
   credentials in app group data, widgets or open intents.
4. Both devices apply idempotent `confirmStop`, monotonic revision handling,
   explicit pause/resume, and server authorization of session updates.
5. Mapbox walking routes use verified endpoints/entrances and safe sidewalk
   guidance; don't claim step-free paths without sourced evidence.
6. Approaching-turn and arrival notifications use supported native watch
   foreground/notification behavior. Pulsar handles mobile-only haptics.
7. Offline route cues can be viewed if preloaded; rerouting requires network
   or an actually available offline engine.

## Production gates

- `pnpm install --lockfile-only` for @bacons/apple-targets, Expo Widgets,
  Android Widget and @acme/widgets; commit frozen lockfile.
- `npx expo prebuild --clean -p ios` followed by Xcode scheme build (including
  watch app target), watch simulator and physical Apple Watch checks.
- Run independent Wear OS Gradle builds on supported JDK/Android SDK; round
  display and physical Pixel/Samsung watch QA.
- Verify watch and phone deep links; source freshness and cancelled event
  behavior; sync across airplane mode, account switch, and watch reinstall.
- Test VoiceOver/TalkBack, reduced motion and haptics disabled by user/system.
- No user-facing release copy can claim turn-by-turn navigation or live watch
  sync until the secure transport and route progress bridge are complete.

## Binding skills and resources

- Apple Targets: https://github.com/EvanBacon/expo-apple-targets/tree/main/skills/apple-targets
- Apple Watch skill: https://github.com/EvanBacon/expo-apple-targets/blob/main/skills/apple-targets/watch.md
- Official Expo: https://github.com/expo/skills
- Android Wear samples: https://github.com/android/wear-os-samples
- Android UI skills: https://github.com/android/skills
- Android widget docs: https://saleksovski.github.io/react-native-android-widget/docs
- Device QA: https://github.com/Argent/agent-device
- TS: https://github.com/mattpocock/skills
- Motion: https://github.com/mikevocalz/Kinetrell
- Design: https://github.com/pbakaus/impeccable
- No slop: https://github.com/petergyang/no-ai-slop
