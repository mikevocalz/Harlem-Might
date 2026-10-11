# Private walk sessions (#41)

This slice implements a versioned command protocol and an owner-scoped persistent
session service. It is not a complete watch navigation release. Phone-only,
anonymous walks use the same pure reducer locally and must never be uploaded or
silently attached to a later account.

## Contract

`@acme/widgets/walk-commands` exports `WalkCommand`, `WalkCommandResponse`,
`validateWalkCommand`, `walkCommandFingerprint` and `applyWalkCommand`.
`validateWalkSession` validates snapshots before use. Both validators throw and
accept only schema version 1, exact allowed fields, bounded IDs/stop arrays and
consistent, ordered progress. IDs match `[A-Za-z0-9_-]{1,128}`. Published Walks
have 2–100 unique stops. A Place's directions are not a synthetic Walk.

Commands contain `schemaVersion: 1`, `commandId`, `sessionId`, `type` and
`expectedRevision`:

- `start`: `expectedRevision: null`, plus the canonical published `walkId`.
- `pause`, `resume`: an integer expected revision, with no extra fields.
- `stop`: an integer expected revision and `confirmed: true`.
- `confirm-stop`: an integer expected revision, `stopId`, `confirmed: true`.

Start data comes from the server's published Walk, not client-supplied stop IDs,
progress, location, title or owner. Explicit confirmation advances one ordered
stop. GPS/arrival signals alone cannot complete it. `stopped` and `completed`
are terminal; neither can be resumed. A repeated semantic no-op does not advance
the public revision. Conflicting equal-revision snapshots cannot be merged by
choosing the newest device clock or the most progress.

The pure reducer does not own a command ledger: local and paired transports must
deduplicate command IDs before applying it. Never apply an arbitrary snapshot
received from a watch to a server session.

## HTTP surface

- `POST /payload-api/walk-sessions/command`: exact command JSON, maximum 4 KiB.
- `GET /payload-api/walk-sessions/:sessionId`: private current state.
- Success: `{ schemaVersion: 1, session, replayed }`.
- Revision mismatch: HTTP 409 `{ schemaVersion: 1, code: 'revision-conflict', session }`.
- HTTP 401: signed out, revoked, expired or unsupported authentication.
- HTTP 404: unknown session for this owner, or no published Walk for a new start.
- HTTP 409 `command-id-conflict`: the same command ID was reused for different input.
- HTTP 503: a closed failure with no database/credential details.

For writes, send `Content-Type: application/json`, the actual trusted browser
Origin and `credentials: 'include'`. Missing/untrusted origins fail closed. The
current service deliberately supports Better Auth's existing web session cookie;
it does not claim native credential storage or standalone watch auth exists.
All responses are `private, no-store` and vary on Cookie/Origin.

On conflict, replace the visible state with the authoritative session, discard
any obsolete proposal, and require a new user action with a new command ID and
that revision. A network retry of the exact same command uses its original ID.
The server checks the receipt before its expected revision and returns the latest
state, not a stale historical snapshot. Start retries cannot reset a walk.

## Authentication, isolation and storage

Each request resolves the member through the plugin-owned
`payload.betterAuth.api.getSession` with `disableCookieCache: true` and
`disableRefresh: true`. It checks expiration and matching user/session identity.
The member comes from verified authentication only; neither `req.user` nor a
body/header owner hint can override it. Every storage read rechecks login after
I/O before exposing a snapshot, including replay and conflict responses. Mutations
recheck immediately before and after the storage write. If revocation overlaps
an already committed write, the response is 401 without private state; the
atomic receipt still makes a later authorized retry safe. These checks do not
claim a cross-table transaction that retroactively cancels a committed write.
The configured Better Auth model is `member`; curator `users` are separate.
PR #54's auth relationship repair remains a prerequisite and is unchanged here.

Generic REST/GraphQL CRUD, admin views, versions and document locks are disabled
for `walk-sessions`; the collection is absent from the MCP allowlist. The only
HTTP writes go through the command endpoint. Server SQL always binds the owner
and opaque session ID. Parameterized compare-and-swap checks a private generation
counter in the final UPDATE, not a read followed by unconditional Payload update.
That counter also protects receipt writes for no-op commands. A unique owner-key
constraint resolves concurrent starts. Snapshots and receipts update atomically.

The ledger retains up to 1,024 command receipts plus a reserved final Stop. It
never evicts an old ID and then accidentally executes that command again. At the
limit, other new commands return `command-limit`; start a new session after
stopping the old one. No login tokens, member records, coordinates, route geometry
or arbitrary extra command fields are stored in snapshots/receipts.

Payload's generated member FK uses ON DELETE SET NULL. It is nullable so this
collection cannot block account deletion. Every read/write still requires a
verified, existing owner, making an orphaned row inaccessible. Automated orphan
cleanup and a retention policy are NOT implemented: decide and test them before
release; do not claim that deleting an account erases these rows today.

## Standalone watch security boundary

GET/POST `/payload-api/watch-walk-sessions` return HTTP 501
`watch-session-unsupported`. Bearer authorization is rejected on the phone
session service. There is no watch credential issuance, persistent grant,
device registry, trusted unpair lifecycle or independent watch HTTPS support.
An unpaired device has no newly-created credential to keep using here.

Any paired bridge must require explicit opt-in and the current account/handoff
epoch, minimize and hold its snapshot ephemerally, and clear it on logout,
account switch, unpair, timeout or app restart. Validate and strip handoff-only
fields before validating `WalkCommand`. A bridge may forward current explicit
intent to the authenticated phone; it may not turn a public widget feed or an
unverified local envelope into server authorization. Watch credentials must not
be copied into app-group storage, WidgetKit timelines or Data Layer payloads.

## Schema and rollout gates

`src/walk-sessions/schema.ts` was generated from the actual
Payload/db-postgres 4.0.0-canary.39 WalkSessions schema. Its scoped additive
migration is `src/migrations/20261011_000000_walk_sessions.ts`:

- Creates only `payload.walk_sessions` and its owner indexes/member relationship.
- Does not alter `members`, `sessions`, `accounts`, their FKs or auth permissions.
- Does not run automatically at application startup. Existing `PAYLOAD_PUSH`
  behavior is unchanged and normally false.
- Requires the existing `payload.members` table and a reviewed production schema
  baseline. Rehearse `payload migrate` against a staging copy before deployment.
- Never use a broad schema push against production to get this table. Regenerate
  full Payload types/schema with the final integrated config and review the diff.
  Existing deployments need the new table before enabling this endpoint.
- Rollback drops session data. Take the required backup/retention decision first.

No live database migration, production credential change or deployment was
performed as part of these tests.

## Verification and remaining gates

`pnpm --filter @acme/widgets test` covers strict commands/snapshots, ordered
confirmation, pause/resume/cancellation, malformed versions and reconciliation.
`pnpm --filter @acme/payload test` covers ownership, account switch, revoked
sessions, publish filtering, CSRF, size limits, response privacy, command replay,
concurrent no-ops and revision conflicts. The PGlite integration test initializes
the real Payload adapter without a database connection, compares its generated
DDL to the scoped migration, then runs actual PostgreSQL SQL for race/replay,
owner isolation and account deletion. It never connects to a live database.

Source inspection verified the pinned plugin exposes `payload.betterAuth` and
preserves custom endpoints, and Better Auth 1.7.7 supports both query switches.
End-to-end real-cookie plugin tests, deployed database migration checks, final
frozen-lockfile/full-workspace checks and physical phone/watch QA remain release
gates. This service does not close independent watch authentication, unpair
revocation of future watch credentials, ActivityKit/Tiles or hardware acceptance.
