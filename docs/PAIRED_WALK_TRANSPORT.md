# Paired walk transport: issue 41 draft slice

This is **foreground-only paired handoff source**, not a completed watch
navigation release. It needs the phone journey controller to opt in and publish
an authoritative projection. It never signs in, starts a session from a watch,
creates credentials, grants permissions, or runs autonomous background navigation.

## Binding the phone controller

Import `watchTransport`, `CompanionSnapshot` and `CompanionCommand` from
`apps/mobile/modules/walk-companion`. The Expo module is local/autolinked.

1. Subscribe with `addCommandListener` before publishing. Validate received
   commands against the current phone session using the shared session reducer.
   Re-check owner/login, handoff epoch, session ID, expected revision, action,
   command ID and explicit confirmation. A paired transport is not a substitute
   for backend session ownership or current account authorization.
2. After the user explicitly chooses sharing, call `createHandoffId()` for a new
   random epoch, then `getStatus()`. Require one reachable Wear watch, or the
   paired installed Apple Watch. Use a fresh epoch after account change,
   opt-out, disconnect, expiry or either app going into the background.
3. `publish(snapshot)` only accepts the closed, bounded projection in
   `src/protocol.ts`. `updatedAt` is the time the phone validated/published this
   projection; it is not a fabricated GPS timestamp. Expiry is at most five
   minutes later. An offline or absent route must say so and cannot claim a
   current maneuver, arrival or ETA.
4. `publish` reports scheduling/delivery to the native channel, **not** a watch
   UI acknowledgement. Likewise command receipt is not a completed mutation.
   Publish the validated, persisted new session revision after a successful
   command. The watch never optimistically advances a stop.
5. On rejected commands, publish the current authoritative projection so the
   watch can refresh. Its ten-second timeout says confirmation was not received;
   it does not say an uncertain operation failed. Idempotence belongs to the
   phone/shared reducer and server, not transport success callbacks.
6. Call `clear()` before changing accounts, signing out, changing the current
   session, or disabling handoff. Clear the phone hook's opted-in epoch on
   backgrounding as well. Both native stores also clear on lifecycle or
   connection loss and expire with one-shot timers.

`CompanionCommand` has `schemaVersion: 1`, `commandId`, `sessionId`, `handoffId`,
`expectedRevision`, and `type` (`pause`, `resume`, `stop`, `confirm-stop`). Stop
and stop confirmation require `confirmed: true`; only `confirm-stop` has `stopId`.
The final confirmation action is bound to the exact snapshot displayed when
the dialog was opened. A changing route/session/revision invalidates that action.

## Native boundary

- iOS uses `WCSession.sendMessage` and request/reply for the paired app.
- Android uses Wear Data Layer `MessageClient` and named capability discovery.
  The watch accepts only the selected phone node; the phone accepts commands
  only from the selected watch. Ambiguous multiple reachable nodes fail closed.
- The phone uses monotonic session revisions, handoff epochs and a bounded
  in-memory command-ID set. Native validation is defense in depth; the shared
  command reducer remains authoritative.
- `createHandoffId` registers the sole currently permitted native epoch. Clear,
  expiry, unpair or connection loss revokes it, including before its first
  publication. An old JS publisher cannot restore it; another explicit share
  must create a fresh epoch.
- There is no `updateApplicationContext`, `transferUserInfo`, `DataItem`,
  persistent outbox, private UserDefaults/MMKV/SharedPreferences storage, or
  app-group private storage. Background/offline mutation is intentionally absent.
- Clears carry the handoff epoch. Async request/error callbacks are generation
  guarded so an old failure cannot erase a newer handoff. Snapshots reject
  regressing revisions/timestamps within one epoch.
- Each watch shows the walk, next stop, confirmed progress, status and route
  availability. List/TransformingLazyColumn provide native Crown/rotary scrolling.
  Reconnect state has visible copy; stop confirmation and ending have explicit
  dialogs. Accessibility labels and real small/round displays still need QA.
- Only a newly acknowledged user-action state change can trigger an optional
  native success haptic. It has visible confirmation text. No GPS-derived
  arrival/turn haptics, timer loops, workout sessions or health permissions exist.

The watch's public highlights feed and public widget caches remain separate.
Never pass a complete WalkSession, auth token, owner/member record, saved places,
or precise coordinates to this projection, public widget snapshots, or app groups.

## Native build changes and gates

Wear's application ID is now `com.harlemmight.app`, matching the phone as required
by Google's Data Layer. Its Kotlin namespace stays `com.harlemmight.watch`.
Existing development installs with the former ID need reinstalling; production
upgrade/store listing consequences must be reviewed before distribution. Phone
and watch must use the same signing identity. This change does not provision,
replace, or alter signing credentials.

The watch target explicitly sets watchOS 10, matching its existing vertical-page
UI and the scene-phase callback API. WatchConnectivity/WatchKit are linked there;
the local phone pod links WatchConnectivity.

Wear Compose 1.7.x needs compile SDK 37 per the Android skill's current AAR floors;
the previous project used 36. `compileSdk` is raised to 37, while target SDK stays
36. The stable existing Compose pins are otherwise unchanged. The Data Layer
dependency is `play-services-wearable:20.0.1`, as in Google's current setup guide.

Verified in the Linux source environment:
- Node 24 protocol tests in `apps/mobile/src/walk-companion.test.ts` pass through
  the existing mobile test resolver. They cover minimization, schema bounds,
  TTL, explicit confirmation, and static native storage/parity boundaries.
