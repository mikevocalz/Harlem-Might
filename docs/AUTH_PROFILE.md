# Member profile and saved places

Harlem Mights remains fully browsable without an account. Consumer authentication exists only to make personal state portable across devices.

## Identity split

- Payload `users` = CMS/admin identity.
- Payload `members` = consumer identity.
- `admin.user` remains `users`.
- Members cannot enter the Payload Admin Panel.
- Both collections live in the same Payload-managed Postgres database (Supabase Postgres in deployed environments).

Payload supports multiple authentication collections specifically for this admins/customers split.

## Consumer features unlocked by sign-in

- saved places
- saved walks (next collection)
- accessibility/preferences
- offline collections (future)
- continue an active walk across devices (future)

No public exploration route may require a member session.

## Session transport

Web uses Payload's HTTP-only auth cookie and `credentials: include`.
Mobile/spatial clients should use the same `members` auth operations but store returned JWTs in an approved secure native store when that client implementation lands; do not put tokens in Zustand persistence, AsyncStorage, query strings, or logs.

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
