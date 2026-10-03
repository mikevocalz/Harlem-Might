# Events aggregation: Phase 0 recon

Checked 2026-10-03 against branch `main` at `1dc7c5b` plus the uncommitted
`packages/payload/src/payload-types.ts` change (not mine; left untouched).
Every finding cites a path. Anything I couldn't verify from the repo is
listed as an open question, not guessed.

## 1. Workspace map

- pnpm 12.8.1 (`package.json` `packageManager`), Turbo, `nodeLinker: hoisted` (`pnpm-workspace.yaml:10`). Node pinned to 24 (`.nvmrc` = `24.15.0`, `.npmrc` `engine-strict=true`).
- Apps:
  - `apps/web`: Next.js `16.3.8` (catalog, `pnpm-workspace.yaml:133`), React `19.3.0`. Public product site, and it also hosts the Payload admin and API under `app/(payload)`. Ownership is recorded in `docs/MOTION_SPATIAL_HERO.md` ("App boundary").
  - `apps/web-vite`: TanStack Start + TanStack Router on Vite `^8.3.1` (`apps/web-vite/package.json`). Internal curator/catalogue workspace; admin routes in `apps/web-vite/src/routes/admin/` (`index.tsx`, `businesses.tsx`).
  - `apps/mobile`: Expo SDK 58. `apps/storybook`.
- Packages:
  - `@acme/app`: shared features.
  - `@acme/ui`: components, including `@acme/ui/mights`, the public-site design system.
  - `@acme/theme`: tokens.
  - `@acme/payload`: the Payload config and collections.
  - `@acme/spatial`, `@acme/assets`.
  - `@acme/config`: eslint, prettier and tsconfig presets only. It has no env module.

## 2. Database conventions (no Supabase)

- **There is no Supabase in this repo.** There's no `supabase/` directory or `config.toml`, no migrations folder, no `@supabase/*` dependency in any `package.json`, and no Supabase env var anywhere.
- Persistence is **Payload `4.0.0-canary.33`** (`pnpm-workspace.yaml:164`) with `@payloadcms/db-postgres` (`packages/payload/src/payload.config.ts:1,31-40`):
  - schema `payload`
  - connection string from `DATABASE_URL`
  - `push: process.env.PAYLOAD_PUSH === 'true'`, meaning schema push mode
  - no committed Payload migrations
- `DATABASE_URL` in the root `.env` points at `localhost` (host only inspected; no credentials read). A local Postgres is accepting connections on `localhost:5432`, but it needs a password. So **whether PostGIS, `pg_trgm`, `unaccent` or `pg_cron` are available or enabled is unverified.**
- Collections: `users` (admin auth), `members` (public auth), `media`, `pages`, `places`, `saved-places` (`packages/payload/src/collections/`). `places` has a `point` location, `lifecycle`, `primaryCategory`, `primaryArea` and an address group (`Places.ts:13-62`).
- There's no RLS anywhere. Authorization is Payload collection `access` functions (e.g. `SavedPlaces.ts:27-45`).

## 3. Auth-to-data bridge (no Better Auth)

- **Better Auth is not in the repo**: no dependency, no config, no `BETTER_AUTH_*` variables.
- Auth is **Payload's built-in auth** on two collections:
  - `users` (`Users.ts:5`, `auth: true`) is the Payload admin (`payload.config.ts:21`).
  - `members` (`Members.ts:14-16`) is the public account, with a 30-day token. Access is scoped to the member's own row (`Members.ts:24-31`).
- `web-vite` talks to Payload's REST API over `fetch` with a member session (`apps/web-vite/src/lib/member-session.ts:44`; base URL `VITE_PAYLOAD_API_BASE`, `apps/web-vite/src/lib/payload.ts:16`). CORS/CSRF allow-list is `NEXT_PUBLIC_SITE_URL` + `WEB_VITE_URL` (`payload.config.ts:15-17`).
- The admin page itself states that editing stays in Payload "until the curator write API and role checks land" (`apps/web-vite/src/routes/admin/index.tsx`).

## 4. Environment handling

- `.env.example` exists at the root, in `apps/web` and in `apps/mobile`. Public prefixes:
  - `NEXT_PUBLIC_`: web
  - `VITE_`: web-vite
  - `EXPO_PUBLIC_`: mobile
