# Take Me There: issue 41 acceptance audit

Audit date: 2026-10-11. Base: main `3a997853` (includes PRs 37–40 and 57).
The old issue/checklists describe a connected journey, not the absence of every
foundation. Main already had public widget/watch projections, Mapbox navigation
models/provider/state, semantic Pulsar cues, and Viro scenes. These changes reuse
those implementations. **Issue 41 remains open; this is not a native release.**

## Review slices

1. [PR 59](https://github.com/mikevocalz/Harlem-Might/pull/59): owner-scoped
   sessions, strict commands/revisions/replay, migration and negative tests.
2. Paired native companion source: depends on slice 1; publishing paused after
   cancelled GitHub approval. Native Swift/Kotlin code is not compiled here.
3. Shared phone journey, location/lifecycle truth, story and Viro handoff:
   depends on slices 1 and 2; source reviewed and preserved for a later draft.

## Acceptance matrix

| Issue requirement | Implemented / retained | Outstanding acceptance |
| --- | --- | --- |
| 1. Route planning and data truth | Existing Mapbox adapter hardened against malformed/empty routes and unsafe error details. Walking starts at fresh real GPS; destinations require sourced verified coordinates. HUD distinguishes planned estimates from live progress. | No verified entrance field exists; map-point destination is explicit. No step-free promise. Real street/GPS/wrong-way QA remains. |
| 2. Walk sessions | Published canonical ordered stops; web cookie owner-scoped service; native/browser anonymous local-only sessions; explicit confirmation; CAS/replay ledger; no clock-based conflict merge. | PR 54 auth relationship fix, real-cookie integration and staging migration/retention rehearsal. Native member credential storage remains absent. |
| 3. Secure paired sync | Foreground WCSession / Wear MessageClient, explicit opt-in, bounded minimized memory-only projection, native handoff epoch/revision/expiry/clear guards; no tokens/GPS/member saves in public widgets/app groups. | Independent scoped authenticated watch HTTPS is unsupported, not simulated. Real signing, pairing, unpair and device-loss tests. |
| 4. Phone UX | Canonical Place/Walk Take Me There actions, shared current-stop/session controls, precise live-GPS gates, offline synopsis, optional watch handoff. Cancellation cannot override a newer Explore trip or leak an owned GPS feed. | Native runtime/screenshots and complete merged account-menu integration with PR 56. |
| 5. Watches | Next-stop/status/guidance, explicit confirm, reconnect text, native Crown/rotary lists; source-level lifecycle clearing. | Real native builds, notification-aware background navigation and hardware/accessibility evidence. Foreground-only is deliberately visible. |
| 6. Live surfaces | Public widget foundations remain separate and unchanged. | ActivityKit, dedicated watch complication target, Android foreground navigation notification and Wear Tiles remain unimplemented pending SDK/signing proof. |
| 7. Haptics | Existing phone semantic vocabulary now receives verified route/user-action events; deduplicated opt-out/foreground gates and visual text. Native watch success cue follows acknowledged action only. | Full six-event native watch cues/audio equivalents and real muted/reduced-motion/notification QA. No background haptic loop. |
| 8. Story / AR | Foreground published sourced text-only excerpts, dates/citations, real Viro capability check and shared controller/route; non-AR reading remains available. | No newly licensed audio assets; rights/editorial review and actual camera/tracking/hardware fallback QA. |

## Verified evidence

- Final integrated frozen SDK 58 install passed with pnpm 12.8.1 and
  `--ignore-scripts`; this does not compile native code or validate postinstall.
- Shared app: 413 tests passed, including stale GPS, live-vs-planned guidance,
  host lifecycle, route-intent cancellation, compass forwarding, story source
  rules, owner switches/revocation and command conflict/retry behavior.
- Payload: 17 tests passed; Widgets: 9 tests passed. PGlite executes actual
  scoped SQL and checks pinned Payload-generated DDL parity, race/replay/owner
  isolation and account deletion. No live database was used.
- Focused Expo location + paired wire/source checks: 11 passed. Mobile script
  tests: 7 passed. Independent review passed 41 phone-focused tests, including
  11 pending-route regressions, and found no remaining concrete source blocker.
- Shared app (including content), Payload and Widgets TypeScript passed.
  Changed shared/mobile TypeScript/TSX scoped ESLint and git diff checks passed.
- PR 59 head `764b7c3` GitHub CI run `38117610515` completed successfully,
  including frozen install, all declared suites, full build/typecheck/lint and
  deployable artifact checks. This evidence covers the session slice only.
- Full mobile host suite: 180 passed, 3 files could not load linked packages
  (`earcut` from the Mapbox checkout and `@viro-external/meta-layout`). Mobile
  TypeScript also cannot validate against the unavailable actual private Viro
  and Viro External checkouts. Do not treat these as full passes.
- The combined full-workspace Turbo run was attempted: 20 tasks succeeded;
  mobile reported those linked-dependency errors and web build exited 137.
  The integrated native/phone stack has no all-workspace green build claim.
- No Xcode/Gradle compile, native signing, simulator screenshots, device GPS,
  VoiceOver/TalkBack, battery or physical paired-device tests were performed.
  GitHub CI status is attached to each published head, not inherited from main
  or another PR. Host CI cannot establish native/device gates by itself.

## Security and concurrent-work reconciliation

Review covered owner enforcement, revoked/expired login, Origin/JSON size gates,
replay/CAS, cancellation, GPS/token minimization, bounded offline cache and
paired-transport lifecycle limits. Independent HTTPS and native member auth were
left closed rather than shipping persistent credentials without provisioning.

PR 54 owns the Member Account/Session FK correction; this work does not change
those relationships or the auth fork. PR 56 at `54cd4a5` introduces
`useMemberSession` in `packages/app/features/auth/member-session.ts`, including
profile/photo changes. The journey does not copy that unmerged store. When
combined, clear the journey/native epoch immediately on its identity/sign-out
transitions, retaining server checks on every command. A profile UI does not
prove secure native authentication. No other PR's CI result is evidence for
these integrated changes.

See [session security](WALK_SESSIONS.md), [paired transport](PAIRED_WALK_TRANSPORT.md)
and [phone journey](PHONE_WALK_JOURNEY.md) for exact APIs, constraints and test
commands. Rollout requires explicit remaining gates, not broad schema push or
silent fallback to another owner's/local session.