- These are JS/source checks; they do **not** compile or execute Swift/Kotlin.
- The complete mobile source-test command was attempted: 56 tests passed and
  16 test files failed to load absent workspace/third-party dependencies, including
  Zustand and linked spatial packages. This is not a full mobile test pass.
- Java 21 runtime is present. Xcode/Swift, Gradle wrapper, Kotlin compiler,
  Android SDK/adb and paired devices are unavailable here.

Required before merge/release:
1. Frozen pnpm install with all linked Viro/Mapbox repositories; full mobile,
   shared-package, web and repository tests/typecheck/lint. Existing main already
   includes the widget/Apple Targets lockfile entries; verify rather than assume
   the older foundation docs' missing-lockfile warning still applies.
2. Expo prebuild on the configured native host, then iOS phone and watch scheme
   builds with the production target relationship/provisioning. The phone's Viro
   frameworks are device-arm64; standalone watch simulator QA is separate.
3. Generate the missing Wear Gradle wrapper using the installed, supported
   AGP/Gradle/JDK combination. Install Android SDK 37. Run
   `:app:assembleDebug` and `:app:lintDebug`; build the phone flavor and verify
   local module autolinking, Google Play services and capability resources.
4. Real paired iPhone/Apple Watch and Android/Wear tests, including matching
   signing, phone/watch process death, wrist/background transitions, expired
   payloads, unpair, account switching, duplicate commands, command/result loss,
   old callbacks/clears, conflicting revisions, and confirmation-dialog races.
5. VoiceOver/TalkBack, maximum text size, Crown/rotary, haptics disabled, low power,
   denied notifications/location, airplane mode and small/round screen captures.

## Additional host lifecycle evidence (2026-10-12)

`node tooling/tests/walk-companion/run.mjs kotlin` now compiles and executes the
actual Android phone module and Wear store, as well as the shared production
wire validator. The 36 deterministic lifecycle/callback scenarios use controlled
host boundaries for the main scheduler, Wear capability/message completion,
Expo callbacks and Compose state storage. They cover delayed discovery/expiry,
background and observer revocation, stale callbacks and handoffs, wrong peers,
reconnect, replay caps, timer cancellation and authoritative confirmation.
They reproduced and guard fixes for expired publication after discovery,
ambiguous Wear peers retaining guidance, and guidance surviving a phone switch.

This extends the earlier source-only evidence above; it does not satisfy the
native-target build, actual platform callback/threading or paired-device gates.
No Android SDK, Gradle, Expo runtime, Swift lifecycle, UI or device test is implied.
See `tooling/tests/walk-companion/README.md` for the exact boundary and commands.
Wire schema, Payload 4 and Viro platform support are unchanged.

## Swift callback harness follow-on (2026-10-12)

The same native-companion runner now includes a 39-scenario Swift lifecycle
harness designed to compile the complete production phone module and watch
store against narrowly bounded host framework fakes. It exercises actual Expo
callback registration and WatchConnectivity delegate/store methods, including
queued delivery after unpairing or disconnect. Both bridges now recheck live
transport state when consuming queued requests, commands or snapshots.

This new Swift harness is **not yet compiler-verified in the local Linux
workspace**: `swiftc` is absent. The completed follow-on chain needs the existing
macOS CI compiler to establish the fixed-source pass and exact-guard negative
controls; compiler/runtime failures cannot count as expected regression proof. Local Node
source checks are not Swift execution. Apple SDK/build, runtime, threading,
UI and device evidence remain outstanding. See the test README for the exact
fake boundaries, timer semantics and pending verification.

## Explicitly outstanding issue 41 work

- Independently authenticated watch HTTPS and revocable, narrowly scoped watch
  credentials; encrypted member-scoped persistence; real background/reconnect
  lifecycle. Do not distribute login credentials through this draft bridge.
- ActivityKit Live Activity, a dedicated watch-widget complication target,
  Android foreground navigation notification and Wear Tiles. Expo Widgets must
  remain the sole owner of the phone widget extension. SDK/signing/build proof is
  required before adding those surfaces.
- Verified navigation events for the six semantic haptic cues and audio
  equivalents. This slice has only confirmed user-action success feedback.
- Real hardware/build evidence. Keep issue 41 open and the connected-journey PRs
  draft until the complete release gates are satisfied.

## References reviewed

- [Issue 41](https://github.com/mikevocalz/Harlem-Might/issues/41)
- [Expo overview](https://github.com/expo/skills/blob/main/plugins/expo/skills/expo-overview/SKILL.md)
  and [native modules](https://github.com/expo/skills/blob/main/plugins/expo/skills/expo-module/SKILL.md)
- [Apple Targets watch guidance](https://github.com/EvanBacon/expo-apple-targets/blob/main/skills/apple-targets/watch.md)
- [Android Wear skill](https://github.com/android/skills/blob/main/wear/wear-compose-m3/SKILL.md),
  including its current TransformingLazyColumn and AlertDialog reference samples
- [Data Layer security/setup](https://developer.android.com/training/wearables/data/overview)
- [Expo SDK 58 Live Activity API](https://docs.expo.dev/versions/v58.0.0/sdk/widgets/)
- The issue's `Argent/agent-device` link could not be verified. The separately
  verified [Callstack agent-device](https://github.com/callstack/agent-device)
  documentation describes inspect/act/verify and device-specific capabilities;
  no device automation package was installed or executed, and no substitute
  hardware validation is claimed.
