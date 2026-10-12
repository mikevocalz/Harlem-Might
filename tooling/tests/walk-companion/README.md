# Compiled companion wire tests

Run from the repository root (Node from `.nvmrc`):

```sh
node tooling/tests/walk-companion/run.mjs kotlin  # JDK 17+; Maven Central access on first run
node tooling/tests/walk-companion/run.mjs swift   # installed Swift/Foundation toolchain
```

The runner compiles the **existing production** `CompanionWire.kt` or
`CompanionWire.swift` together with a small executable test harness. It does not
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

## Coverage boundary

These tests execute pure wire validation only. They do **not** compile the phone
or wearable app targets, execute native lifecycle transitions, test timer or
scheduler cancellation, replay/deduplication stores, WatchConnectivity/Wearable
callbacks, pairing, device transport, UI, or haptics. Keep the existing JS bridge
behavior tests and static storage/API prohibitions. The native build and paired
device release gates in `docs/PAIRED_WALK_TRANSPORT.md` remain outstanding.