- **No env validation module exists.** Code reads `process.env.X` directly (e.g. `payload.config.ts:15-16,33,38,43`, `packages/ui/mights/MightsMapImage.tsx`).
- Every env var name referenced in code: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `WEB_VITE_URL`, `VITE_PAYLOAD_API_BASE`, `PAYLOAD_SECRET`, `PAYLOAD_PUSH`, `DATABASE_URL`, `NODE_ENV`, plus the spatial/mobile ones (`EXPO_PUBLIC_*`, `NEXT_PUBLIC_LIGHTCYCLE_*`, `NEXT_PUBLIC_MCP_GNM_GLB_URL`, `PICO_APP_ID`, `META_QUEST_APP_ID`).
- No `vercel.json`. The hosting target for `apps/web` isn't recorded in the repo.

## 5. Data layer

- `@tanstack/react-query` provider: `packages/app/providers/query-provider.tsx` (`createQueryClient`). It's mounted only in `apps/mobile/app/_layout.tsx`; `apps/web` doesn't mount it.
- `apps/web` public pages are server components reading static catalogue data from `packages/app/features/explore/explore.store.ts` (`HARLEM_PLACE_PREVIEWS`, `placesNear`). Explore URL state lives in `apps/web/components/explore/ExploreWorkspace.tsx`.
- `web-vite` reads Payload REST through `src/lib/payload.ts`.
- Zustand `5.0.15`. The saved-places pattern is the Payload `saved-places` collection: `member` + `place` relationships, with `member` forced from the session in `beforeChange` (`SavedPlaces.ts:46-53`).

## 6. Map infrastructure

- `mapbox-gl` `3.32.0` in `apps/web` (catalog). The token is `NEXT_PUBLIC_MAPBOX_TOKEN` (root `.env.example`; used in `apps/web/components/explore/ExploreMap.tsx` and `packages/ui/mights/MightsMapImage.tsx`).
- Style `mapbox://styles/mapbox/dark-v11`, gold diamond DOM markers, and Static Images for cards.
- No clustering yet, and no viewport query: 6 static points.
- `web-vite` has no map token.

## 7. Design system and motion

- Public site:
  - `@acme/ui/mights` (`packages/ui/mights/`): route map `routes.ts`, `MightsButton`, `MightsNotchCard`, `MightsPage`, `MightsBand`, `MightsPlaceBento`, `MightsProse`, `MightsFigure`, `MightsBreadcrumb`, `MightsMapImage`, navbar, dock and footer.
  - Tokens in `packages/theme/tokens.ts`: gold `#F8C626` on warm black.
  - Mona Sans + Newsreader (`apps/web/app/fonts.ts`).
  - Kinetrell owns Lenis/GSAP (`apps/web/components/site/SiteMotionShell.tsx`).
- Reduced motion comes from `useBrowserReducedMotion` (`kinetrell/web/react`) plus CSS media queries in `apps/web/app/globals.css`.
- The empty state is `MightsBand` with honest copy; there's no shared skeleton component on the public site.
- `web-vite` uses the older `@acme/ui` components (`Card`, `Heading`) with `rounded-xl`, `hover:-translate-y-0.5` (`admin/index.tsx`). It hasn't been moved onto the Mights system.

## 8. Jobs and scheduling

- No scheduler of any kind: no `vercel.json` crons, no `pg_cron`, no Edge Functions, no Trigger.dev or Inngest, and no Payload jobs config in `payload.config.ts`.
- Payload 4 ships a jobs queue (`payload.jobs`). Whether this canary's API is stable enough to rely on is unverified; it's an option for the ADR.

## 9. Observability

- No Sentry, no logger library, no mail provider (no Resend or SMTP variables) anywhere in `apps/*` or `packages/*`.

## 10. Testing and CI

- Tests use Node's built-in runner, `node --test` (`packages/app`, `packages/spatial`, `apps/mobile` `test` scripts). There's no Vitest, no Testing Library and no Playwright dependency.
- CI is `.github/workflows/ci.yml`:
  - `pnpm install --frozen-lockfile`
  - spatial verifiers
  - `pnpm --filter @acme/spatial test`
  - `pnpm turbo build typecheck lint`
- Per-app `typecheck` is `tsc --noEmit`; `lint` is `eslint`.

## 11. Existing event or calendar code

- There's no event model, table or collection.
- `packages/app/features/schedule/` is an instructor-booking demo, unrelated to this work.
- Routing: `/today` (empty state, `apps/web/app/(site)/today/page.tsx`) is the primary nav item "Today" (`packages/ui/mights/routes.ts`). `next.config.ts` **permanently redirects `/events` → `/today`**, and the route map has `event: (slug) => /events/${slug}`. This comes from the site map Mike locked in the v3 visual prompt.

## Stop-and-ask list

These conflicts have to be settled before Phase 1. Each has a recommendation.

