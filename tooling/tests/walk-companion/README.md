# Compiled companion contract tests

Run from the repository root (Node from `.nvmrc`):

```sh
node tooling/tests/walk-companion/run.mjs kotlin  # JDK 17+; Maven Central access on first run
node tooling/tests/walk-companion/run.mjs swift   # installed Swift/Foundation toolchain
```

Both runs compile the **existing production** `CompanionWire.kt` or
`CompanionWire.swift` together with a small executable wire test harness. It does not
copy, transpile, extract predicates from, or reimplement either validator. The
Swift run also requires the phone and watch source copies to be byte-identical.

Both suites consume the same `fixtures.mjs` payloads: accepted and rejected
snapshot/command JSON, bounded fields and wire size, required fields, timestamps
and expiry, progress/revision floors, route/instruction and status/next-stop
relationships, command identity, explicit confirmation, and handoff/session/
revision/stop binding. Accepted payloads must round-trip without changing their
fields. Each command test supplies a previously installed snapshot, including
ones that have since expired. Payload timestamps are created **after compilation**
to avoid compiler/download time expiring the tests; no timer sleeps are needed.
Kotlin also checks exact expiry and 30-second clock-skew millisecond boundaries
through its existing `fresh(snapshot, now)` entry point.

## Host tooling and provenance

- Kotlin compiler **2.3.20** matches `apps/wearos/build.gradle.kts`. Compiler
  dependencies are pinned from its published Maven POM. The script fetches only
  `https://repo.maven.apache.org/maven2/`; every downloaded or cached JAR is checked
  against the committed SHA-256 manifest before any compiler/test code executes.
  JARs stay in the OS temporary directory, outside app dependencies and pnpm.
- The Kotlin tests use the real Android `org.json` implementation extracted in
  `com.vaadin.external.google:android-json:0.0.20131108.vaadin1`, not a mock or the
  Android SDK's throwing stub classes. This is host-side parser coverage with an
  older Android JSON implementation, **not proof of behavior on current ART/SDKs**.
- The independent `Native companion wire` workflow uses Java on `ubuntu-latest`
  and the existing Swift/Xcode command-line tools on `macos-15`. It needs no Expo
  dependency installation, private repository token, Gradle, Android SDK, device,
  signing credentials, or app target changes. Compiler versions appear in logs.

References: [Kotlin compiler](https://kotlinlang.org/docs/command-line.html),
[Kotlin compiler POM](https://repo.maven.apache.org/maven2/org/jetbrains/kotlin/kotlin-compiler-embeddable/2.3.20/kotlin-compiler-embeddable-2.3.20.pom),
[Android JSON POM](https://repo.maven.apache.org/maven2/com/vaadin/external/google/android-json/0.0.20131108.vaadin1/android-json-0.0.20131108.vaadin1.pom),
[macOS runner image](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md).

## Production Android lifecycle and callback tests

The Kotlin run additionally compiles **the complete, unmodified-at-test-time
production source files** `WalkCompanionModule.kt` and Wear's `WalkCompanion.kt`
into the executable with `CompanionLifecycleTests.kt`. Tests call the callbacks
registered by the actual Expo `definition()` and the actual Wear listener/store
methods. There is no copied state machine, predicate extraction, source rewriting,
or regex-based lifecycle assertion in this suite. A relay case runs both actual
stores through publication, command emission, authoritative confirmation and
background revocation.

Production defaults to `Clock.systemUTC()`; the injected `java.time.Clock` and
wire parser's optional `now` arguments permit exact deterministic expiry checks.
The phone's public zero-argument constructor remains available and is tested.
`platform-fakes/` supplies only host boundaries for APIs unavailable without the
SDK: Context/React lifecycle, Expo callback registration and Promise/event capture,
Compose state delegates, a main-handler queue with removable one-shot timers, and
controllable Wear capability/message Tasks. These files are outside app source
sets and are compiled only by this runner. Transport completion is explicit and
runs through the fake main queue, allowing old successes/failures to arrive after
revocation, a newer reconnect, or a new handoff. Virtual time has no sleeps.

The 36 lifecycle/callback cases cover:
- Foreground/observer requirements; background, observer removal and destruction;
  pending authorization/publication cancellation and listener removal.
- Publication expiring during discovery, expiry during a stalled refresh, and
  replacement/cancellation of expiry and command timers.
- Wrong peers, ambiguous capabilities, switching phones, stale clears/handoffs,
  delayed lookup/send callbacks, reconnect supersession and freshness at expiry.
- Exact native command-event expiry, replay deduplication and its 128-entry cap;
  stale confirmation snapshots; receipt versus authoritative revision; pending
  cancellation and success-feedback state only after matching confirmation.

Before the fixes, executable regression cases fail for three real defects:
publication after lookup outlives TTL; ambiguous Wear peers retaining guidance;
and reconnect carrying a previous phone's snapshot into a replacement peer.

## Coverage boundary

These are **host tests of production Kotlin behavior with fake platform APIs**,
not Android instrumentation or SDK compatibility/build proof. The fakes do not
model ART, Binder, Google Play services, real Task/Looper threading, Expo's
runtime/autolinking, Compose recomposition, device pairing, OS process death,
actual UI or hardware haptics. The success-feedback counter is asserted; no
physical haptic is executed. The Swift run still covers **wire validation only**;
Apple lifecycle and WatchConnectivity callbacks are not executed by this harness.

Keep the existing JS bridge behavior tests and static storage/API prohibitions.
Real Android/Apple target builds and the paired-device release gates in
`docs/PAIRED_WALK_TRANSPORT.md` remain outstanding.
