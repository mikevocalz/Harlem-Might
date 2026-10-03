# IA audit — `apps/web` public site (Phase 0, before)

Branch `design/web-rebuild-phase0`. Audited 2026-10-03. Companion to `ROUTE_INVENTORY.md`. Method: code read of the site shell and every `(site)` route, plus rendered HTML from the dev server (`curl -m 120`). Lenses: Nielsen Norman Group's 10 usability heuristics (cited as H1–H10), NN/g guidance on menus, you-are-here cues, sticky headers, footers, breadcrumbs and 404 pages, and WCAG 2.2 criteria 2.4.1, 2.4.2, 2.4.5, 2.4.7, 3.2.3, 3.2.4.

Severity: 🔴 blocks the target IA or fails an in-scope WCAG criterion · 🟡 fix during the rebuild · 🟢 fine.

Verdict: 🚨 Significant UX problems. The public site is the Solito starter shell with Harlem copy on two screens. Four of five nav items lead to template demos or signed-in app screens, every route shares one `<title>`, and on a phone the Explore screen cannot search, list or open a place.

## 0. Product name

The spec, handoff title and `docs/AUTH_PROFILE.md:3` say **Harlem Mights**. The shipped UI says **Harlem Might**: `app/(site)/layout.tsx:9-11`, `SiteHeader.tsx:87,102`, `SiteFooter.tsx:58,101`, `ProductHome.tsx:148,276`, `SpatialScreen.tsx:66`. Body copy in the seed data says "Harlem Mights" (`explore.store.ts:47,73`, `SightlineHeroCanvas.web.tsx:97`). The repo folder and the logo files in Downloads use "Harlem-Might". One page can show both spellings (Explore header vs place blurb). 🔴 Needs a decision from Mike before any title template is written.

## 1. Header, item by item

Source: `apps/web/components/site/nav.ts:5-14`, rendered by `SiteHeader.tsx:111-151`.

Active-state logic, `SiteHeader.tsx:15-16`:

```ts
const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);
```

Bare `startsWith` has no segment boundary, so `/explore` would also light up on `/explorer`. It also cannot express the target's cross-tree rules (Explore active on `/places/*`, Today active on `/events/*`). 🟡 Active links do set `aria-current="page"` (`SiteHeader.tsx:118`; confirmed in rendered `/explore`). 🟢

| # | Label | Destination | Rendered h1 | `<title>` | Label = h1? | Label = title? | Active on children? | Severity |
|---|---|---|---|---|---|---|---|---|
| 1 | Home | `/` | "See the block. Know the story." | site default | n/a for home | no | exact match only, correct | 🟡 Target drops Home as a nav item; logo already links home (`SiteHeader.tsx:84-108`) |
| 2 | Explore | `/explore` | "Pick a place on the map." (≥1280px only) | site default | no. The visible pane title "Explore Harlem" is a `<Text>`, not a heading (`ExploreMasterPane.tsx:33-35`) | no | yes on `/explore*`; no child routes exist | 🔴 |
| 3 | Schedule | `/schedule` | none | site default | no h1 at all ("Today's Schedule" is `<Text>`, `Schedule.tsx:58`) | no | no child routes | 🔴 |
| 4 | Spatial | `/spatial` | "Build once for screen, spatial windows, WebXR, Quest and Pico." | site default | no | no | no child routes | 🔴 |
| 5 | Notifications | `/notifications` | "Notifications" | site default | yes | no | no child routes | 🔴 app-only screen |
| 6 | Avatar (icon, no visible text) | `/profile` | "Nina Alvarez" | site default | no | no | ring on `/profile` (`SiteHeader.tsx:135-137`); **none on `/settings`**, which it claims to cover in `aria-label="Your profile and settings"` (line 133) | 🔴 signed-in demo identity on a public site |
| 7 | ☰ / ✕ glyph | toggles `#mobile-menu` | — | — | — | — | — | 🟡 has `aria-label` and `aria-expanded` (`SiteHeader.tsx:143-146`, rendered as a real `<button>`), but no visible "Menu" text, and `aria-controls` points at an element that is not in the DOM while closed |

Missing against the target: `Walks`, `Stories`, `Today`, `Preview AR` (secondary), `Get the app` (primary). 🔴