1. **No Supabase.** The prompt assumes Supabase Postgres, migrations, RLS, publishable/secret keys and Supabase Storage. The repo has Payload on a local Postgres.
   - **Recommendation:** provision a Supabase project and point Payload's `DATABASE_URL` at it. This matches the handoff's target stack (Payload 4 + Supabase Postgres/PostGIS). Payload keeps schema `payload`; events tables live in `public` via `supabase/migrations/`.
   - **I need:** which Supabase project to use or create, and on which org/plan. Creating one has cost implications, so I won't do it unasked.
2. **No Better Auth.** Auth is Payload (`users` = staff, `members` = public).
   - **Recommendation:** don't add Better Auth. Drop the JWT-to-RLS bridge in §11.4 and take the prompt's own fallback: all admin and saved-event writes go through `apps/web` route handlers that verify the Payload session server-side and use the Supabase secret key. RLS still guards the public read model for the publishable key.
   - "Admin" = a Payload `users` session; saved events follow the `saved-places` member pattern.
   - The §5 `BETTER_AUTH_*` variables are dropped.
3. **Places vs venues.** The handoff makes one canonical Place ID across every experience (§1.2), and `places` already exists in Payload. The prompt adds a separate `venues` table.
   - **Recommendation:** `venues` in Supabase carries a nullable `place_id`, linking it to the Payload place when one exists. Venue pages for linked venues render the place record, so there's never a second "Apollo".
   - Alternative: make Payload `places` the venue table outright. That's heavier, and Payload's `point` field is not `geography`.
4. **Route map conflict.** Your locked v3 site map uses nav "Today" → `/today`, `/today/[date]`, `/events/[slug]`, and `/events` → `/today` (308). The events prompt wants `/events` as the feed, plus `/events/today`, `/events/this-weekend`, `/events/free`, `/events/map`, `/venues/[slug]`, `/neighborhoods/[slug]` and `/saved`.
   - **Recommendation:** keep the nav label "Today" pointing at `/today` (the today preset). Make `/events` the full feed and remove the `/events` → `/today` redirect. `/events/this-weekend`, `/events/free` and `/events/map` stay as specced; `/events/today` permanently redirects to `/today`.
   - Add `venues`, `neighborhoods` and `saved` to `routes.ts`.
5. **Scheduler and host.** There's no `vercel.json`, and the host for `apps/web` isn't recorded.
   - **Recommendation:** if `apps/web` deploys on Vercel, use Vercel Cron with `CRON_SECRET`; otherwise use `pg_cron` + `pg_net` in Supabase.
   - **I need:** where `apps/web` is deployed.
6. **Observability and alerts.** There's no Sentry, logger or mail provider, and the prompt says reuse, don't add.
   - **Recommendation:** structured JSON logs to stdout, plus `provider_runs` as the system of record and the admin dashboard banner. Sentry and email alerts are added only if you want them; that's one new dependency each. Otherwise `SENTRY_*`, `ALERT_EMAIL_TO` and `EMAIL_FROM` are dropped from §5.
7. **Test stack.** The repo convention is `node --test`; the prompt mandates Vitest and Playwright.
   - **Recommendation:** use `node --test` for `packages/events` unit and fixture suites, to match the existing packages. Add Playwright only for the admin and public acceptance suites in §13.8 and §14, since nothing in the repo covers browser E2E today.
8. **Env module.** None exists.
   - **Recommendation:** create `packages/config/src/env.server.ts` and `env.public.ts` with Zod 4 (`zod 4.6.5`, already in the catalog), and migrate the existing direct `process.env` reads in `payload.config.ts` and `MightsMapImage.tsx` onto it in the same PR.
9. **Provider credentials.** None exist yet. To verify and record first fixtures I need a `TICKETMASTER_API_KEY` and `SEATGEEK_CLIENT_ID`. An `NYC_OPEN_DATA_APP_TOKEN` is optional.
   - NYC Parks, NYC Permitted Events (unauthenticated), GeoSearch and NYPL need nothing, so their research and fixtures can start without any keys.
10. **web-vite design debt.** The admin app uses the old rounded-card, hover-lift components.
    - **Recommendation:** build the new admin screens on `@acme/ui/mights`, so admin and public share one system, and leave the existing two admin pages alone.
11. **Local database access.** I can't confirm PostGIS, `pg_trgm` or `unaccent` locally without credentials. If Supabase (item 1) is chosen, this stops mattering: Supabase ships all three.

## Phase 1 can start without answers on

These need no decisions and no keys:

- `provider-research` for NYC Parks, NYC Permitted Events, GeoSearch and NYPL, including live smoke requests and first fixtures
- the Harlem NTA boundary snapshot
- the category taxonomy tables for keyless providers
