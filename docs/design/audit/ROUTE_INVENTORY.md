# Route inventory — `apps/web` (Phase 0, before)

Branch `design/web-rebuild-phase0`, Next.js 16.3.8 (`node_modules/next/package.json:3`). Audited 2026-10-03 against the locked target site map. Rendered checks were run with `curl -m 120` against the dev server at `http://localhost:3000`.

Severity: 🔴 blocks the target IA or fails a WCAG criterion in scope · 🟡 should fix during the rebuild · 🟢 fine as is.

## 1. Route groups and layouts

| Group | Layout file | Notes |
|---|---|---|
| `(site)` | `apps/web/app/(site)/layout.tsx` | Root layout #1. Renders `<Document>` (`apps/web/app/Document.tsx:12-25`, `<html lang="en">`) and wraps every page in `SiteMotionShell` → `SiteHeader` + page + `SiteFooter` (`apps/web/components/site/SiteMotionShell.tsx:66-78`). Exports the only site metadata (lines 7-14). |
| `(payload)` | `apps/web/app/(payload)/layout.tsx` | Root layout #2 (Payload `RootLayout`). Out of scope; listed only. |

There is no top-level `app/layout.tsx`. That makes this a multiple-root-layout app. Per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md:30`, moving between `(site)` and `(payload)` is a full page load (fine). Per `not-found.md:55-57`, an app with multiple root layouts needs `app/global-not-found.tsx` to serve a branded 404 for unmatched URLs (see §4).

## 2. Route files

| URL | File | Type | Rendered `<title>` | Rendered `<h1>` | Target decision |
|---|---|---|---|---|---|
| `/` | `app/(site)/page.tsx` → `components/site/ProductHome.tsx` | client page | `Harlem Might — see the block, know the story` (layout default) | "See the block. Know the story." (`ProductHome.tsx:139-145`) | **Keep.** Rewrite content and swap the `/spatial` hero CTA (`ProductHome.tsx:159-164`) for `Preview AR` → `/ar`. |
| `/explore` | `app/(site)/explore/page.tsx` | client page | same default title | "Pick a place on the map." — only inside a `hidden … xl:flex` column (`explore/page.tsx:34`, `ExploreEmptyDetail.tsx:9`), so below 1280px there is no exposed h1 | **Keep.** Move query, category, selection and view into the URL (`?q=&category=&place=&view=`); split place detail out to `/places/[slug]`. |
| `/schedule` | `app/(site)/schedule/page.tsx` → `packages/app/features/schedule/screen.tsx` | client page | same default title | none (heading is a styled `<Text>`, `Schedule.tsx:58`) | **Redirect → `/today` (308)**, then delete. Content is a starter-template instructor booking demo (`fixtures.ts:49-79`), not Harlem events. |
| `/spatial` | `app/(site)/spatial/page.tsx` → `packages/spatial/SpatialScreen.tsx` | page (server file, client screen) | same default title | "Build once for screen, spatial windows, WebXR, Quest and Pico." (`SpatialScreen.tsx:68-70`) | **Redirect → `/ar` (308)**, then delete. Developer/XR demo (light-cycle race), not an AR explainer. Keep the screen for internal or Storybook use if wanted. |
| `/notifications` | `app/(site)/notifications/page.tsx` | client page | same default title | "Notifications" | **Redirect → `/` (308)** under the "nearest parent" rule, then delete. App-only concept. Alternative for Mike: send to `/download`. |
| `/profile` | `app/(site)/profile/page.tsx` | client page | same default title | "Nina Alvarez" (hardcoded demo user, `profile.store.ts:27`) | **Redirect → `/` (308)**, then delete. App-only; `docs/AUTH_PROFILE.md:3` says the product is fully browsable without an account. |
| `/settings` | `app/(site)/settings/page.tsx` | client page | same default title | "Settings" | **Redirect → `/` (308)**, then delete. App-only; "Sign out" and "Delete account" are no-op buttons (`settings-content.tsx:83-84`). |
| `(site)` error boundary | `app/(site)/error.tsx` | `ErrorScreen kind="error"` | n/a | "Something went wrong" (`screen.shared.tsx:23-25`) | **Keep.** Restyle only. Note: it prints raw `error.message` to visitors (`error.tsx:6`). 🟡 |
| `(site)` not-found | `app/(site)/not-found.tsx` | `ErrorScreen kind="not-found"` | n/a | never rendered for unmatched URLs (see §4) | **Replace** with `app/global-not-found.tsx` carrying the site shell, search and the four destinations. |
| `/admin/[[...segments]]` | `app/(payload)/admin/[[...segments]]/page.tsx` (+ `not-found.tsx`) | Payload admin, `generateMetadata` | — | — | Out of scope. Must be `Disallow`ed in the future `robots.ts`. |
| `/payload-api/[...slug]`, `/payload-api/graphql` | `app/(payload)/payload-api/*/route.ts` | route handlers | — | — | Out of scope. Disallow in `robots.ts`. |

Dynamic segments today: only the Payload catch-alls. **No public dynamic route exists**, so none of `/places/[slug]`, `/walks/[slug]`, `/walks/[slug]/stops/[n]`, `/stories/[slug]`, `/today/[yyyy-mm-dd]`, `/events/[slug]` can be deep-linked yet.

## 3. Metadata exports

| File | Export | Content |
|---|---|---|
| `app/(site)/layout.tsx:7-14` | `metadata` | `title.default` "Harlem Might — see the block, know the story"; `title.template` "%s — Harlem Might"; one site-wide description. |
| Any `(site)` page | — | **No page exports `metadata` or `generateMetadata`.** Every client page is a `'use client'` file, which cannot export metadata, so the template is never used. 🔴 |
| `app/(payload)/admin/[[...segments]]/page.tsx:16`, `not-found.tsx:16` | `generateMetadata` | Payload-managed; out of scope. |

Rendered result: all seven site routes return the identical `<title>` and identical `<meta name="description">`. None renders `og:*`, `rel="canonical"`, or `application/ld+json` (counted in the saved HTML). That fails WCAG 2.4.2 Page Titled on six of seven routes and gives zero breadcrumb JSON-LD. 🔴

## 4. Metadata files and 404

| File | Present | Rendered check |
|---|---|---|
| `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png` | yes | linked from `<head>` 🟢 |
| `app/sitemap.ts` | **no** | `/sitemap.xml` → 404 🔴 |
| `app/robots.ts` | **no** | `/robots.txt` → 404 🔴 |
| `app/manifest.ts` | **no** | `/manifest.webmanifest` → 404 🟡 |
| `opengraph-image.*` / `twitter-image.*` | **no** | no social previews 🟡 |
| `app/global-not-found.tsx` | **no** | `/does-not-exist`, `/walks`, `/places` all render Next's built-in page: title `404: This page could not be found.`, no header, no footer, no way back. The custom `app/(site)/not-found.tsx` only fires on a `notFound()` call inside `(site)`, and nothing calls `notFound()` (grep: zero hits). 🔴 |

## 5. Redirects, rewrites, middleware/proxy

| Source | Finding |
|---|---|
| `apps/web/next.config.ts` | No `redirects()`, no `rewrites()`, no `headers()` (whole file, lines 1-102). |
| `apps/web/middleware.ts` / `apps/web/proxy.ts` | Neither exists. |
| `vercel.json` | None in repo (searched to depth 3). |

Every redirect in the target spec is missing. Required set (all `permanent: true`, which Next emits as 308):

| From | To | Reason |
|---|---|---|
| `/places` | `/explore` | Spec |
| `/tours`, `/tours/:slug` | `/walks`, `/walks/:slug` | Spec; handoff §2A.8 still says "tours" |
| `/events` | `/today` | Spec (`/events/:slug` stays as an entity route) |
| `/map`, `/explore/map` | `/explore?view=map` | Spec |
| `/app` | `/download` | Spec |
| `/schedule` | `/today` | v1 route, nearest destination by meaning |
| `/spatial` | `/ar` | v1 route, nearest destination by meaning |
| `/notifications`, `/profile`, `/settings` | `/` | v1 app-only routes, nearest parent |

## 6. Target site map coverage

| Target route | Exists | Gap |
|---|---|---|
| `/` | yes | content + CTA changes |
| `/explore` (+ `?view`, `?q`, `?category`, `?place`) | yes, no URL state | 🔴 state lives in zustand (`explore.store.ts:151-165`) |
| `/places/[slug]` | no | 🔴 detail only exists as an in-page pane |
| `/walks`, `/walks/[slug]`, `/walks/[slug]/stops/[n]` | no | 🔴 |
| `/stories`, `/stories/[slug]` | no | 🔴 |
| `/today`, `/today/[yyyy-mm-dd]` | no | 🔴 |
| `/events/[slug]` | no | 🔴 |
| `/ar` | no | 🔴 (`/spatial` is not a substitute) |
| `/download` | no | 🔴 (header primary CTA target) |
| `/about`, `/press` | no | 🔴 |
| `/legal/privacy`, `/legal/terms`, `/legal/accessibility` | no | 🔴 |
| custom 404 | no (see §4) | 🔴 |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` | no | 🔴 / 🔴 / 🟡 |

Count: 2 of 24 target routes exist (`/`, `/explore`); 5 existing routes are off-map.

## 7. Related surfaces outside `apps/web`

- `apps/web-vite/src/routes/` already has `about.tsx`, `ar.tsx`, `explore.tsx`, `stories.tsx`, `today.tsx`, `walks.tsx`, `pages/$slug.tsx`. Not audited here; worth checking before rebuilding those pages from zero in `apps/web`.
- The spec says the web labels match "the app tabs". At this audit (2026-10-03) the mobile tabs were `Grid`, `Explore`, `Alerts`, `Profile` under a drawer, and only `Explore` matched. 🟡
- Update 2026-10-08 (branch `feat/mobile-site-parity`): the drawer and the demo tabs are gone (DECISIONS S13). The tabs are `Explore`, `Walks`, `Stories`, `Today`, `More`, built from `primaryNav` plus More in `apps/mobile/src/site/app-tabs.ts` and rendered by `apps/mobile/app/(tabs)/_layout.tsx`. Explore lives at `app/(tabs)/explore/` (`index`, `[placeId]` deep link), More at `app/(tabs)/(more)/` (`/more`, `/ar`), and `app/index.tsx` redirects to `/explore`. Labels now match the site. 🟢