Sticky header: yes, `sticky top-0 z-50` (`SiteHeader.tsx:74`). 🟢 Skip link: none. The first focusable element is the logo link; rendered HTML contains no "Skip to" text on any route. Fails WCAG 2.4.1. 🔴 Landmarks: `<header>` and `<footer>` on every route; `<main>` is **missing** on `/explore`, `/schedule`, `/spatial` (rendered HTML count 0). 🟡

## 2. Mobile navigation at 390px

What exists: header row of logo (44px) + wordmark + avatar (`h-11 w-11` = 44px, `Avatar.tsx:16`) + menu button (`h-10 w-10` = 40px, `SiteHeader.tsx:148`). The desktop `<Nav>` is `hidden md:flex` (line 111). Tapping ☰ opens an absolutely positioned panel under the header (`SiteHeader.tsx:155-180`) with the same five items.

There is no bottom dock and no `MightsDock` component. 🔴 (target requires one below 768px)

| Check | Finding | Severity |
|---|---|---|
| Covers content / map controls? | The open panel overlays the top of the page (`absolute inset-x-0 top-full`, line 159). On `/explore` it covers the "Harlem spatial workspace" label card (`ExploreMapPane.tsx:38-44`), not the pins. The panel does not close on browser Back or route changes it didn't start (state is a global zustand store, `nav.ts:17-23`; only link `onClick={close}` closes it), and has no Escape handler or focus management. | 🟡 |
| Menu button target | 40×40px. Passes WCAG 2.5.8 (24px) but under the 44pt Apple HIG minimum. | 🟡 |
| Mobile menu links | `px-4 py-3.5 text-base` (line 170) → about 52px tall. | 🟢 |
| Desktop nav links | `px-3.5 py-2 text-sm` (line 119) → about 36px tall. | 🟢 for pointer |
| Explore category chips | `px-3 py-2 text-xs` (`ExploreMasterPane.tsx:74`) → about 32px. Marked `role="tab"` with no `tablist` and no `aria-selected` (rendered). | 🟡 |
| Explore map pins | `h-9 w-9` = 36px (`ExploreMapPane.tsx:72`), numbers only, no visible name. | 🟡 |
| Footer links | text-sm with no padding, ~20px tall, 10px gaps (`SiteFooter.tsx:11-13,70`). Passes 2.5.8 through the spacing exception only. | 🟡 |

**Explore at 390px is a dead end.** 🔴 The list/search pane is `hidden … lg:flex` (`explore/page.tsx:26`), the detail pane is `hidden … xl:flex` (line 34), the Mights Panel is `2xl:flex` (line 43). The map pane accepts `onShowPlaces` to reveal a "Places" button (`ExploreMapPane.tsx:46-54`), but the web page never passes it (`explore/page.tsx:31`). Result below 1024px: no search, no list, no filters; tapping a pin only recolours it, because the detail that would show the selection is hidden below 1280px.

## 3. Footer

Source: `SiteFooter.tsx:47-106`.

Links to: `Product` column = the same five `NAV_ITEMS` (Home, Explore, Schedule, Spatial, Notifications); `Account` column = Profile, Settings. Third column "Built for place" is prose with no links. Legal line: "© Harlem Might" and "Built for Harlem first." (lines 101-102).

Omits, against the target:
- About, Press, Accessibility, Privacy, Terms 🔴 (no legal pages exist at all)
- Walks, Stories, Today, Preview AR 🔴
- Get the app: store badges, QR of the current page's universal link 🔴
- Photo credits on the legal line 🔴 (the target requires them; there are no photos yet, but the slot is missing)
- Year in the copyright 🟢 minor
- A corrections / contact route. Not in the target footer either; see tree test task 5. 🔴

## 4. Per-screen check

Four questions per screen: what is it for / what you see first / single primary action / where next. 🔴 marks a screen where any answer is unclear.

