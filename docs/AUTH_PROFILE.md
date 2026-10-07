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

- `/profile` — optional sign in/create account + saved places
- all other public routes remain signed-out capable
- `/admin` is curator tooling and is not the member profile
