# Member profile and saved places

Harlem Might remains fully browsable without an account. Consumer authentication exists only to make personal state portable across devices.

## Identity split

- Payload `users` = CMS/admin identity.
- Payload `members` = consumer identity, authenticated by Better Auth through `@delmaredigital/payload-better-auth`.
- `admin.user` remains `users`.
- Members cannot enter the Payload Admin Panel.
- Both collections live in the same Payload-managed **Neon Postgres** database. Better Auth sessions/accounts/verifications are generated as Payload collections in that same database.

Payload supports multiple authentication collections specifically for this admins/customers split.

## Consumer features unlocked by sign-in

- saved places
- saved walks (next collection)
- accessibility/preferences
- offline collections (future)
- continue an active walk across devices (future)

No public exploration route may require a member session.

## Session transport

Web uses Better Auth's HTTP-only session cookie and `credentials: include`; Payload authorizes `members` through the Better Auth strategy. The auth API is mounted at `/payload-api/auth` (`/sign-up/email`, `/sign-in/email`, `/get-session`, `/sign-out`).
Mobile/spatial clients must use the same Better Auth identity and an approved secure native session/token store when their client implementation lands; do not put credentials in Zustand persistence, AsyncStorage, query strings, or logs.

## Saved places

`saved-places` is a row-owned collection:

```text
member -> saved-place -> canonical place
```

Access control filters every read/update/delete to the authenticated member ID. A before-change hook overwrites `member` from the authenticated request so a client cannot save a row on behalf of another member.

## Routes

- `/sign-in` — member email sign-in through `/payload-api/auth/sign-in/email`
- `/sign-up` — member account creation through `/payload-api/auth/sign-up/email`, followed by sign-in when the signup does not issue a session
- `/profile` — Next and native route adapters use the shared `packages/app/features/auth/MemberProfileScreen`. Vite retains its supported TanStack profile presentation. All hosts use the same Better Auth member identity contract; Vite session state currently remains a separate implementation.
- all other public routes remain signed-out capable
- `/admin` is curator tooling and is not the member profile


## Better Auth relationship invariant

Harlem Might renames Better Auth's semantic `user` model to `member`:

```ts
user: { modelName: 'member' }
```

Therefore the generated Better Auth credential/session collections must resolve their
`user` relationship to Payload `members`, not curator `users`. In Postgres,
`payload.accounts.user_id` and `payload.sessions.user_id` must reference
`payload.members(id)`, including version mirrors. `memberAuthCollections` uses
the plugin's supported collection customization hook to enforce these two
relationships without changing collection access or secret-field protections.
Offline regressions check the actual generated Payload 4 schema and the fork's
Payload 4 authentication metadata.

Keep the Payload 4-compatible `payload-better-auth` pin `5134d0b3...`. The earlier
`f62414cd...` pin was on the Payload 3 branch, lacked the compatible built
artifacts and carried an incorrect archive checksum. Changing its checksum alone
does not restore compatibility. The compatible pin and lockfile checksum are
restored together; the relationship repair is local to this application.

## Database rollout and remaining integration gates

Changing generated relationships does not alter existing database constraints
when `PAYLOAD_PUSH` is false. Before enabling member signup in each environment,
inspect `accounts.user_id`, `sessions.user_id`, and their version mirrors; verify
that every owner is an existing member before a reviewed schema repair. Numeric
IDs can overlap between curator users and members, so never infer ownership from
ID existence alone. Rehearse with a staging copy and keep a rollback plan that
preserves the same identity mapping. Do not use a broad production schema push.

The previously reported production repair is not evidence that every environment
has been migrated. This PR runs no live migration and removes no account data.
Member REST authentication also needs the separately reviewed
`betterAuthStrategy({ usersCollection: 'members' })` configuration in PR #56.
Real-cookie signup/sign-in, duplicate or interrupted signup, revocation and
account-deletion integration remain release gates.