| Screen | For | Seen first | Primary action | Where next | Flag |
|---|---|---|---|---|---|
| `/` | Product pitch | 138vh hero (`ProductHome.tsx:116`), h1 "See the block. Know the story.", animated "Mights Sightline" glasses render | Two equal-weight buttons: "Explore Harlem" → `/explore` and "Enter the spatial experience" → `/spatial` (lines 153-164) | Explore, or a VR race demo. Chapter cards "Discover / Walk / Look up" (lines 12-31) have no links, so "Walk" leads nowhere. No app download path. | 🔴 |
| `/explore` ≥1280px | Find a place | List + map + "Pick a place on the map." empty state | Pick a place | Detail pane, but no route; selection lost on reload/share (§5) | 🟡 |
| `/explore` <1024px | Find a place | Map with numbered pins and two developer notes: "Preview geometry only · canonical coordinates come from Payload/PostGIS" and "Nitro Mapbox AR handoff … deliberately does not fake live Mapbox" (`ExploreMapPane.tsx:40-43,89-94`) | None that works (see §2) | Nowhere | 🔴 |
| Place detail pane | Learn about a place | Name h1, then "Place media carousel" placeholder, "Operational data", "Source-aware actions" placeholder cards (`ExplorePlaceDetail.tsx:45-103`) | None; every card describes a future feature | Nowhere; no walk, story or event links | 🔴 |
| `/schedule` | Unclear. Instructor booking demo: staff "Maya Rodriguez", "Daniel Okafor"; lessons "Theory I", "Orbital mechanics" (`fixtures.ts:49-79`) | "Today's Schedule" + Day/Week switch + "New booking" | "New booking" (which just clears selection, `screen.tsx:34`) | Nowhere | 🔴 |
| `/spatial` | Unclear to a visitor. XR engineering demo | Black Tron grid, h1 about WebXR/Quest/Pico, copy naming "Tailwind 4 + Uniwind", "Skia", "Viro/OpenXR" (`SpatialScreen.tsx:65-74`) | Two competing CTAs: "Enter VR Grid" and "Start 37-Cycle Race" (lines 76-95) | Nowhere | 🔴 |
| `/notifications` | Signed-in alerts | List of demo notifications, "Mark all read" | Mark all read | Nowhere | 🔴 |
| `/profile` | Signed-in profile of "Nina Alvarez @nina" | Demo avatar and stats | "Edit profile" no-op (`profile-content.tsx:46`) | `/settings` | 🔴 |
| `/settings` | Account settings | Toggles | "Sign out" / "Delete account", both no-ops (`settings-content.tsx:83-84`) | Nowhere | 🔴 |
| 404 (unmatched URL) | Recover | Next default "404 This page could not be found." with no shell | None | Nowhere; no header, footer, search or links | 🔴 |
| Error boundary | Recover | "Something went wrong" + raw `error.message` (`error.tsx:6`) | "Back to Home" | Home only | 🟡 |

## 5. Structural problems

### Dead ends 🔴
- Explore below 1024px (§2).
- Place detail: no outbound links of any kind.
- 404 for every target URL that does not exist yet (`/walks`, `/places`, … all verified 404 with the default page).
- Home chapter cards and the "Route in context" card are unlinked.

### Competing CTAs in one viewport
- Home hero: two primary-sized buttons side by side, the second leading off-product (`ProductHome.tsx:153-164`). 🔴
- `/spatial`: "Enter VR Grid" vs "Start 37-Cycle Race" (`SpatialScreen.tsx:76-95`). 🔴 (route goes away)
- `/schedule`: Day/Week control and "New booking" share the title row; mild. 🟡

### Unlabeled icons
- ☰/✕: AT-labelled, visually unlabeled. 🟡
- Avatar: AT-labelled ("Your profile and settings"), visually unlabeled, and implies the visitor is signed in as someone else. 🔴
- Map pins: numbers 1–8 with no legend; AT label "Select {name} on map" is fine. 🟡

### Filters and selection not in the URL 🔴
- `/explore`: `query`, `category`, `selectedPlaceId`, `savedPreviewIds` are a zustand store (`explore.store.ts:140-165`), read at `explore/page.tsx:20-21` and `ExploreMasterPane.tsx:21-25`. No `useSearchParams` / router writes anywhere in the feature. A search or a selected place cannot be shared, bookmarked, or restored on reload. Fails the spec's "URL state for filters/view/selection" rule and WCAG 2.4.5's spirit of multiple ways to reach a place (there is exactly one way, and it is not addressable).
- `/schedule`: `view`, `selectedDate`, `selectedEventId`, `resourceFilter`, `bookingOpen` are a zustand store (`schedule/store.ts:38-59`; `Schedule.tsx:38-39`). Route is being removed; the same rule applies to `/today/[yyyy-mm-dd]`.
- Mobile menu `open` is also global zustand (`nav.ts:17-23`); fine to keep out of the URL, but it must close on navigation. 🟡

