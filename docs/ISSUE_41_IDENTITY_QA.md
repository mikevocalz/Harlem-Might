# Issue #41: identity and watch revocation repair

## Validation record scope

This document preserves a historical review. The original local totals below
do not identify an exact tested-head SHA or hosted run ID. They are historical
context, not acceptance evidence for the current PR head.

A later, separately verified snapshot is commit
`3a7cef7b8ea65dc7792ee4b3780cfc64adb25a2a`, tree
`219b81a0d13465fd4ffc81ec4e657011bdb8522e`.
[CI run 38169026504](https://github.com/mikevocalz/Harlem-Might/actions/runs/38169026504)
passed 942 tests and all 28 build/typecheck/lint tasks. Its actual checkout,
`3bc02921357c00de26de0f4794d3d4f80f8699d3`, has that same tree. This records
that snapshot only; later revisions require their own checks. Hosted source
checks do not establish native compilation or real-device acceptance.

## Scope and integration

This repair is based on the combined `feat/issue-41-integrated` snapshot
`5113d383d4545fc04f496f422f2bce47efc15976`. It targets that branch so the diff is
reviewable independently from the feature stack. The integrated branch combines
#56 member sessions with #59 owner sessions, #60 paired watch handoff, #61 phone
journeys, and their identity subscription. This draft does not merge the feature
parents or establish a release path to `main`; #54's auth relationship prerequisite
and the issue #41 acceptance gates still apply. Concurrent music/layout work is
not included.

## Repaired behavior

1. An initial member journey cannot be restored by a delayed start response after
   logout or a known account switch. Controller and transport cancellation are
   synchronous; transport requests also receive an abort signal.
2. A cancelled identity lookup cannot overwrite the transport owner of a later
   journey. Request generations are checked after both HTTP completion and body
   parsing, and before follow-on writes.
3. Old session reads cannot restore the previous member after logout. Session
   generation and latest-request identity guard every state update.
4. Old saved-place reads cannot populate a different account's list. Owner,
   deployment origin, session generation, and latest list request must all match.
5. An avatar upload's follow-on profile write stays bound to its initiating
   account and session generation, including sign-out/sign-in with the same ID.
   The auth-action factory establishes that boundary before any cookie-changing
   POST, preventing initial hydration and uploads from racing a delayed login
   response body. Registration and its follow-on sign-in share the boundary;
   overlapping attempts are refused and cancellation suppresses later POSTs.
6. Watch clear/opt-out bypasses a pending native publication. Restart waits for
   the clear barrier; old queued work and send completion cannot publish into or
   unlock the new handoff.

The watch sources also supersede older reconnect success/error callbacks after
any accepted snapshot, including the first snapshot and a newer snapshot in the
same handoff. A separate reconnect generation preserves pending-command guards.

Same-owner late hydration is explicitly supported: if a journey transport has
already verified owner A, the member mirror first observing A does not cancel
that walk. A known logout/different owner still revokes immediately. Existing
anonymous journeys are preserved by member-mirror updates.

## Regression coverage

The original seven desired-safe tests, covering the six reproduced defects,
pass unchanged. An additional production-submit/HTTP-boundary harness verifies
that pending initial hydration cannot reveal A or apply A’s image during B login.
This executes shared application logic with explicit network/navigation doubles;
it is not a browser or device end-to-end claim. Permanent regression coverage is in the normal package test
commands:

- `packages/app/features/auth/member-session.test.ts`: 36 real-store tests,
  including delayed body parsing, ignored aborts, repeated account switches,
  same-account success, pending logout, and legitimate retry behavior.
- `packages/app/features/auth/member-auth.test.ts`: 16 auth-entry lifecycle
  tests, including pending hydration, response-body delays, overlapping attempts,
  signup/sign-in cancellation, pending logout, and failure/retry.
- `packages/app/features/journey/identity-lifecycle.test.ts`: 8 tests using the
  real controller, transport, reducer, and production identity subscription.
- `apps/mobile/src/watch-handoff.test.ts`: 15 tests executing the actual
  TypeScript handoff body and controller with explicit native/AppState/timer
  boundary mocks.
- `apps/mobile/src/walk-companion.test.ts`: 10 protocol/source-invariant tests.
  Swift/Kotlin assertions check source guards; they do not execute native code.

Commands from the repository root:

```sh
pnpm --filter @acme/app test
pnpm --filter mobile test
pnpm --filter mobile test:scripts
pnpm --filter @acme/payload test
pnpm --filter @acme/widgets test
pnpm --filter @acme/spatial test
pnpm --filter web test
pnpm turbo run build typecheck lint
```

## Historical local validation and limits

- 757 package tests passed: shared app 476, mobile 203, Payload 17, widgets 9,
  spatial 23, web 22, mobile scripts 7.
- Two additional mobile test files could not load the private Viro dependency.
- Shared app typecheck and changed-file lint passed.
- Aggregate build/typecheck/lint: 25 of 28 tasks passed. Mobile lint/typecheck
  remained blocked by the private Viro fork; Next production build reached
  font compilation but could not fetch Inter/Roboto Mono from Google Fonts.
- Independent adversarial review added delayed-body, ignored-abort, repeated
  owner, hydration, and native-clear barrier checks. No supported actionable
  finding remained in the reviewed repair.
- The cloud checkout reused the previously installed dependencies without
  changing manifests or the lockfile. This is not a successful fresh frozen
  install. The PR's exact-head CI must validate the pinned private dependencies
  and complete build/typecheck/lint gates.

Native Xcode/Gradle compilation, actual pairing/unpairing, device-loss and OS
callback ordering, real GPS walks, browser-cookie end-to-end authentication,
staging migration rehearsal, screenshots/accessibility/battery, and retention
cleanup remain unverified. Native independent authentication and background/live
surfaces are not implemented by this repair. Issue #41 stays open.

An abort cannot undo a request the server already accepted. This repair prevents
stale continuations and local cross-account display/writes after observed identity
boundaries; it does not claim rollback, solve every cross-tab cookie race, change
media cleanup policy, or redesign the pre-existing server-logout error UI.
No production migration, credential operation, merge, or deployment was performed.