### Back-button breakage 🔴
- On `/explore`, choosing a place or filter pushes no history entry. Back leaves Explore entirely instead of undoing the selection (H3 user control).
- Because store state is module-global, returning to `/explore` in the same session restores the last selection while the URL says nothing about it. Two visitors to the same URL see different screens.
- The mobile menu survives a Back navigation (see §2).

### App-only concepts on a public marketing site 🔴
`/notifications`, `/profile`, `/settings` and the header avatar ship a fake signed-in user (`profile.store.ts:27`) to anonymous visitors. `docs/AUTH_PROFILE.md:3` says the product is browsable without an account. These belong in the app; the web should hand off via `Get the app`.

### Internal jargon in visitor copy (H2) 🔴
"canonical Place record", "Master and Map stay mounted" (`ExploreEmptyDetail.tsx:12-14`), "Payload/PostGIS", "Nitro Mapbox AR handoff" (`ExploreMapPane.tsx:42,89`), "Master catalogue preview" (`ExploreMasterPane.tsx:103`), "Tailwind 4 + Uniwind", "Viro/OpenXR" (`SpatialScreen.tsx:72-73`), "The product site, map workspace and spatial view now share the same visual and motion language" (`ProductHome.tsx:233-236`). These are build notes rendered as product copy.

### WCAG summary
| Criterion | Status | Evidence |
|---|---|---|
| 2.4.1 Bypass Blocks | 🔴 fail | no skip link on any route |
| 2.4.2 Page Titled | 🔴 fail | 7 routes, 1 title |
| 2.4.5 Multiple Ways | 🔴 fail | no search outside Explore desktop, no sitemap, no breadcrumbs |
| 2.4.7 Focus Visible | 🟢 likely pass | `focus-visible:ring-2` on header, footer and CTA links; not verified in a browser |
| 3.2.3 Consistent Navigation | 🟢 pass | same header/footer order on every route; but the 404 drops the shell entirely 🔴 |
| 3.2.4 Consistent Identification | 🟡 | "Harlem Might" vs "Harlem Mights"; Explore called "Explore", "Explore Harlem", "Open Explore", "Harlem spatial workspace" |

Breadcrumbs: none, and no BreadcrumbList JSON-LD (0 `ld+json` blocks rendered). No route is deeper than depth 1 yet. 🔴 for the target.

## 6. Tree test

### Persona source
The brief asks for "the five personas in §2B.1" of the v2 handoff. Checked:
- `/Users/mikevocalz/Downloads/HARLEM_MIGHTS_FUTURE_REPO_HANDOFF (1).md` (95 KB): sections run §0–§2.6, then §2A.1–§2A.10, then §3 onward. No §2B heading, no "persona" string.
- `/Users/mikevocalz/Downloads/HARLEM_MIGHTS_FUTURE_REPO_HANDOFF.md` (51 KB): no §2A or §2B; no "persona" string.
- Repo `docs/` and `prompts/`: the only "persona" hit is `prompts/ROSTER.md:53`, which is about consulting specialists, not users.

**§2B.1 does not exist in any copy I can read.** I did not invent personas. The test below uses the four audiences the spec names elsewhere. Slot 5 is marked pending.

| ID | Persona |
|---|---|
| P1 | Visitor planning a walk |
| P2 | Harlem resident |
| P3 | Educator |
| P4 | Press |
| P5 | *pending §2B.1 from Mike* |

### Method note
The `design:user-research` skill loaded but carries no tree-testing procedure, so I followed the NN/g tree-testing method (https://www.nngroup.com/articles/tree-testing/) directly: text-only hierarchy, task phrased in the user's words without nav labels, record first click and success. This is an **expert walkthrough of the tree, not a study with participants**. NN/g recommends roughly 50 participants per tree for quantitative results. Treat these as hypotheses to validate with a real tree test (Treejack or similar) before the labels ship.

Trees tested:
- **Current:** Home / Explore / Schedule / Spatial / Notifications / [avatar → Profile → Settings]; footer adds Profile, Settings.
- **Proposed:** Explore / Walks / Stories / Today / [Preview AR] / [Get the app]; footer Company: About, Press, Accessibility, Privacy, Terms.

### Tasks
T1 Find tonight's events · T2 Find a walk about jazz · T3 Find the story about the Hotel Theresa · T4 Find out how AR works · T5 Report a wrong opening time

### Current site

| | T1 tonight's events | T2 jazz walk | T3 Hotel Theresa story | T4 how AR works | T5 wrong hours |
|---|---|---|---|---|---|
| P1 visitor | Schedule → **fail**: instructor booking demo | Explore → search "jazz" (the placeholder literally suggests it, `ExploreMasterPane.tsx:56`) → "No matches yet"; no walks exist → **fail** | Explore → search → not in the 8 seeds (`explore.store.ts:27-126`) → **fail** | Hero "Enter the spatial experience" → light-cycle race → **fail** | Explore → place → "Sources + corrections" card says controls arrive later (`ExplorePlaceDetail.tsx:97-103`) → **fail** |
| P2 resident | Schedule or Notifications → **fail** | Explore → **fail** (as P1) | Explore → **fail** | Spatial → **fail** | Avatar/Settings looking for "contact" → **fail** |
| P3 educator | Schedule → **fail** | Explore → **fail** | Explore → **fail** | Spatial → dev stack copy, not an explanation → **fail** | Footer → no About/Contact → **fail** |
| P4 press | Schedule → **fail** | Explore → **fail** | Explore → **fail** | Spatial → **fail** | Footer, looking for Press/Contact → **fail** |
| P5 | pending | pending | pending | pending | pending |

Result: 0 of 20 completable. Below 1024px, T2/T3/T5 fail one step earlier, because Explore search and detail are hidden (§2). Every failure is a content or route gap, not only a labelling problem; the current labels add to it: "Schedule" draws T1 to a booking tool and "Spatial" draws T4 to a game.

### Proposed labels (validating the words, assuming the target pages exist)

| | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| P1 visitor | Today → **pass** | Walks → **pass** | Stories → **pass**; may try Explore first, passes if the place page links its stories | Preview AR → **pass** (desktop). Mobile: hidden in More → 🟡 risk | No label fits; would open the place page → **pass only if** `/places/[slug]` carries "Report a problem" |
| P2 resident | Today → **pass** | Walks, or Explore search "jazz" → **pass if** Explore search returns walks and stories as well as places | Explore search "Hotel Theresa" or Stories → **pass if** search is cross-type | Preview AR → **pass** | Place page → same condition as P1 |
| P3 educator | Today → **pass**; may look for "programs" → 🟡 | Walks → **pass** | Stories → **pass** | Preview AR, or About → **pass if** `/about` links to `/ar` | Footer About → **pass only if** About has the corrections path the handoff asks for (§2A.8 `/about`, line 1287) |
| P4 press | Today → **pass** | Walks → **pass** | Stories → **pass** | Press → **pass if** `/press` links `/ar`; Preview AR also works | Footer Press/About → same condition as P3 |
| P5 | pending | pending | pending | pending | pending |

What this says about the labels:
- **Explore, Walks, Stories, Today** each have one obvious task and no overlap in this set. 🟢
- **"Today" for "tonight"** works for T1. Planning a future date needs a visible date control on `/today` that writes `/today/[yyyy-mm-dd]`. 🟡
- **"Preview AR"** works on desktop. On mobile it sits behind More, so a T4 user has to guess. Consider a Preview AR entry on the home page and on any place with `arCandidate: true`. 🟡
- **T5 has no home in the target IA.** 🔴 Nothing in the header, dock, More sheet or footer says Contact, Corrections or Report. Recommend two additions: a "Report a problem" action on every `/places/[slug]` and `/events/[slug]` (pre-filled with the entity ID and the field), and a "Corrections" or "Contact" link in the footer Company column and the More sheet.
- **Cross-type search on Explore** is load-bearing. P2 will type into Explore before scanning the nav for every task. If Explore search returns places only, T2 and T3 fail for that persona.

## 7. Priority actions

1. 🔴 Replace the shell's nav model: four destinations + Preview AR + Get the app, `MightsDock` below 768px, skip link, and an `isActive` that matches on segment boundaries and maps `/places/*` → Explore, `/events/*` → Today. Remove the avatar and the app-only routes, with 308 redirects (`ROUTE_INVENTORY.md` §5).
2. 🔴 Make every route server-renderable enough to export `metadata` / `generateMetadata`, add `app/global-not-found.tsx`, `sitemap.ts`, `robots.ts`, breadcrumbs + BreadcrumbList JSON-LD. Decide "Harlem Might" vs "Harlem Mights" first.
3. 🔴 Move Explore state into the URL, give it a mobile list/map toggle, split place detail into `/places/[slug]`, and add a "Report a problem" path the tree test shows is missing from the target IA.
