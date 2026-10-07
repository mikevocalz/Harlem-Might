# Premium experience audit (Phase 1)

Audit for prompt pack v3, run 2026-10-07 against `main` at `cc5d386` (PRs #14, #15 and #16 merged). No production UI changed in this phase.

Evidence came from a production build (`next start`, BUILD_ID `hL8kTNhOWnsbuym0CCATK`) on localhost. Screenshots referenced below live in `audit/premium-p1/`. Lighthouse protocol and medians are in section 18.

## Standing decisions this audit applies

These come from the repo owner and override the pack where they disagree.

| # | Decision | Pack text it overrides |
|---|---|---|
| D1 | The public site stays dark, with the gold logo colour as primary. Light values remain for the mobile app's light mode. Read "daylit" in the pack as "warm dark, gold primary, legible outdoors". | `00-shared-contract.md` "Light / dark direction"; Phase 1 hypothesis 12 |
| D2 | Map style: compare current `mapbox/dark-v11` with a warm dark style built from the tokens. No light-map prototype. | Phase 4 "light/custom Mights daylit" prototype |
| D3 | Public name is "Harlem Might", singular. Internal `Mights*` component names stay. | "Flag, do not decide" |
| D8 | B12 Profile/Saved is struck: `/profile` redirects to `/` (`apps/web/next.config.ts`). Returns when a signed-in saved-places route ships. | Bento register B12 |
| D9 | Homepage uses B2 "Start with a block", not B3. B3 needs story records, and none exist yet. | B2/B3 swap left open |
| D10 | Download keeps its "not in the stores yet" page. No store badges and no QR until a real destination exists. | — |
| D11 | One PR per phase, merged to `main` when its gates pass. | Single PR in Phase 8 |

## 1. Executive diagnosis

- **Every image on every audited route is a Mapbox static map.** The homepage requests 10 map rasters and 0 photographs (`apps/web/components/site/ProductHome.tsx:93,109,160,205` plus 6 in `packages/ui/mights/MightsPlaceBento.tsx:33`). `MightsFigure` appears only on About, Press and Legal. The footer promises "Photographs credited on each page" (`packages/ui/mights/MightsFooter.tsx:62`), yet the product routes carry no photographs.
- **One card shape covers the whole product.** `MightsPlaceBento` has a single layout: a map on top, text below, notched rails. Home, place "Nearby", Walks, Stories and Today all render it. Its span tables (`SPANS` 7/5, 5/7, 7/5 and `THREE` 5/4/3, `MightsPlaceBento.tsx:16-17`) form a checkerboard with no dominant module, which breaks the register's "one dominant item" rule.
- **Walks, Stories and Today are the same page with different nouns.** Each has an H1, a lead, a rail, a "No … yet" H2, "Open the map" and three map cards. Walks and Today show the identical trio: Apollo, Red Rooster, Sylvia's.
- **The Explore sheet is not a dialog.** Selecting a place moves no focus. Escape does nothing. On mobile, Close is the 15th Tab stop and closing drops focus to `<body>` (`ExploreWorkspace.tsx:182-248`, measured in `keyboard.json`). This is the most serious accessibility defect.
- **Mapbox markers are announced as images.** Mapbox sets `role="img"` on the custom `<button>` (`ExploreMap.tsx:92-102`), so `aria-pressed` is invalid. Axe rates this critical (`aria-allowed-attr` ×6) on both Explore states and both widths. Explore also has no `<main>` landmark.
- **The dark brand holds up and the tokens are coherent:** text 17.2:1, muted text 7.6:1, gold on warm black 12.4:1. The weak link is `mapbox/dark-v11` (`MightsMapImage.tsx:8`, `ExploreMap.tsx:80`). It is a cool neutral grey, so every map panel reads as a grey slab against warm black `#0B0906`. Its small italic labels fall to roughly 3.9:1 and shrink further in pitched static views.
- **Cobalt and marquee red never render on the public site.** `MightsAccentFrame tone="cobalt"` maps to `--color-primary`, which is gold in dark mode (`MightsAccentFrame.tsx:11`). Red appears only for `state="live"`, which no route uses. The palette is effectively gold and warm black.
- **AR is described, never shown.** `/ar` and the "From the map to the sidewalk" chapter both show a pitched static map with one pin. No frame shows a label on a facade.

## 2. Five-second test — the 8 questions

Scope: the current home only, `apps/web/components/site/ProductHome.tsx` (246 lines). Visible copy in reading order: h1 "See the block. Know the story." (`:78`), lead "Places, walks and the history attached to each corner of Harlem, on one map." (`:82-83`), CTA "Open the map" (`:87`), stamp "Apollo Theater / West 125th Street" (`:128-132`), "Start with a block." (`:144`), "Three doors on West 125th Street and Malcolm X Boulevard. Pick one and the map keeps everything attached to it: the history, the hours, the way in." (`:146-148`), "Places on the map" + "See every place" (`:187-189`), "From the map to the sidewalk." (`:220`), "In the app, the same place record follows you outside. Hold up your phone on the block and the label sits on the building it belongs to." (`:222-224`), "See how AR works" (`:228`), close "Harlem is not a list of landmarks." + "Open the map" (`:238-241`).

| # | Question | Score | Evidence | Note |
|---|---|---|---|---|
| 1 | What is Harlem Might? | **Inferable** | "Places, walks and the history attached to each corner of Harlem, on one map." (`:82-83`) | The lead answers it; the h1 does not. "See the block. Know the story." could be a podcast, a museum show or a tour company. Nothing in the hero names the product as a map until the lead line. |
| 2 | Map / guide / archive / event / AR / combination? | **Confusing** | Lead says map (`:82`); "walks" (`:82`) implies a guide; "history" implies archive; AR chapter (`:220-228`); no events on home | Reads as map + guide + AR. Today (events) is in the primary nav (`packages/ui/mights/routes.ts:38`) but absent from home, so the event role is invisible. Walks are promised in the lead but `/walks` is an empty state ("No walks published yet", `apps/web/app/(site)/walks/page.tsx:16`). |
| 3 | Why this instead of Apple/Google Maps? | **Missing** | No comparison or differentiator line anywhere in `ProductHome.tsx` | The closest is "the map keeps everything attached to it: the history, the hours, the way in" (`:147-148`). Hours and directions are exactly what Google Maps already does well, so this sentence argues on the incumbent's ground. |
| 4 | Why is the editorial layer valuable? | **Inferable** | "Know the story." (`:78`); "the history attached to each corner" (`:82`); "Harlem is not a list of landmarks." (`:238`) | The claim is there; proof is not. No story excerpt, source, date or named author appears on home. The data has `whyItMatters` per place (`packages/app/features/explore/explore.store.ts:17`), and the copy there is generic: Apollo "belongs in the experience as both a current destination and a gateway into Harlem music, performance, and neighborhood history" (`explore.store.ts:44-45`). That is product-spec voice, not editorial. |
| 5 | What happens after "Open the map"? | **Missing** | Button → `routes.explore()` = `/explore` (`:87`, `routes.ts:16`) | No preview of the map UI, no "8 places" count, no hint of list vs map. The page metadata promises "Find a place in Harlem on the map or in the list, and open its story" (`apps/web/app/(site)/explore/page.tsx:7`), but home never says it. The catalogue is 8 places (`explore.store.ts:32` onward, 8 `name:` entries). A first-time user does not know whether they are getting a live interactive map, a list, or an app download. |
| 6 | What does AR add? | **Inferable** | "Hold up your phone on the block and the label sits on the building it belongs to." (`:222-224`) | Clear on the mechanic, silent on the value (why a label on a building beats reading the place page). "In the app" (`:222`) is the only hint AR is not on the web; the AR page says it outright: "AR runs in the Harlem Might app" (`apps/web/app/(site)/ar/page.tsx:36`) and the app "is not listed on the App Store or Google Play yet" (`download/page.tsx:15`). Home hides that AR is unavailable today. |
| 7 | What looks generic? | **Confusing** | Three of four visuals are Mapbox statics of the same 3 places: hero (`:93-98`), lens (`:109-120`), block map (`:160-168`), sidewalk (`:205-215`) | Every image is a map tile. No photograph, archival image, face, building facade or typography specimen of Harlem appears. A map of 125th St with pins could front any city-guide startup. "See the block. Know the story." and "From the map to the sidewalk." follow the two-beat tagline shape common to the category. The place bento (`:193`) is the only non-map module. |
| 8 | Primary action? | **Obvious** | "Open the map" is the only primary-variant button in the hero (`:87`) and repeats at `:151-153` (secondary) and `:241` (primary) | Prior audit flagged two competing hero CTAs (`docs/design/audit/IA_AUDIT.md:78,99`); that is fixed. Risk: three "Open the map" buttons with no change in promise read as padding. |

**Summary.** 1 obvious (primary action), 3 inferable (identity, editorial value, AR), 2 missing (vs. incumbents, post-click), 2 confusing (product type, generic look). The home sells "story" but shows only maps, and promises walks, hours and AR that do not exist yet on the web (`walks/page.tsx:16`, `explore.store.ts:11-30` has no hours field, `download/page.tsx:15`).

**Factual risk to fix in copy now.** "the history, the hours, the way in" (`ProductHome.tsx:147-148`): `HarlemPlacePreview` has no hours or entrance/access field (`explore.store.ts:11-30`). The place page renders `whyItMatters` (`apps/web/app/(site)/places/[slug]/page.tsx:67`), nothing about hours. The line promises data the catalogue does not hold.

## 3. User hypotheses

Evidence labels: **[repo]** = this codebase at `cc5d386`; **[doc]** = a doc in this repo; **[pack]** = the v3 prompt pack (`01-audit-research-copy.md` §2); **[public]** = general public fact, no specific source claimed. No interviews exist. The prior IA audit could not find user personas anywhere either (`docs/design/audit/IA_AUDIT.md:138-144`).

| Persona | Evidence | Assumption | Research question | Design implication |
|---|---|---|---|---|
| **Harlem resident** | [pack] needs: local usefulness, respectful framing, no tourist gaze, live context. [repo] Catalogue is 8 headline institutions (Apollo, Red Rooster, Sylvia's, Schomburg, Studio Museum, NBT, Marcus Garvey Park, Strivers' Row; `explore.store.ts:38-138`). No events (`today/page.tsx:25` "No events listed yet"). [repo] Close line "Harlem is not a list of landmarks." (`ProductHome.tsx:238`) sits above a page that is a list of landmarks. | Residents already know these 8 places; value for them is what is on tonight and stories they have not heard, not orientation. | What would a resident open this for on a weekday, and what framing of a block they live on reads as outsider gaze? | Today and Stories carry the resident case, not Explore. Copy avoids "discover Harlem" phrasing. Home shows a current item (an event or a dated story) once one exists; until then it should not claim live context. |
| **Visitor with cultural intent** | [pack] needs: orientation, transit, current info, short walks, access confidence. [repo] No hours, transit, entrance or accessibility fields in `HarlemPlacePreview` (`explore.store.ts:11-30`; 0 matches for hours/transit/subway/wheelchair). [repo] Walks empty (`walks/page.tsx:16`). Home promises "the hours, the way in" (`ProductHome.tsx:147-148`). | Visitors arrive with one anchor (usually the Apollo or the Schomburg) and want a short, sequenced plan around it. | Do visitors plan before arriving (desktop web) or on the block (phone)? Which anchor brings them? | First walk ships before any home redesign claims walks. Place pages need "getting there" and access facts before AR. Remove the hours claim until the data exists. |
| **Student / history-curious** | [pack] needs: sources, archival context, timeline, related people/places, fact vs interpretation. [repo] No source, citation, date or author field on places (`explore.store.ts:11-30`); `osm` is the only provenance and it covers coordinates, not history (`:23-25`). Stories empty with a promise "Each story will be sourced" (`stories/page.tsx:15`). | This group judges credibility in seconds by the presence of citations and dates. | Which sources would a teacher or student trust enough to cite Harlem Might, or will they always go to the Schomburg directly? | Story template needs a visible sources block and a fact/interpretation split from day one. A place page links out to its stories and the institution's own archive instead of re-hosting it. |
| **Person on the sidewalk** | [pack] needs: fast map, outdoor readability, one hand, minimal typing, location state, AR only when useful. [repo] Prior audit: Explore below 1024px was a dead end, list pane hidden (`IA_AUDIT.md:56`); pins 36px, numbers only (`IA_AUDIT.md:53`). [repo] App not in stores (`download/page.tsx:15`), so on-sidewalk use today is mobile web only. [repo] All 8 places are `arCandidate: true` (8 of 8). | Sidewalk use will be mobile web for the foreseeable future, so web Explore on a 390px phone in daylight is the real product for this person. | What is the first thing someone standing on 125th Street needs: "what is this building", "what is near me", or "how do I get to X"? | Mobile Explore gets priority over home polish: list/map toggle, location button, large tap targets, high-contrast pins with names. `arCandidate` must mean something selective or it carries no signal. |
| **Spatial / Specs early adopter** | [pack] needs: a reason for glasses, no fake capabilities, phone fallback, map-to-place continuity. [doc] Specs is "adapter foundation merged", Lens Studio owns rendering (`docs/XR-PLATFORM-MATRIX.md:19`). [doc] "Nothing in this doc is verified. Nobody on the team has run anything on Meta VR Glasses." (`docs/META_VR_GLASSES.md:15`). [repo] Web AR page asks for no camera and defers to an unreleased app (`ar/page.tsx:36-39`, `download/page.tsx:15`). | Early adopters will try it once if it runs on their device; a waitlist or render with no device build loses them. | Is there any glasses build that runs on a real device by launch? If not, what does this person get today? | Public pages name only what runs. `/ar` explains the phone app path honestly; no glasses claims, renders or device names until one is verified per `XR-PLATFORM-MATRIX.md`. |

### Assumption register

| ID | Assumption | Risk if wrong | Cheapest test |
|---|---|---|---|
| A1 | People understand "Open the map" leads to an interactive map they can use now, not an app download. | Bounce at the first click, or users expect AR and leave when they get tiles. | 5-second test with 5 people on the current home: "what happens if you click this?" |
| A2 | The editorial layer (stories, why-it-matters) is the reason to use this over Google Maps. | The product competes on hours and directions, where it loses. | Show 5 people a place page with and without the story text; ask which they would send a friend. |
| A3 | Visitors plan on desktop before arriving. | Desktop-first home and Explore investments miss the sidewalk use. | Vercel analytics device split on `/explore` once traffic exists; until then ask 5 visitors at the Apollo. |
| A4 | Residents want this at all. | The product reads as a tourist guide about their neighborhood, written from outside. | 3 conversations with residents reviewing the home copy and one story draft, focused on framing. |
| A5 | Walks are wanted as fixed routes rather than "what is near me". | Effort goes into authored routes nobody follows. | Publish one walk; compare its completion against place-page views near the route. |
| A6 | AR on a phone adds something the place page does not. | AR is a demo, built and maintained for a feature people try once. | Paper prototype on 125th St: label overlaid vs. the same text on a phone screen, 5 people. |
| A7 | 8 places is enough to be useful on day one. | The map looks empty and confirms "list of landmarks". | Count how many of the 8 fall within a 10-minute walk of each other; ask 5 people if the map feels finished. |
| A8 | Students will treat Harlem Might as a citable source. | Stories without sources get ignored or, worse, quoted wrong. | Show one sourced story draft to 2 teachers; ask if they would assign it. |
| A9 | "Today" is the right name for events when listings are empty. | An empty Today every day trains residents not to come back. | Count events available from a single source (e.g. Apollo, NBT calendars) for one week before the page goes in the nav. |

## 4. Research gaps

- **No user evidence of any kind.** No interviews, analytics, search logs or support mail. The IA audit's tree test was a heuristic walk-through, not a study with participants (`IA_AUDIT.md:154-174`). Every row in §3 is a hypothesis.
- The five-second test reads the shipped source. The rendered home (`audit/premium-p1/home@390.png`, `home@1440.png`) carries the same copy and order.
- **Content inventory is unknown.** No list of walks, stories or event sources exists in the repo. The empty states promise "first routes are being researched now" (`walks/page.tsx:18`) with no owner or date.
- **No provenance model for history.** Places carry an OSM id for coordinates only (`explore.store.ts:23-25`). Nothing defines who writes a story, what counts as a source, or how corrections work.
- **No corrections path.** The tree test's T5 "report a wrong opening time" had no home in the target IA (`IA_AUDIT.md:190`); nothing in `routes.ts` adds one.
- **Event supply is unmeasured.** Today ships in primary nav (`routes.ts:38`) with no event feed or data source identified.
- **Resident framing is untested.** Nobody from the neighborhood has reviewed the copy.
- **Device reality for glasses is unverified** (`docs/META_VR_GLASSES.md:15`), and the phone app is not in stores (`download/page.tsx:15`). Any spatial UX claim is speculative until one build runs on hardware.
- **Persona 5 from the original handoff (§2B.1) was never found** (`IA_AUDIT.md:144`); the pack's five personas replace it, but that substitution is unconfirmed with Mike.

## 5. Reference patterns (Mobbin)

Owner: Mobbin Researcher. Read-only pass. Sources: Mobbin MCP (`search_screens`, `search_flows`, `search_sections`) run on 2026-10-07. Every URL below came back in a tool result in this session, and I looked at the returned preview images before writing the row. Pack-listed URLs that the tools did not return are marked **listed in pack, not re-opened**.

Harlem Might runs dark: gold primary `#F8C626` on warm black. Most references below are light-mode apps. Where a row says "light", copy the structure, not the palette. Values still come from `packages/theme/tokens.ts`.

Column key: **Problem** = problem solved · **Hier.** = hierarchy · **Map/list** = map–list relationship · **CTA** = CTA hierarchy · **Persist.** = persistent elements · **Sheet/route** = sheet vs route · **Fold** = what sits above the fold · **Don't copy** · **Mights** = primitive that would carry it.

### 0. Pack-listed references, verification status

| Pack reference | Status |
|---|---|
| Hypelist `screens/299f4019-…` | Listed in pack, not re-opened. Other Hypelist screens were returned and studied (see §2). |
| Beli `screens/f85244e1-…` | Listed in pack, not re-opened. Other Beli screens returned and studied (§2, §3). |
| Apple Maps place detail `flows/e7be5181-7495-4241-80d1-5af54c618dd7` | Verified, 8 screens. |
| Google Arts & Culture `screens/01d22c81-…` | Listed in pack, not re-opened. Other GA&C screens returned and studied (§6). |
| Rodeo map/list `flows/65361716-2c12-43e8-82bf-44d802dfe7f8` | Verified ("Switching to map view", 3 screens). |
| corner places `flows/7f5e013e-e791-43a8-b289-597b0d69f627` | Verified ("Places", 4 screens). |
| KOBU editorial `sites/sections/5dd15202-…` | Listed in pack, not re-opened. Other KOBU sections returned (§6). |
| KOBU asymmetric bento `sites/sections/f5959421-5ded-4adb-98db-49143db77839` | Verified. **Correction:** the returned image is three equal-width image columns with a kicker, headline and dek under each. It is an editorial row, not an asymmetric bento. Asymmetry comes from headline length only. Use Lightship and Koto (below) as the asymmetric references. |
| Lightship `sites/sections/a5fa6838-…` | Listed in pack, not re-opened. Two other Lightship sections returned (§1). |
| DICE events `sites/sections/3bfaf0a8-f62b-48b7-8e89-7b2c48778d69` | Verified. The image is DICE's editorial blog index (staggered two-column, image + kicker + headline), not an event grid. Event grids are `ccbd76d8` and `9a258c0d` (§7). |

### 1. Homepage

| URL | Problem | Hier. | Map/list | CTA | Persist. | Sheet/route | Fold | Don't copy | Mights |
|---|---|---|---|---|---|---|---|---|---|
| [Lightship — founders + image split](https://mobbin.com/sites/sections/f387455d-ac96-4e8f-bff8-e92e8a84b75e) | States the mission in one centred line, then proves it with a 1:2 asymmetric pair: narrow text tile, wide night-sky image | Statement headline → small coloured quote tile → dominant image | None | No button; the image is the hook | Minimal top bar with centred mark | Route | Headline + top of the pair | Red tile on white; the floating "Ask me anything" chat chip | `MightsHeading` + `MightsPlaceBento` (B2/B4 pattern: one narrow `MightsNotchCard` quote + one dominant `MightsFigure`) |
| [Koto — studio news, one dominant item](https://mobbin.com/sites/sections/4a8e1f4c-be4a-4ffc-8d45-04761cab210d) | Editorial index on black where one story is clearly the lead | Large left lead (~half width) → two smaller items right; each has headline, pill tag, date | None | "View all" text link top-right; no buttons | Section label + "View all" | Route per item | Whole section fits one desktop viewport | Grey pill tags; dates without year | `MightsPlaceBento` story-dominant variant (B1/B3/B8); `MightsFigure` + `MightsHeading`; `MightsText` for date |
| [Museum of the Human Web — about + visit](https://mobbin.com/sites/sections/38cadd16-226b-460b-911a-8b430b117273) | Splits "what this is" prose from "where and when" facts in two columns | Left: editorial paragraph. Right: dates + street address set large in the accent colour | None | Inline links only | — | Route | All of it | White ground; orange accent. Keep the split, not the colour | `MightsProse` (left) + `MightsLocationStamp` (right). Mirrors the pack lesson that visit info and history are different data |
| [DICE — editorial hero](https://mobbin.com/sites/sections/5b9d580b-c51e-4ffb-aec8-7de30a877d49) | Full-bleed photo hero with one centred headline and a persistent search + "Get the app" in the bar | Image → headline; nav carries search and app CTA | None | Single dark pill "Get the app" in nav | Top nav with search field | Route | Hero image + headline | Thin light display type over a busy crowd photo; Harlem hero stays bento-free and image-rights-cleared | `MightsNavbar` (search + app CTA) over hero `MightsFigure` + `MightsHeading` |

### 2. Explore (map / list discovery)

| URL | Problem | Hier. | Map/list | CTA | Persist. | Sheet/route | Fold | Don't copy | Mights |
|---|---|---|---|---|---|---|---|---|---|
| [Rodeo — switching to map view](https://mobbin.com/flows/65361716-2c12-43e8-82bf-44d802dfe7f8) | One saved-places set shown as cards or as a NYC street map | List: big card per save with source chip. Map: emoji pins with name labels, category chips above the bottom bar | Toggle (grid ⟷ map icons) in a bottom capsule; same data, same filters | Search field is primary; "+" top-right | Bottom capsule (view toggle + search) and category chips | Same route, view swap | Map fills the screen; chips + capsule float | Emoji pins; light map. Use the Mights dark Mapbox style | `MightsDock`-style bottom capsule, `MightsSearchForm`, `MightsMapImage`/interactive map; no bento (Explore is never-bento) |
| [corner — Places](https://mobbin.com/flows/7f5e013e-e791-43a8-b289-597b0d69f627) | Personal places on a map with a peek card, pull up into a list | Map → filter chips (all places / eat / café) → bottom sheet: one place peeking, drag up for full list | Bottom sheet over map; sheet height decides list vs map emphasis | Locate-me FAB; tap card for detail | Header title, filter chips, sheet handle | Sheet for list, route for detail | Map + one peek card | Bubbly display font; photo-thumb pins | Mobile Explore: map + sheet; rows as `MightsNotchCard` compact; filters as `MightsButton` chips |
| [Beli — ranked list with "View Map"](https://mobbin.com/screens/f010dc98-7330-44ed-a9a3-bf64214f204c) | Long ranked list that still gets you to a map in one tap | Tabs (Been / Want to Try / Recs) → filter chips → numbered rows with score badge | List-first; floating "View Map" pill bottom-right | Score is the visual anchor; "View Map" secondary | Tab bar, filter chips, FAB | Route swap | Tabs + 3–4 rows | Scores and "Open now" (pack bans unsourced ratings/open-now) | `MightsNotchCard` rows, `MightsButton` floating "Map"; drop the scores |
| [GetYourGuide — list + map split (web)](https://mobbin.com/screens/7d8762de-2deb-4393-8667-dd8751d3b206) | Desktop browsing where list and map are both visible | Narrow left list (thumb, title, duration, price) ⟷ wide map with photo pins and cluster counts | Side-by-side; "Close map" returns to full list | Price per row; heart save | Filter chip row over list | Map is an overlay panel on the results route | Both panes | Prices, star ratings; light map | Desktop Explore SplitView: list of `MightsNotchCard` + interactive map; inspector replaces the price column with `MightsLocationStamp` |
| [Airbnb — experiences grid + map (web)](https://mobbin.com/flows/e141d91d-4c5f-4d79-806b-bf9988762533) | Category-filtered results with a map pane | Category chip row → 3-up image grid (left 55%) → map with category icon pins (right) | Split view; pins use category glyphs instead of prices | Heart save per card | Search bar + chip row | Detail is a separate route | Chips + first grid row + map | Card grid density; price-first labels | Pin glyph-by-category idea for Mights map markers; grid stays a list, not a bento |

### 3. Place detail

| URL | Problem | Hier. | Map/list | CTA | Persist. | Sheet/route | Fold | Don't copy | Mights |
|---|---|---|---|---|---|---|---|---|---|
| [Apple Maps — place detail](https://mobbin.com/flows/e7be5181-7495-4241-80d1-5af54c618dd7) | Everything about one place without losing the map | Name + type → 3 action buttons (Directions / Download / Website) → fact row (Hours · Ratings · Accepts · Distance) → photos → Good to Know → Hours → Details → Report an issue | Sheet rides over the map; map stays visible at the top at every detent | Directions primary (filled), others tonal | Bottom action capsule (+, ★, 👍, …); close X | Sheet (half → full) | Name, actions, fact row, first photos | Ratings and "Accepts Apple Pay" style facts we can't source; glassy light sheet | Inspector on Explore + place route header: `MightsHeading`, `MightsButton` row, a fact strip in `MightsLocationStamp`; facts only with source + fetched time |
| [Apple Maps — location detail](https://mobbin.com/flows/ce26b26e-0dd0-4049-894a-f00eec24b0ae) | Same pattern for a large institution, with About text and Wikipedia attribution | Name → 4 action tiles → Hours / Distance strip → photo strip → About (truncated, "More") → "More on Wikipedia" | Sheet over map | Primary tile filled blue; rest tonal | Close X, share | Sheet | Name, actions, hours/distance, photos | "Get the App" promo inside detail | `MightsProse` About with an explicit source line; attribution pattern matches the provenance policy |
| [Airbnb — experience details (web)](https://mobbin.com/flows/87238346-9166-470e-ac4c-fc238533366c) | Long-form detail page with a sticky booking rail | Gallery → title → host story → reviews → accessibility + policies → "Similar experiences" carousel | Map is a section, not the frame | Sticky "Show dates" in a compact header after scroll | Sticky mini-header with title + CTA | Route | Gallery + title + booking card | Pricing, reviews, the gold "vetted" seal | Sticky compact header pattern for `MightsBreadcrumb` + `MightsButton`; "Similar" row → B5 bento instead of a carousel; accessibility block as sourced `MightsText` |
| [Beli — place page](https://mobbin.com/screens/f6356779-4fa0-44e9-a10c-ede728731cfe) | Place page that opens over a faded map | Serif name over map → tags → Website / Call / Directions outline buttons → Scores → Photos | Map is a background header that fades into content | Three equal outline buttons; save + add icons beside the name | Bottom tab bar | Route | Name, tags, three CTAs | Score modules; coach-mark tooltip | Hero: `MightsMapImage` faded behind `MightsHeading` (serif works with Newsreader); CTAs as `MightsButton` outline set |

### 4. Walks (B6 index, B7 route-facts strip, stop sequence)

| URL | Problem | Hier. | Map/list | CTA | Persist. | Sheet/route | Fold | Don't copy | Mights |
|---|---|---|---|---|---|---|---|---|---|
| [AllTrails — trail overview, facts block](https://mobbin.com/screens/fc4f4c20-dc64-4ee6-b5f9-a3f093e30db7) | Route facts readable at a glance | Photo → title → rating · difficulty · park → 2×2 facts: Length, Elevation gain, Estimated time, Route type (icon) | Map is a separate tab/screen | Save, share, bookmark icons on the photo | Back, actions on photo | Route | Photo, title, all four facts | Star rating; elevation (Harlem walks are flat; swap for stop count and start/end) | **B7 reference.** `MightsPlaceBento` compact variant: 3–4 `MightsNotchCard` modules (distance dominant, then time, stops, start → end); sourced accessibility note as `MightsText` |
| [AllTrails — drawn route summary bar](https://mobbin.com/screens/f1f8dd32-766c-46e1-abd1-e72a8ebda5a7) | Keeps route facts pinned while the map is the main view | Full map with green route line → bottom bar: Length · Elev. gain · Est. time · Save | Map is the screen; facts are a persistent footer | Single filled "Save" | Bottom summary bar | Route | Map + bar | Mapbox outdoor style; elevation | Mobile walk map: one-line facts bar using `MightsLocationStamp` tokens; keep Mapbox attribution visible as AllTrails does |
| [Tripadvisor — itinerary](https://mobbin.com/flows/7a396ca0-1212-47fb-982b-136b2be0dc56) | Ordered stops with a map and a per-stop sheet | Map thumbnail with "View Map" → numbered vertical stop list (start + 4 stops, duration each) → map with numbered pins → stop sheet with Previous / Next stop | List and map share stop numbers | "Check availability" price CTA; per-stop "See details" | Bottom price bar; stop sheet nav | Sheet per stop over map | Map thumb + first 3 stops | Price bar; stock photography | Ordered stop sequence stays non-bento: numbered `MightsNotchCard` list + `MightsMapImage`; Previous/Next stop as `MightsButton` pair |
| [Viator — full itinerary](https://mobbin.com/flows/422bb020-daa3-41b6-bfb4-95ef8b60ac56) | Meeting point + what to expect, expandable per stop | Meeting point text + map → numbered timeline (1, 2) with duration → "See full itinerary" | Map only for the start point | "Check availability" filled; itinerary link outline | Bottom price bar | Route for full itinerary | Start point + first stops | Booking framing | Start/end callout for B7's "start → end" module; timeline connector reusable in the stop list |

### 5. Stories (B8 index, B9 end-of-article)

| URL | Problem | Hier. | Map/list | CTA | Persist. | Sheet/route | Fold | Don't copy | Mights |
|---|---|---|---|---|---|---|---|---|---|
| [KOBU — three-up editorial row](https://mobbin.com/sites/sections/f5959421-5ded-4adb-98db-49143db77839) | Story index with kicker labels in mono caps | Tall photo → mono kicker ("IN CONVERSATION WITH", "CULTURE") → serif-ish headline with ↗ → short dek | None | Arrow glyph on the headline is the CTA | — | Route | Three photos + headlines | Equal columns (B8 needs one dominant story); cream ground | Kicker treatment for `MightsText` eyebrow; headline-with-arrow link; layout itself not reused |
| [Assembly Coffee — journal lead](https://mobbin.com/sites/sections/2218a2ac-844a-42bc-b957-64ac22214a79) | Journal landing with one dimmed full-width lead story | Centred "Journal" title + category filters → full-bleed darkened photo with date, italic headline, byline | None | The lead is the link | Category filter row | Route | Title, filters, lead | Italic display headline everywhere | Stories index top: filters as `MightsButton` text set, lead as dominant module of B8 (`MightsFigure` + `MightsHeading`) |
| [DICE — editorial index](https://mobbin.com/sites/sections/3bfaf0a8-f62b-48b7-8e89-7b2c48778d69) | Blog index without a uniform grid | Two columns, offset vertically, mixed image sizes; tiny source kicker above each headline | None | Headline link | — | Route | 2–3 items | Random offsets with no dominant item; white ground | Shows rhythm without masonry JS; B8 should take the offset feel but keep one dominant story |
| [Dropbox — related articles](https://mobbin.com/sites/sections/3af6a5fe-ee5c-491d-871a-e2579f5efd05) | End-of-article "Related Articles" on a dark green band | Condensed display heading → three square illustrations → headline → byline | None | Headline link | — | Route | Heading + three cards | Equal three-up; illustration style | **B9 reference** for placement and band: closes the article on a `MightsBand`. B9 swaps equal cards for the register's shape: the place the story is about dominant, then archive item and walk |
| [FARFETCH — related articles](https://mobbin.com/sites/sections/101ac33b-ddd1-4501-bd37-326ed9c863bc) | Related content with category kicker, author, date and save | Small caps label → three cards: image, kicker, headline, "By … date", bookmark | None | Card link + bookmark | — | Route | All three | Light card borders; stock imagery | Metadata line format (kicker / headline / byline + date) for B9 modules; save icon if Saved exists |

### 6. Editorial / cultural sites and bento patterns

| URL | Problem | Hier. | Map/list | CTA | Persist. | Sheet/route | Fold | Don't copy | Mights |
|---|---|---|---|---|---|---|---|---|---|
| [Google Arts & Culture — Explore home](https://mobbin.com/screens/fd1e772c-69e8-476e-abc1-32f58cf39cbe) | Entry to a huge cultural archive | Topic chips → feature carousel → Collections card (3,000+ institutions) → Browse topics 2×2 | None | Feature card tap | Bottom tabs (Explore / Play / Inspire) | Route | Chips, feature, Collections | Teal-on-white, carousel hero | Topic chips as `MightsButton` set; institution count as sourced `MightsText`; no carousel |
| [Google Arts & Culture — "Objects that will tell you stories"](https://mobbin.com/screens/f04e5705-1d95-4e8b-8400-97580489024d) | Story collection with one lead object | One full-width lead tile → pairs of half-width tiles below, each with title + one-line dek over the image | None | Tile tap | Back | Route | Lead + two tiles | Coral background; text over busy photos | **Editorial index with a single dominant module.** `MightsPlaceBento` story-dominant variant (B8/B9) |
| [Koto — studio news](https://mobbin.com/sites/sections/4a8e1f4c-be4a-4ffc-8d45-04761cab210d) | See §1 | Lead ≈ 50% width, two smaller | — | "View all" | — | Route | All | Grey pills | **Asymmetric bento #1**, dark ground already matches Harlem Might |
| [Lightship — founders + image](https://mobbin.com/sites/sections/f387455d-ac96-4e8f-bff8-e92e8a84b75e) | See §1 | 1:2 split | — | — | — | Route | — | Red tile | **Asymmetric bento #2** |
| [KOBU — "The Details"](https://mobbin.com/sites/sections/cc63048b-341e-420d-a687-5d5c17aacf3c) | Two photos and two short paragraphs placed on a loose diagonal | Heading + grey subheading → photo top-left, text top-right, text bottom-left, photo bottom-right | None | None | — | Route | Heading + first photo | Cream ground; loose placement on mobile would break reading order | **Asymmetric pattern #3** (KOBU). Use for B4 "Map → sidewalk": `MightsFigure` + `MightsProse` alternating; mobile collapses to source order |
| [Museum of the Human Web — index view](https://mobbin.com/sites/sections/b7def596-32aa-4f69-acb7-bbcb09e5fff3) | Archive shown as a dense object index with Exhibits / Index / Timeline toggles | Toggle row → object thumbnail wall | None | Thumbnail tap | Toggle row, top nav | Route | Toggles + wall | White ground; unlabelled thumbnails fail a11y | Archive mode toggles (`MightsButton` set) for a future archive surface; not a bento |

### 7. Today / events (B10)

| URL | Problem | Hier. | Map/list | CTA | Persist. | Sheet/route | Fold | Don't copy | Mights |
|---|---|---|---|---|---|---|---|---|---|
| [DICE — popular events grid](https://mobbin.com/sites/sections/ccbd76d8-69e7-475e-aee0-b26795977393) | Dark event browsing by city | Location / date / price filters → category icon row → "Popular Events in London" → 4-up poster grid: title, date (accent colour), venue, price | None | Heart + play per card; "Get the app" in nav | Nav with search | Route | Filters, category row, first grid row | Equal 4-up grid (B10 needs one dominant event); prices | Dark ground and accent-coloured date line map well to gold `#F8C626`; date in `MightsText` accent, venue as `MightsLocationStamp` |
| [DICE — trending carousel](https://mobbin.com/sites/sections/9a258c0d-fc25-4a9e-a8e6-50644d7a9486) | "Trending in London" with a short intro and Browse button | Heading + dek + "Browse events" → horizontal poster row | None | "Browse events" pill | — | Route | Heading + row | Carousel; light ground | Section header shape (heading, one-line dek, single button) via `MightsHeading` + `MightsButton` |
| [Rodeo — event detail](https://mobbin.com/flows/f3595a52-bd2c-4404-987b-e4eaac195542) | Event saved from elsewhere with its source shown | Summary → location map → "Saved from" source block → Edit / Delete | Small map card in detail | Calendar-add and share icons | Header icons | Route | Summary + map | Edit/Delete (no user editing on Today) | "Saved from" block is the model for B10's required source + fetched-time line |
| [Luma — upcoming event row](https://mobbin.com/screens/d57a0760-5c3a-4d4c-93fe-5037f0d7b071) | Date-grouped event list | Upcoming / Past toggle → date header ("19 July / Sunday") → row: poster, organiser, title, time + venue | None | Status badge ("Going") | Toggle, bottom tabs | Route | Toggle + first group | Light ground | Date header + row for the non-bento event list under B10; `MightsText` date header, `MightsNotchCard` row |

### 8. AR / Specs / Sightline (B11)

Mobbin search for "AR camera with labels anchored on buildings" (iOS) and "AR glasses product section" (web) returned no true AR camera UI. The closest street-level references are below. Treat them as framing references for B11 and the Sightline chapter, not AR interaction patterns.

| URL | Problem | Hier. | Map/list | CTA | Persist. | Sheet/route | Fold | Don't copy | Mights |
|---|---|---|---|---|---|---|---|---|---|
| [Google Maps — immersive view (directions)](https://mobbin.com/flows/ac78acb2-c5ac-4d6e-bac1-947f1f177ae9) | Shows a route drawn onto a 3D city at dusk | 2D route with fact sheet (13 min, 2.7 mi) → 3D flyover with glowing route line and one destination label → time scrubber | 2D map → 3D city of the same route | "Preview" filled, "Steps" tonal | Close, share, time-of-day | Fullscreen route view | 3D city + label | Photoreal Google 3D tiles we don't have rights to | Closest match to Sightline's route ribbon + POI anchor. B11 dominant module = Sightline (Three.js WebGPU) frame; facts in `MightsLocationStamp` |
| [Google Maps — 360 view](https://mobbin.com/flows/337a0dfd-6591-4af6-97b3-397dcc6eac6f) | From place sheet to street level and back | Place sheet ("Immersive View" tile) → street imagery with address + "1 year ago" capture date → latest photos | Split: street view on top, map strip below | Expand / collapse | Address bar with capture date | Fullscreen | Street image + address | Street View imagery | The capture date on the address bar is the honesty pattern for any then/now media in B11 or B5 |
| [Apple Maps — 360 view](https://mobbin.com/flows/2e6cbe6d-0aa1-44dc-aefb-8c8fb1c1c65c) | Street-level look at a place from its detail sheet | Full street image → bottom pill with place name, share, close | From place sheet | Close | Bottom name pill | Fullscreen over sheet | Image + name pill | Light glass pill | Anchored-label concept for B4/B11: one `MightsLocationStamp` pinned to the real place image |
| [Tripadvisor — 3D nearby map](https://mobbin.com/screens/19f3c852-67e1-4d0c-8161-312ad653c3b8) | 3D buildings with labelled POIs and "Search this area" | Search → 2D/3D toggle → tilted 3D city with POI pins + names | Map with category tabs in a sheet | "Search this area" pill | Tabs + chips | Same route | Map | Rating badges on pins | Supports a 2D ⟷ 3D toggle near Sightline; ratings dropped |

### 9. Download / conversion

| URL | Problem | Hier. | Map/list | CTA | Persist. | Sheet/route | Fold | Don't copy | Mights |
|---|---|---|---|---|---|---|---|---|---|
| [ElevenLabs — download band](https://mobbin.com/sites/sections/0c19121c-1011-49e4-99b7-9569cc45fd0a) | Desktop visitors moving to the phone app | Headline left → QR + store badges bottom-left → two phone mockups right | None | QR first, badges second | — | Route | All | Light app screens inside the mockups | `MightsBand` dark + `MightsHeading` + QR + store badges; phone frame shows a real Harlem Might screen, dark |
| [Shop — download page](https://mobbin.com/sites/sections/11ba1ca4-bc13-4ee0-836a-d6996b160f24) | One job: get the app | Dek → huge "Download Shop" → large QR → store badges → legal small print | None | QR is primary | Persistent mini QR bottom-left | Route | Everything | Finance small print | Download route: centred `MightsHeading`, QR, badges; no bento (never-bento list) |
| [DICE — get the app](https://mobbin.com/sites/sections/f3231b90-c895-47aa-855f-597c52ecfa09) | Minimal app CTA | Condensed headline + QR, nothing else | None | QR | — | Section | All | Black on white | Proof that the download block can be two elements; good for the end of the homepage |

### Patterns we adopt / reject

1. **Adopt** the Apple Maps fact strip (hours · distance · type) under the place name, but every fact carries a source and fetched time. No ratings, no "open now" without a feed.
2. **Adopt** the sheet-over-map inspector for Explore on mobile (Apple Maps, corner) and the side-by-side split on desktop (GetYourGuide, Airbnb). Explore stays bento-free.
3. **Adopt** one shared filter set across list and map views (Rodeo), so switching views never resets state. This fits the URL-driven Zustand stores.
4. **Adopt** the AllTrails 2×2 facts block as B7: distance dominant, then time, stops, start → end.
5. **Adopt** Koto's dark lead-plus-two layout and GA&C's lead-tile collection as the story-dominant `MightsPlaceBento` variant for B1, B3, B8 and B9.
6. **Adopt** the Museum of the Human Web two-column split: editorial prose on one side, dated visit facts on the other.
7. **Adopt** DICE's dark event card with the date line in the accent colour, re-cut so one event dominates (B10), with the Rodeo-style "Saved from" source line.
8. **Adopt** capture dates on street-level and then/now media (Google Maps 360).
9. **Reject** KOBU `f5959421` as a bento model. It is three equal columns; keep only its mono kicker and headline arrow.
10. **Reject** carousels for featured content (GA&C, DICE trending, Airbnb "Similar"). Use a registered bento or a plain list.
11. **Reject** light grounds, glass sheets, emoji pins and price-first labels from every light reference. Structure only; palette from `packages/theme/tokens.ts`.
12. **Reject** photoreal 3D tiles and stock imagery as AR proof. B11 shows Sightline and the real AR frame with truthful status.

Gaps: no true AR-camera UI exists in the Mobbin results returned this session; B11 needs first-party captures. Hypelist, Beli `f85244e1`, GA&C `01d22c81`, KOBU `5dd15202` and Lightship `a5fa6838` are listed in pack, not re-opened.

## 6. Official content taxonomy

| Source | Current visit facts | Accessibility | Transit | Exhibitions/events | Historical context | Time-sensitive fields | Update expectations |
|---|---|---|---|---|---|---|---|
| apollotheater.org/history | Phone and a Locations link only. No hours, address or prices | Footer link only | None | Victoria-stage readings (Oct 26 sold out, Nov 6), Walk of Fame (permanent) | Origins 1914 to the 2024 Victoria expansion, a decade timeline from the 1930s to the 2000s, six dated highlights, Walk of Fame bios as PDFs | Event dates and times, sold-out flag, a "TODAY" widget stuck on "Tuesday 12, March 2024", a "Spring Benefit 2025" link | Uneven. 2026 season links sit next to a 2024 widget, and the timeline stops at the 2000s |
| apollotheater.org/visit-the-apollo | Two addresses (Historic Theater 253 W 125th; The Victoria, 233 W 125th, 3rd floor), box office, Ticketmaster, bag policy, seat maps, shop and gallery hours | Wheelchair seating, elevator, ADA restrooms, service dogs, access contact | Subway lines A/B/C/D, 1, 3, 4/5/6; Metro-North; parking garages | Gallery exhibit, events Oct 9 to Nov 14, tours (60 to 75 min), restaurant partners | Mission line only | Box office hours **conflict on the same page** (weekdays close at 6PM in one section, 5PM in another), "opens two hours prior", **renovation notice: "expected to reopen in late 2026"** | Seasonal edits plus stale leftovers (2025 benefit, "-old" links) |
| studiomuseum.org/exhibitions | Live "Open Until 6:00pm" banner, 144 W 125th St, tickets and membership links | Nav link only | None | 11 current shows tagged Exhibition, Installation or Artist-in-Residence, ending Jan 3 to Apr 1, 2027 or marked "Ongoing"; 2 upcoming (Feb to Sep 2027); past shows linked to an archive | 1968 archival photo, "To Be A Place" archives show | Daily hours banner, "Through [date]", current/upcoming/past grouping | Good structure. Each show has an end date, so it expires on its own schedule |
| studiomuseum.org/visitor-guide | Wed to Sun, Fri late to 9pm, closed Mon/Tue. Free Studio Sundays (ticketed). No prices | **Most detailed of the five**: wheelchairs, sensory kits, all-gender restrooms, floors labeled by sensory level, lactation and family rooms | Absent | Dated events Oct 7, 10 and 11, 2026, plus recurring Studio Sundays | Long-term works (Hammons, Ligon, Conwill, 1984 time capsules) | Live banner, end dates, per-floor "On View" | No last-updated stamp |
| nypl.org/locations/schomburg | **FAILED.** WebFetch returned an empty body twice (`/locations/schomburg` and `/about/locations/schomburg`). curl got HTTP 200 with 843 bytes, likely a JS or bot challenge | n/a | n/a | n/a | n/a | n/a | Retry in a real browser (Chrome MCP, incognito) before any Schomburg record ships |

**Findings**

- Current information and history refresh on different schedules. Each Apollo page carries a 1914-to-2024 history alongside a "TODAY" widget that has been stuck since March 2024 and box office hours that disagree within the page. History holds up over years. Hours and events go stale in weeks.
- Even the official source can be wrong or self-contradictory. Harlem Might can't assume "copied from the official site" means "correct". Each time-sensitive field needs its own source URL and `lastVerifiedAt`, and the UI should fall back to "Check hours with the Apollo" with a link when a value is past its freshness window.
- Institution-wide status overrides everything else on the page. The Apollo historic theater has a renovation notice ("reopen late 2026"), so a place record needs a `currentStatus` (open / temporarily closed / renovating / permanently closed) that takes precedence over hours.
- Studio Museum's end dates are the pattern to follow for events. Each item has its own `endsAt`, so it drops out of Today automatically and needs no manual cleanup.
- Accessibility depth varies widely. Studio Museum lists sensory floors and family rooms, Apollo covers ADA basics, and the history page has a footer link only. Store accessibility as structured facts with a source, never as a yes/no "accessible" flag.
- Transit appears on 1 of 4 pages fetched. HM can add it from MTA station data as derived content, labeled as HM's directions rather than the institution's.

## 7. Place Content Contract

Two sources exist today. `packages/payload/src/collections/Places.ts` (P) is the CMS schema. `packages/app/features/explore/explore.store.ts` (F) holds the `HarlemPlacePreview` fixtures, and the public place page `apps/web/app/(site)/places/[slug]/page.tsx` renders from F. That page shows name, street, `whyItMatters`, "Get directions" (Google Maps, only when `lngLat` exists), a static map, "Location pending verification" when there's no point, and Nearby. It shows no hours, status, source or freshness, so it can't overclaim. It also gives the user nothing to act on.

Freshness classes: **S** stable (years, edit on change), **R** reviewed (re-check every 90 to 180 days), **T** time-sensitive (has its own `lastVerifiedAt` and expiry; when stale, hide the value and link to the source).

| Field | User need | Class | Source required | Freshness rule (timestamp → stale behaviour) | Exists today? |
|---|---|---|---|---|---|
| Identity (name, slug, kind) | Know what this is and link to it | S | No (editorial) | none | **Yes**: P `name`, `slug`, `kind` (business/culture/historic/outdoors/public-art/community); F `id`, `name` |
| Category | Filter the map ("Music near me") | S | No | none | **Split**: P `primaryCategory` is free text; F `category` is a 6-value union (Food/Music/Culture/Books/History/Outdoors). Pick one vocabulary |
| Description | Decide in 5 seconds whether to care | R | No | review with `dataQuality.lastReviewedAt` | **Yes**: P `summary`; F `shortDescription` |
| Why it matters | The reason HM exists over a plain map: the block's story | S | **Yes, for factual claims** (dates, names, firsts) | Cite on claim; no expiry | **F only**: `whyItMatters`. No P field. Two F entries say "Harlem Mights" (see §12) |
| Address / entrance | Find the door, not the parcel centroid | R | Yes | `lastVerifiedAt`; stale → show street only, no "entrance" claim | **Partial**: P `address.formatted/neighborhood/postalCode`; F `street`. **No entrance field anywhere**, although web-vite `/ar` copy promises "the real entrance". Apollo alone has two entrances (253 and 233 W 125th) |
| Coordinates + accuracy | Pin and route correctly; be honest when unsure | R | Yes (OSM id or survey) | `accuracy`: `verified` / `approx` / `pending`; pending → "Location pending verification" (already shipped) | **Partial**: P `location` (point) with no accuracy; F `lngLat` + `osm` (Nominatim, fetched 2026-10-03), absent = pending. **Add `locationAccuracy` + `entrancePoint`** |
| Hours | "Can I go now?" | **T** | **Yes, required** | `hoursSourceUrl` + `hoursVerifiedAt`; stale after 30 days → hide hours, show "Check hours with {venue}" + link. Never compute open-now from unverified hours | **No**, in both P and F. Apollo's own page contradicts itself (6PM vs 5PM), so store the source |
| Current status | Avoid a trip to a closed door | **T** | Yes | `statusVerifiedAt` + optional `statusNote`/`reopensExpected`; status overrides hours; stale → drop to `unknown`, show no badge | **Partial**: P `lifecycle` (open/temporarily_closed/seasonal/permanently_closed/historical_only/unknown). No timestamp, note or source. Apollo's renovation notice needs `statusNote` |
| Accessibility | Plan the visit around a body, a stroller, a sensory need | R/T | **Yes, required** | `accessibilitySourceUrl` + `verifiedAt`; structured facts (step-free entry, elevator, restroom, sensory, service animals) or nothing. Never a boolean "accessible" | **No** |
| Transit | Get there without a car | S/R | Derived (MTA GTFS) is OK if labeled as HM's | Re-derive on service change; label "Nearest stations (Harlem Might)" | **No** |
| Website / tickets | Act: book, buy, check | R | It is the source | Link check per review cycle; never state ticket availability or price | **Partial**: P `website`, `phone`; no `ticketsUrl`. F has none |
| Menu | Decide where to eat | **T** | **Yes** | Already modelled: `menus[].sourceUrl`, `lastVerifiedAt`, `effectiveFrom/Until`, `active`, `allowedOrigins`. Never show prices HM hasn't verified | **Yes, in P** (best-specified field in the schema). F has only `menuAvailable` |
| Events | "What's on tonight" (Today) | **T** | **Yes** | Per-event `startsAt`/`endsAt` + `sourceUrl`; auto-expire at `endsAt` (the Studio Museum pattern); no `endsAt` → doesn't ship | **No** collection |
| Stories | Context behind the corner | S | Yes (citations) | Cite; editorial review | **Partial**: P `Pages` (title, slug, summary, body, published). **No place relation** |
| Archival media | Then/now on the block | S | **Yes + rights** | Credit, license and rights-holder on every item | **No** (P `Media` exists; no archival rights fields seen) |
| Nearby | Turn one stop into a walk | Derived | No | Recompute from verified points only | **Yes (F)**: `placesNear()` haversine over places with `lngLat`; pending points are excluded |
| AR anchor | Put the label on the right facade | R | Yes (survey or entrance point) | `anchorVerifiedAt`; an `arCandidate` without a verified anchor must say "preview" | **Flag only**: F `arCandidate` on most fixtures; no anchor geometry anywhere |
| Sources | Trust and correction | per field | — | Field-level `sourceUrl` on T fields + a record-level `sources[]` | **Partial**: only `menus[].sourceUrl`; F `osm` for location |
| Freshness | Know how old a fact is | — | — | Show "Checked {date}" next to T fields; record-level `dataQuality.state` drives editorial queue | **Partial**: P `dataQuality.state` (unverified/partially_verified/verified/needs_review) + `lastReviewedAt`. Record-level only; T fields need their own stamps |
| Media rights | Don't publish what HM can't use | S | Yes | `credit`, `license`, `rightsHolder`, `allowedUses` | **Partial**: menus `pdf` note "when rights/persistence allow"; nothing general |

**Gaps to close, in order:** (1) `hours` + `currentStatus` timestamps and sources (or keep both hidden, as today); (2) `locationAccuracy` + `entrancePoint` before any "real entrance" copy ships; (3) structured accessibility with a source; (4) an Events collection with required `endsAt`; (5) `whyItMatters` + a Pages↔Places relation in Payload so F stops being the source of truth; (6) a single category vocabulary.

**Never invent:** hours, open-now, ratings, prices, ticket availability, accessibility facts, events, closures, entrances, business status. When a field is missing or stale, the UI shows nothing or a source link. It never shows a guess.

## 8. Visual strengths

- **Type carries the hero.** Mona Sans condensed at `marquee` size (`tokens.ts` `marquee: 8rem / 0.9`) on "See the block. Know the story." is the most specific element on the site (`premium-p1/home@1440.png`, top). Leading and tracking are tight, and the lockup has no eyebrow, accent word or gradient.
- **Contrast discipline is real.** Text, muted text, primary and on-primary all pass AA with room to spare (section 17 table). Of 9 routes, only Explore has any serious axe violation.
- **Corner-cut buttons and the notch card are owned geometry.** `cornerCut` and `notch` (`packages/ui/mights/geometry.ts`) and the four-corner focus bracket (`apps/web/app/globals.css:103-136`) give the kit a silhouette that reads as Harlem Might rather than a stock kit. The same bracket serves as focus ring, lens frame and AR frame, so it means "this is the thing in view".
- **Honest empty states.** "No walks published yet / The first routes are being researched now" and "Not in the stores yet" tell the truth and give a next action. Placeholder walks were not invented.
- **URL-owned Explore state.** View, query, category and place live in the URL (`ExploreWorkspace.tsx:38-94`), so Back closes a selection and a link reproduces the view. Under reduced motion, map motion falls back to `jumpTo` (`ExploreMap.tsx:62`).
- **Reduced motion is respected across the board.** `useHomeMotion` binds nothing under `reduce` (`apps/web/components/site/motion.ts:233`). View transitions drop to 0s (`globals.css:95-99`). The beam becomes a static gold rail (`globals.css:184-190`). The `-rm` captures show every section present at rest.
- **Focus is visible everywhere.** The `.mights-focus:focus-visible::after` bracket shows on every control tested (`premium-p1/home@1280-focus-openmap.png`, `home@1280-focus-nav.png`). Map markers get a 2px gold outline (`globals.css:216-219`).

## 9. Visual weaknesses

### Audit list (prompt 01 §5)

| Item | Finding | Evidence |
|---|---|---|
| Homepage hero | The type is strong. The right half is a 58vw dark-v11 raster with a lens inside it, so a map sits inside a map. Below the H1 the only content is "Open the map". | `premium-p1/home@1440.png`; `ProductHome.tsx:75-136` |
| Map-on-map lens | At zoom 18.4 / pitch 58 the lens shows an empty dark rectangle and one pin. The Apollo marquee, Harlem's most recognisable facade, is absent. The lens frames nothing. | `ProductHome.tsx:109-120`; hero crop |
| Typography | Display is good. Body runs at one size and one weight across all card copy. Newsreader is configured (`tokens.ts:150`) but no product route uses it, so the long-form voice never appears. Explore uses raw sizes (`text-[13px]`, `[14px]`, `[15px]`, `[17px]`) instead of the type scale. | `ExploreWorkspace.tsx:130,151,168,169` |
| Place bento | Six identical map-top cards at 7/5, 5/7, 7/5. No module dominates. On 390 it becomes six cards of the same height in a column, about 2,400px of grey map. Pins sit on Mapbox's own POI labels ("A[pin]ollo Theater", "Marcu[pin]Garvey"). | `MightsPlaceBento.tsx:16-41`; `crops/home@1440-2.png` |
| Start with a block | The copy is the best on the site ("the history, the hours, the way in"). The map hard-crops Sylvia's pin at the right edge. The three ghost buttons carry names only, with no "why". | `ProductHome.tsx:139-182` |
| AR handoff | A third static map with one pin, pitch 60. Nothing shows the AR claim (a label on the building). The scrubbed reveal reverses on scroll-up, so a full-page capture with motion shows an 800px blank band. Users see it in view (`premium-p1/home@1280-ar-inview.png`). | `motion.ts:277-281`; `ProductHome.tsx:198-233` |
| Closing line | "Harlem is not a list of landmarks." It follows a list of six landmarks, so the line contradicts the page above it. | `ProductHome.tsx:237` |
| Nav / dock / footer | The navbar's filled "Get the app" CTA appears on every page and leads to "Not in the stores yet". "Preview AR" is a button with no current state on `/ar`. The dock has a sensible five items. The footer link rows are 23px tall (2.5.8 passes on spacing, see §17). | `MightsNavbar.tsx:69-73`; `MightsFooter.tsx` |
| Place detail | H1, one generic sentence, a "why" paragraph, a far-zoom map with 6–8px street labels, then "Nearby" with no distances. There are no hours, photos, sources or story. | `premium-p1/place-apollo@1280.png` |
| Explore list/map/inspector | See §10. | |
| Mobile selected sheet | Covers 60% of the viewport. At 768 half of it is empty (`premium-p1/explore-apollo@768.png`). It is not a dialog. | `ExploreWorkspace.tsx:245` |
| Map/list toggle | Clear and stateful (`aria-pressed`). It sits top-right, out of thumb reach on a phone. | `ExploreWorkspace.tsx:251-266` |
| Category chips | Readable. Unselected chips are `surface-raised` on `surface` (1.06:1), so the chip shape is invisible and only the label shows. "Books" holds just the Schomburg. | `ExploreWorkspace.tsx:126-128` |
| Empty states | Honest copy (strength) but structurally identical on three routes, and they borrow the same map cards. | walks/stories/today@1280 |
| Dark Mapbox style | See H5. | |
| Gold/cobalt/red | Gold does everything: CTAs, rails, pins, markers, focus, selected chip. Cobalt and red never render (see §1). | `MightsAccentFrame.tsx:11` |
| Notches / corner cuts | Every card has two notches (top and bottom) plus a corner cut. Repeated six times per viewport, the notch becomes texture, not signal. | home@1440 bento |
| Beam effect | The conic beam loops forever on hover/focus (`globals.css:166-182`). Reduced motion is handled. With motion on it is the only animation that never stops; keep it to the dominant card. | |
| Imagery | 0 photographs on product routes (see §13). | |
| Motion | Restrained and owned (Kinetrell/GSAP). The hero parallax scrub suits it. The sidewalk scrub needs a one-way reveal. | `motion.ts:251-287` |
| Token discipline | 0 raw hex or inline `style` in `apps/web/app` and `apps/web/components`. 16 arbitrary utilities (`text-[Npx]`, `h-[calc…]`, `[font-stretch:75%]`) bypass the scale. | grep in §17 notes |
| Mights discipline | Home and the place routes compose Mights. Explore hand-rolls chips, list rows and the sheet from `@acme/ui/tw` primitives instead of `MightsButton`/`MightsNotchCard`. | `ExploreWorkspace.tsx:119-217` |

### The 12 hypotheses

1. **Maps as imagery, real Harlem under-used: CONFIRMED.** 10 map rasters and 0 photos on home. 25+ rasters across the 9 routes. `MightsFigure` exists and is unused on product routes.
2. **The lens proves the interface but doesn't sell Harlem: CONFIRMED.** The lens is a framed empty block (see the audit row above).
3. **Map utility vs editorial value unclear: PARTLY CONFIRMED.** The lead names "history", and "Start with a block" states the value, but no historical fact, date, person or source appears anywhere on home. The editorial layer is asserted, never shown.
4. **`MightsPlaceBento` repetitive: CONFIRMED.** One variant, five routes, no dominant module. The fix is registered variants (B1 dominant-media, B7 compact strip, B10 event-dominant) inside `MightsPlaceBento`, not new components.
5. **`dark-v11` within the dark brand: CONFIRMED as a mismatch, not a reason to go light.** dark-v11 is cool grey (land ≈ #1e1e1e, roads ≈ #2a2a2a), so panels sit as neutral slabs on warm black. Small labels measure about 3.9:1 (estimate from sampled pixels). At pitched static views (place map, `/ar`) street names render at 6–8px. Outdoors, low-contrast grey labels are the first thing lost on a bright day; gold markers (≈9:1) survive. Fix: a custom warm-dark Studio style whose colors come from the tokens (land `surface-sunken`, roads `border`/`border-strong`, labels `text-muted`, water dark `verdigris`, POI labels off under our pins). Expose one `mapStyle` token and use it in both `MightsMapImage.tsx:8` and `ExploreMap.tsx:80`. Keep pitch ≤30 on informational maps.
6. **Inspector disconnected from list + marker: PARTLY CONFIRMED.** The desktop inspector floats top-right, 440px away from the list. The selected list row is `bg-surface-raised` on `bg-surface` (1.06:1), almost invisible. The marker grows 12→18px and turns cream-outlined, which works. Focus never moves to the inspector.
7. **Mobile sheet needs focus semantics: CONFIRMED.** No `role="dialog"`, no focus move, no Escape. Close is the 15th Tab stop and closing drops focus to body.
8. **Place pages map-heavy, story/photo-light: CONFIRMED.** One sentence of "why", no media, no hours, no sources, no story link.
9. **Route-stub sameness: CONFIRMED.** Walks/Stories/Today share one template, and Walks and Today show identical cards.
10. **AR described, not shown: CONFIRMED.**
11. **Brand naming: PASS on public copy, FAIL in docs/comments.** Rendered text on all 9 routes has 0 instances of "Harlem Mights" (`capture.json` `hmCount`). Source still says it at `tokens.ts:17`, `globals.css:103` and `docs/IMAGE_POLICY.md:1` ("commissioned Harlem Mights photography").
12. **Tokens carry a dark-first assumption: CONFIRMED, and it matches the standing decision.** `tokens.ts:4` says "The public site renders dark". The contradiction is with pack contract §"Light / dark direction". Amend the contract rather than the tokens. One real token issue: `primary` flips hue between modes (light `#1F4FE0` cobalt, dark `#F8C626` gold), so `tone="cobalt"` names a color that only exists in light mode. Add a mode-stable `cobalt` semantic token if cobalt should mean transit on the dark site.

## 10. Explore critique

Captures: `explore@{390,768,1280,1440}.png`, `explore-apollo@*.png`, `explore@390-list.png`, `explore@390-noresults.png`, `explore@*-kb-select.png`.

**Desktop (≥1024): list | map | floating inspector**
- The list pane (400px) is the strongest part: search, chips and rows with category and street. "location pending" is labelled honestly. 8 rows, 6 markers. National Black Theatre and Strivers' Row have no coordinates, so they appear in the list and not on the map. That parity gap is correct behaviour, but the map never says two places are missing from it.
- The selected row is barely visible (1.06:1 fill). The selected diamond turns gold (`ExploreWorkspace.tsx:166`), and that is the only cue. Add a 2px gold left rail on the selected row (a `rule-rail`/`primary` token) and `aria-current="true"` (already present).
- The inspector floats top-right over the map with a notched rail, 440px wide. It sits far from the row that opened it and the eye has to jump. Docking it as a second column beside the list, or anchoring it next to the marker, would bind the three together. `rightInset={460}` already pads `flyTo` (`ExploreMap.tsx:57-60`), so the map side works.
- Inspector copy repeats the list subtitle and adds a generic line ("A Harlem performing-arts landmark with a global cultural reach"). It has no hours, no next event and no story link, so it reads as a teaser for the place page rather than a quick answer.
- The markers are 28×28 gold diamonds with 12px visible glyphs. That is legible, but they sit on dark-v11's own POI labels ("[◆]Theater").

**Mobile (<1024): map/list toggle + sheet**
- The default view is the map, with no search visible. Search is one tap away via List. For a sidewalk user, a search field on the map view would save a step.
- The toggle is clear and stateful but sits top-right. Thumb reach favours bottom placement just above the dock.
- The sheet is pinned `top-[40%]` to `bottom-3` (`ExploreWorkspace.tsx:245`). At 390 it fits the content. At 768 it leaves about 250px of empty sheet (`explore-apollo@768.png`). Size it to content with a max height.
- Sheet semantics: no `role="dialog"` or `aria-modal`, focus does not move on selection, Escape does nothing, and Close comes after 6 markers and 3 map controls in Tab order (15 Tab stops). Closing calls `router.back()` and focus falls to `<body>` (measured). Fix: render the sheet as the existing `dialog.mights-sheet` (`globals.css:139`), move focus to its heading on open, close on Escape, and return focus to the marker or row that opened it.

**Selection and Back**
- Selecting pushes `?place=`, and Back or Close steps back (`ExploreWorkspace.tsx:80-89`). Correct. Search typing uses `replaceState` with a 250ms debounce. Correct.

**Chips:** `aria-pressed` toggle buttons in a labelled group. 36px tall, passes 2.5.8. Unselected chip fill is invisible (1.06:1), so give chips a `border` hairline.

**No results:** "No places match "zzzz"." plus "Clear search and filters". Good recovery (H9). The result count is not announced. Add a polite live region ("3 places") on filter change (4.1.3).

**Drag-only (2.5.7):** the map pans by drag, but every map outcome (choosing a place) is reachable through the list and marker buttons, and zoom has ± buttons. Passes.

## 10a. Scored critique (design-critique)

Ten dimensions, 0–10. H = hierarchy, Ty = typography, Co = color/contrast, Sp = spacing rhythm, VR = visual rhythm/bento, Im = imagery, Mo = motion, IC = interaction clarity, Br = brand specificity, A11y = accessibility. Scores reflect production-build captures at 390 and 1280/1440.

| Screen | H | Ty | Co | Sp | VR | Im | Mo | IC | Br | A11y | Lowest-scoring reason |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Home | 7 | 8 | 7 | 6 | 4 | 3 | 7 | 7 | 6 | 7 | 10 maps, 0 photos; six identical cards with no lead; AR chapter is a third map |
| Explore desktop | 7 | 6 | 6 | 7 | n/a | 5 | 8 | 6 | 6 | 4 | inspector detached from list; markers exposed as img; no `<main>` |
| Explore mobile | 6 | 6 | 6 | 6 | n/a | 5 | 8 | 5 | 6 | 3 | sheet isn't a dialog; focus lost on close; search hidden in map view |
| Place detail | 6 | 7 | 6 | 6 | 4 | 2 | 7 | 7 | 4 | 8 | one generic sentence + far-zoom map; Nearby lacks distance |
| Walks | 7 | 7 | 7 | 7 | 3 | 2 | 7 | 7 | 4 | 8 | same three map cards as Today; template sameness |
| Stories | 7 | 6 | 7 | 7 | 3 | 2 | 7 | 7 | 4 | 8 | a stories page with no Newsreader, no story |
| Today | 7 | 8 | 7 | 7 | 3 | 2 | 7 | 7 | 5 | 8 | date H1 is good; "worth the trip today" cards aren't time-aware |
| AR | 6 | 7 | 6 | 7 | n/a | 2 | 7 | 7 | 5 | 8 | shows a tilted map, never a label on a building |
| Download | 7 | 7 | 7 | 5 | n/a | 1 | 7 | 6 | 4 | 8 | half-screen empty; the navbar CTA leads here to "not in stores" |

Every screen scores under 8 somewhere. The fixes are in §9, §10, §13 and the memo. Re-score after Phase 2+ changes.

**Heuristics (UX review) flagged:** H1 (no result-count announcement; the map hides the two unmapped places without saying so), H3 (sheet close loses focus; "Get the app" leads to a dead end), H4 (one card shape for places, walks-to-be and events-to-be), H6 (inspector repeats data already on the row and omits hours/next step), H8 (repeated notches/maps compete; dark-v11 POI labels compete with our pins).

## 11. IA — current route map vs proposed

### Current (source, `cc5d386`)

| Route | File | State |
|---|---|---|
| `/` | `app/(site)/page.tsx` → `ProductHome.tsx` | Built |
| `/explore` (`?view`, `?q`, `?category`, `?place`) | `explore/page.tsx` → `ExploreWorkspace.tsx` | Built; selection and filters now live in the URL via `useSearchParams` + `router.replace/push` (`ExploreWorkspace.tsx:42,79,82`), which fixes the audit's 🔴 on state and Back (`IA_AUDIT.md:108-115`) |
| `/places/[slug]` | `places/[slug]/page.tsx` | Built, `generateStaticParams` (`:20`), `notFound` on unknown slug |
| `/walks` | `walks/page.tsx` | Empty state |
| `/stories` | `stories/page.tsx` | Empty state |
| `/today` | `today/page.tsx` | Empty state, title carries today's date (`:24`) |
| `/ar` | `ar/page.tsx` | Built; explains app-only AR |
| `/download` | `download/page.tsx` | "Not in the stores yet" |
| `/about`, `/press` | `about/page.tsx`, `press/page.tsx` | Built |
| `/legal/[doc]` | `legal/[doc]/page.tsx` | privacy, terms, accessibility |
| 404 | `app/global-not-found.tsx`, `(site)/not-found.tsx` | Built (was 🔴 in `IA_AUDIT.md:87`) |
| `sitemap.ts`, `robots.ts` | `app/` | Built; sitemap lists the 12 top-level routes (`sitemap.ts:9-20`) |

### `routes.ts` builders with no page (404 if ever linked)

| Builder | Href | Page exists? | Callers today |
|---|---|---|---|
| `walk` | `/walks/[slug]` (`routes.ts:19`) | No | none |
| `walkStop` | `/walks/[slug]/stops/[n]` (`:20`) | No | none |
| `story` | `/stories/[slug]` (`:22`) | No | none |
| `today(date)` | `/today/[date]` (`:23`) | No; `/today` only | `today()` without date only (`sitemap.ts:13`, `MightsFooter.tsx:11`, `routes.ts:38`) |
| `event` | `/events/[slug]` (`:24`) | No | none |

`git grep` finds no call site for `routes.walk(`, `routes.walkStop(`, `routes.story(` or `routes.event(`, so nothing 404s in production today. The risk is the first content PR that calls one before the page exists. `primaryNav` already maps `/events/*` to Today (`routes.ts:38`), which presumes an event route.

### Redirects (`apps/web/next.config.ts:56-71`)

`/places`→`/explore`, `/tours`→`/walks`, `/events`→`/today`, `/map` and `/explore/map`→`/explore?view=map`, `/app`→`/download`, `/schedule`→`/today`, `/spatial`→`/ar`, `/notifications`→`/`, `/profile`→`/`, `/settings`→`/` (all permanent), `/legal`→`/legal/privacy` (temporary). The last three app-only routes going to `/` close the audit's fake signed-in user finding (`IA_AUDIT.md:118-119`). Note `/events`→`/today` is permanent (308); if `/events/[slug]` is ever added, the bare `/events` redirect stays valid because it only matches the exact path.

### Proposed

| Route | Decision | Why |
|---|---|---|
| `/walks/[slug]` | **Add** with the first published walk | The `walk` builder exists; walks are in the home lead (`ProductHome.tsx:82`). Page shows route facts strip, ordered stops linking to `/places/[slug]`, and a start-here map. |
| `/walks/[slug]/stops/[n]` | **Strike; remove `walkStop` from `routes.ts`** | A stop is a place. Deep-linking a stop duplicates `/places/[slug]` and splits its canonical URL. Use `/walks/[slug]#stop-n` anchors for in-walk position. |
| `/stories/[slug]` | **Add** with the first published story | Needs a sources block and links to every place it is attached to; each place page links back. This makes cross-type search on Explore pass the audit's T3 (`IA_AUDIT.md:191`). |
| Events on `/today` | **Inline on `/today`; no `/events/[slug]` now** | With zero events (`today/page.tsx:25`), a detail route adds an empty template. Most Harlem events already have a canonical page at the venue (Apollo, NBT); an event row on `/today` links out to it and to the venue's `/places/[slug]`. Revisit `/events/[slug]` only when Harlem Might writes its own editorial for an event or needs a shareable URL for one it hosts. Until then delete `routes.event` and the `/^\/events/` match in `primaryNav`. |
| `/today/[yyyy-mm-dd]` | **Defer** | The audit asked for a date control writing this URL (`IA_AUDIT.md:188`), but planning ahead needs event data first. Keep `today(date)` out of callers until listings exist. |
| B12 Profile/Saved | **Struck** | No route, no account model on web; `/profile` already redirects home (`next.config.ts:68`). Saving lives in the app if anywhere. |
| Report a problem | **Add as an action, not a route** | The audit's T5 has no home (`IA_AUDIT.md:190`). A "Report a problem" link on each place (and later story/walk) page, pre-filled with the entity id, to a mailto or form. No `/contact` page needed. |
| Preview AR on mobile | **Keep secondary nav, add an inline entry on place pages where AR applies** | Audit flagged it hidden behind More on mobile (`IA_AUDIT.md:189`). Only useful once `arCandidate` is selective (all 8 are true today). |

## 12. Copy ladder

### Current copy (apps/web, read 2026-10-07)

| Surface | Current string |
|---|---|
| Home hero (`ProductHome.tsx`) | "See the block. Know the story." / "Places, walks and the history attached to each corner of Harlem, on one map." / CTA "Open the map" |
| Home ch.2 | "Start with a block." / "Three doors on West 125th Street and Malcolm X Boulevard. Pick one and the map keeps everything attached to it: the history, the hours, the way in." |
| Home bento | "Places on the map" / "See every place" |
| Home ch.3 | "From the map to the sidewalk." / "In the app, the same place record follows you outside. Hold up your phone on the block and the label sits on the building it belongs to." |
| Home close | "Harlem is not a list of landmarks." / "Open the map" |
| Place detail (`places/[slug]`) | No intro. `whyItMatters` from fixtures, "Get directions", "Back to the map", "Location pending verification", "Nearby" |
| Walks | Lead "Take the long way. Walks connect places into a story without turning the neighborhood into a checklist." / empty "No walks published yet … The first routes are being researched now." |
| Stories | Lead "The history behind a block, kept on the block where it happened." / empty "No stories published yet … Each story will be sourced and attached to a place." |
| Today | Title "Today in Harlem, {weekday} {day} {month}" / empty "No events listed yet … Event listings are on their way. In the meantime, these places are worth the trip today." |
| AR | Title "Preview AR" / lead "Hold up your phone on the block and each label sits on the building it belongs to." / "…the label you see in the street is the place you opened on the map, with its history and hours attached." / "Nothing here asks for your camera." |
| Download | "Get the app" / "Not in the stores yet" / "The app is in testing and is not listed on the App Store or Google Play yet. The map on this site works now." |

**Copy that promises data HM doesn't have (fix before the redesign ships):**
1. Home ch.2 says the map keeps "the hours, the way in". No hours field exists in Payload or the fixtures, and there's no entrance field (§7).
2. AR body says "with its history and hours attached". Same gap.
3. Today says "these places are worth the trip today". That's a current-state claim with no hours or status behind it. "Today" should only mean events with dates.
4. The AR lead ("each label sits on the building it belongs to") is written in present tense about a feature with no anchor geometry (§7 AR anchor) and no device verification. It needs a status word (see the table below).

**Banned-word pass.** `grep -rniE "hidden gem|vibrant|authentic harlem|discover the soul|ultimate guide|ai-powered|ai powered|immersive experience|reimagin"` over `apps/web`, `apps/web-vite/src`, `apps/mobile/src`, `packages/app` and `packages/ui` (.ts/.tsx, node_modules and .next excluded) returned **0 hits**. The current copy is clean against the list. Its problems are the overclaims above.

**"Harlem Mights" (plural) still in public strings.** The singular "Harlem Might" is decided. apps/web has 0 files with the plural. Other files that still use it:
- `packages/app/features/explore/explore.store.ts:58` "Harlem Mights can connect a meal here…" (Red Rooster `whyItMatters`). **Rendered on the apps/web place page.**
- `packages/app/features/explore/explore.store.ts:90` "It gives Harlem Mights a natural bridge…" (Schomburg `whyItMatters`). **Rendered on the apps/web place page.**
- `apps/web-vite/src`: 12 files, including page titles "— Harlem Mights" (walks, today, ar, stories, profile, explore, about, pages, admin), `not-found.tsx:13`, `ar.tsx:13` and `explore.tsx:13,17` intros.
- `apps/mobile/src/menu-viewer/MenuViewerScreen.tsx:41` "Getting the latest menu record from Harlem Mights…" (user-facing).
- Internal only: `packages/payload/.../Places.ts:105` admin description, `packages/theme/tokens.ts:17` comment, `packages/ui/*.stories.tsx`, 9 docs files.

Separately, the fixture `whyItMatters` lines describe the product ("A place detail can pair…", "This is where entrance-aware navigation matters…"). They don't say why the place matters, and they render as public place copy. They need rewriting as place facts with sources.

### Message ladder

1. **Product promise.** A map of Harlem where each place carries its history, its sources and what's on there now.
2. **What HM adds to a normal map.** A normal map knows the address and maybe the hours. HM adds who built it, what happened on that corner, what changed, and where each fact came from, with a date on anything that can go stale.
3. **Why the block.** Harlem's history happened at street level: 125th Street, Malcolm X Boulevard, Strivers' Row. A block is small enough to walk in ten minutes and dense enough to fill an afternoon. It's the unit the story comes in.
4. **Why AR.** On the sidewalk, the question is "which building?" AR answers it by putting the place name and its story on the facade in front of you instead of a pin on a screen. Present it as preview or in testing until it passes the matrix bar.
5. **Why stories and walks.** Stories explain a corner. Walks connect corners in an order that makes sense on foot. Neither is a checklist, and there are no badges for finishing.
6. **Why Today.** History doesn't expire. Events do. Today lists only what has a date and a source, and items drop off when they end.

### String options (★ = recommended)

**Hero support line** (under "See the block. Know the story.", which I'm keeping since nothing argues against it: it's short, concrete and uses the product's own nouns)
- A. Places, walks and the history attached to each corner of Harlem, on one map. *(current)*
- ★ B. Every place on the map comes with its history, its sources and what's on there now.
- C. A map of Harlem that remembers what happened on each corner.
- D. Harlem's places, stories and walks, kept on the blocks where they happened.

**"Start with a block" body**
- A. *(current, overclaims hours and entrance; don't ship as is)*
- ★ B. Three doors on West 125th Street and Malcolm X Boulevard. Pick one and see what happened there, who it's connected to and where each fact comes from.
- C. Start on West 125th Street. The Apollo, the Studio Museum and Sylvia's are a few minutes' walk apart, and each one opens onto the rest of the block.
- D. One block holds more than a map shows. Pick a door and start there.

**"What the map doesn't know" section title**
- ★ A. What a pin can't tell you
- B. What the map doesn't know
- C. Then and now, on the same corner
- D. The story behind the address
- E. Where each fact comes from

**Place-detail intro** (one line above `whyItMatters`; template, values only from verified fields)
- ★ A. {Name}, {street}. Why it matters, what's nearby and where our facts come from.
- B. On this block: {Name}.
- C. {Name} · {street} · Checked {lastReviewedAt}
- D. No intro. Lead with a sourced `whyItMatters` and a freshness line ("Location verified {date}" / "Location pending verification").

**Walks intro**
- A. Take the long way. Walks connect places into a story without turning the neighborhood into a checklist. *(current, keep)*
- ★ B. Routes on foot that connect places in an order that makes sense. Each stop tells you why it's on the route.
- C. Walk a few blocks with the history next to you.
- D. Take the long way between places.

**Stories intro**
- A. The history behind a block, kept on the block where it happened. *(current)*
- ★ B. The history behind a block, kept on the block where it happened. Every story names its sources.
- C. What happened here, who was involved and how we know.
- D. Stories tied to the places where they happened.

**Today intro**
- ★ A. Events in Harlem with a date and a source. When an event ends, it comes off the list.
- B. What's on in Harlem today, from the venues' own listings.
- C. Today in Harlem: dated events only.
- Empty state (replaces "worth the trip today"): ★ "No events listed for today. Venue listings appear here once we've checked them. Start from a place on the map instead."

**AR intro** (lead; status word required)
- A. Hold up your phone on the block and each label sits on the building it belongs to. *(current; present tense, no status)*
- ★ B. In testing: hold up your phone on the block and the place name sits on its building, not on a pin.
- C. Preview: the same place you opened on the map, labeled on the street in front of you.
- D. AR in the app puts the place name on the facade. It's in testing, and only the map works on the web.
- Body fix: replace "with its history and hours attached" with "with its history attached".

**Conversion CTA**
- ★ A. Open the map *(current; it works on the web today, so keep it as primary)*
- B. Start on 125th Street
- C. See the block
- D. Get the app *(secondary only, while the download page says "not in the stores yet")*

### Status language for spatial claims

`docs/META_VR_GLASSES.md` defines five words. `docs/XR-PLATFORM-MATRIX.md` uses different labels ("integrated", "adapter foundation merged", "integration foundation merged", "integrated build + Store targeting; physical-device verification still required"). Public copy should use the five words only, and the matrix labels should be mapped onto them:

| Word | Meaning (from META_VR_GLASSES.md) | Matrix label it covers | Public copy pattern |
|---|---|---|---|
| preview | code on an unmerged branch or behind a flag | — | "Preview: …", no promises about when |
| concept | design only, no code | (IWSDK, per glasses doc §155) | Don't mention publicly, or "We're exploring…" |
| integration path | merged and builds, nothing run on target | "integrated", "adapter/integration foundation merged" | "Planned for {device}". Never "works on" |
| in testing | runs on a simulator or a stand-in device | Quest floor/controller work | "In testing on {device}" |
| verified | passed the 8-point matrix bar on real hardware | none today | Only then: present tense, "Works on {device}" |

Rules: (1) Nothing is verified today. META_VR_GLASSES.md says so, and no matrix row records the 8 points, so no public string may say AR or glasses "work". (2) Phone AR copy (home ch.3, the /ar page) gets "in testing" to match the download page's "The app is in testing". (3) Don't name Meta VR Glasses, Specs or Vision Pro on the public site until they reach at least "in testing". (4) The matrix's "integrated" reads like a shipping claim. Rename it "integration path" in the doc so internal and public vocabularies match.

## 13. Image/media strategy

**Current state.** Every image across the 9 audited routes is a Mapbox static raster served from `mapbox/dark-v11` (`MightsMapImage.tsx:8,44-58`). `capture.json` → `meta.imgs` lists only `api.mapbox.com/styles/v1/mapbox/dark-v11/static/…` sources plus the wordmark. Alt text exists and is specific ("Map of West 125th Street in Harlem, from the Apollo Theater to the Studio Museum"), so 1.1.1 passes. `MightsFigure` (`packages/ui/mights/MightsFigure.tsx`) is used on About, Press and Legal only (`apps/web/app/(site)/{about,press,legal/[doc]}/page.tsx`).

**Against `docs/IMAGE_POLICY.md`.**
- The policy allows commissioned, rights-cleared venue, Wikimedia Commons, and NYPL/LoC/Met open media for place and history records, with creator, source, license, date and credit kept. None of these sources is used on product routes. There is no violation, because nothing was hotlinked or stock, but the policy's main path has no implementation on the routes that need it.
- The footer's "Photographs credited on each page" (`MightsFooter.tsx:62`) is false on product routes today. Remove it, or make it true once figures ship.
- The policy title and its source tier say "Harlem Mights". Rename to "Harlem Might".

**Recommended allocation (no new primitives):**
| Surface | Medium | Primitive |
|---|---|---|
| Home hero | Keep the type-led left half. Replace the lens contents with one rights-cleared or commissioned photo of the Apollo facade at night; keep the map as the outer field | `MightsAccentFrame` + `MightsFigure` |
| Home bento B1 | Dominant module = photograph (Schomburg reading room or Apollo marquee, PD/CC from NYPL/Wikimedia); supporting modules stay map-thumb or text-only | `MightsPlaceBento` dominant-media variant, `MightsFigure` |
| Place detail | Then/Now pair (archive + current), credit line under each; map moves below the fold at street zoom ≥17 with pitch 0 | `MightsFigure`, `MightsMapImage` |
| Stories index | Archive figure per story; Newsreader excerpt | `MightsFigure`, `MightsProse` |
| AR / sidewalk chapter | A labelled concept frame (policy permits generated imagery if marked "concept"): phone over the Apollo facade with one anchored label | `MightsFigure` with "Concept" caption |
| Explore, Walks route maps | Maps stay; this is where the map is the content | `MightsMapImage`, `ExploreMap` |

Rule of thumb: maps where location answers the question, photographs where the question is "why go". At most one map raster per module group.

## 14. Bento policy

### Where `MightsPlaceBento` runs today

`grep -rn MightsPlaceBento apps/web packages` finds 6 call sites. None of them uses the register's intended data. Every bento is a strip of map cards built from `explore.store.ts:MAPPED_PLACES`/`placesNear`.

| Call site | Places passed | Register entry it occupies | Verdict |
|---|---|---|---|
| `apps/web/components/site/ProductHome.tsx:193` ("Places on the map") | `MAPPED`, all 6 mapped places, so `SPANS` 7/5/5/7/7/5 | B1 | Matches B1 in shape. It has no dominant item: spans alternate 7/5 and every module is the same map card (`MightsPlaceBento.tsx:16,31-47`). It is also 6 Mapbox static rasters of about 330 KB each on mobile (observed, `mobile-home-2.json`). |
| `apps/web/app/(site)/places/[slug]/page.tsx:105` ("Nearby") | `placesNear(place.id, 3)`, which uses the `THREE` spans 5/4/3 | B5 (partial) | Real distance ordering (`explore.store.ts:placesNear`), but no story, event or archive module. It also shows no distance value. |
| `apps/web/app/(site)/walks/page.tsx:21` | `MAPPED_PLACES.slice(0, 3)` | B6 slot | **Amend.** The register says "published walks only; honest empty state otherwise". The page states the empty state (`walks/page.tsx:16`) and then fills it with places. This bento should not be there until a walk exists. |
| `apps/web/app/(site)/stories/page.tsx:18` | `MAPPED_PLACES.slice(3, 6)` | B8 slot | **Amend**, same reason: the band title is "No stories published yet". |
| `apps/web/app/(site)/today/page.tsx:27` | `MAPPED_PLACES.slice(0, 3)` | B10 slot | **Amend**, same reason. "These places are worth the trip today" (`today/page.tsx:26`) is a time-sensitive claim with no source or freshness, which the "Rules for every bento" in `00-shared-contract.md` forbid. |
| `apps/web/components/site/NotFoundContent.tsx:10` | `MAPPED_PLACES.slice(0, 3)` | none | **Add a register entry (B13, 404 recovery)** or replace it with a plain list. It is not in B1 to B12. |

The homepage has no B2 or B3 bento. "Start with a block" (`ProductHome.tsx:139-182`) is a 4/8 split with one `MightsNotchCard` map and three ghost buttons. That is the right raw material for B2.

### Register: confirm or amend

| # | Decision | Evidence and change |
|---|---|---|
| B1 | Confirm, amend the data rule | It exists (`ProductHome.tsx:193`). It needs a real dominant module (see the `lead` variant below) and should cap at 4 to 5 modules on mobile. Six full-width map rasters stack about 2 MB of images (observed: six `720x405@2x` requests of 318 to 354 KB in `mobile-home-2.json`). |
| B2 | Confirm (standing decision: B2 over B3) | Build it from the existing chapter (`ProductHome.tsx:139-182`) with the `map-dominant` variant. The three places already in `BLOCK` (`ProductHome.tsx:32`) are the support modules. |
| B3 | Struck for now | The standing decision chose B2. Keep the row in the register marked "alternate, not built". |
| B4 | Defer | `ProductHome.tsx:198-233` ("From the map to the sidewalk") is a non-bento narrative chapter. Section 19 explains why its AR claim cannot carry a "proof" bento yet. |
| B5 | Confirm, amend | The current version is places-only. Until stories, events or archive items exist, render 2 to 3 nearby places with a visible distance (`haversine` exists in `explore.store.ts`) instead of pretending to be a context cluster. |
| B6, B8, B10 | Confirm the entries, remove the current renders | No walks, stories or events exist (the pages say so). The rule "published only; honest empty state otherwise" means no bento until there is data. The empty state should keep its single "Open the map" CTA. |
| B7, B9 | Confirm, not buildable yet | No walk or story detail routes exist (`find apps/web/app -name page.tsx` lists none under walks or stories). |
| B11 | Confirm, gated by section 19 | `/ar` today is a 7/4 split (`ar/page.tsx:16-47`). The proof cluster needs truthful status labels before it ships. |
| B12 | Struck (standing decision) | There is no profile or saved route on web. `useExplore.savedPreviewIds` is mobile-only (`packages/app/features/explore/MightsPanel.tsx:17`). |
| B13 (new) | Propose | 404 recovery: 3 modules, dominant = nearest popular place, data = `MAPPED_PLACES`, primitive = `MightsPlaceBento` compact variant. Alternatively drop it and keep only `MightsSearchForm`. Steward's call: keep it as compact, because 404 recovery benefits from a destination. |

### Variants needed in `packages/ui/mights/MightsPlaceBento.tsx`

Current API: `MightsPlaceBento({ places }: { places: readonly BentoPlace[] })` (`MightsPlaceBento.tsx:19`). Spans come from `SPANS` (`:16`) or `THREE` (`:17`), picked by `places.length === 3`. Every module is a `MightsNotchCard` with a fixed `h-56 md:h-64` map well (`:31`) rendering `MightsMapImage` at zoom 17.2, pitch 40, 720x405 (`:33-41`). `MapAttribution` sits under the grid (`:61`). There is no `variant`, no `lead`, no non-map media and no heading level control (it always renders `level={3}`, `:50`).

Proposed additive API (one component, variants defined once):

| Variant | What changes in `MightsPlaceBento.tsx` | Used by |
|---|---|---|
| `default` (today's behaviour) | Unchanged except module 0 becomes dominant: span 7 plus `md:row-span-2`, and support modules get a shorter media well. This is what "one dominant item, legible as dominant at every breakpoint" requires. | B1, B5 |
| `map-dominant` | New prop `lead: { kind: 'map'; center; zoom; pins; alt }`. Renders one large `MightsMapImage` (span 8, row-span 2) with its own `sizes`, and the places become text-first support modules (no per-module raster). It drops the N extra Mapbox requests. | B2, B11 |
| `story-dominant` | `lead: { kind: 'figure'; src; alt; caption; href }` renders `MightsFigure` (`MightsFigure.tsx:5`) as the dominant item. Support modules use `MightsFigure` when `BentoPlace` gains an optional `image` field, and the map only as fallback. | B3 (if revived), B8, B9 |
| `compact` (strip) | No media well. `MightsHeading size="card"` plus one `MightsText size="small"` line plus an optional value slot (distance, time, stop count). 3 or 4 equal-height modules with asymmetric spans (4/3/3/2). | B7, B13 |

Shared changes regardless of variant:

1. Add `headingLevel?: 2 | 3`. Bands already render an h2 (`MightsPage.tsx:35`), so 3 is right there, but a bento directly under the h1 needs 2.
2. Remove `label={place.name}` (`MightsPlaceBento.tsx:28`). It hides the street and description from assistive tech. Lighthouse flags it as `label-content-name-mismatch` on `/places/apollo-theater` (observed in `desktop-place-2.json`). The visible heading already names the link.
3. Replace "Location pending" (`:44-46`) with a token-styled `MightsText`. The `text-[13px]` is off-scale (see section 15).
4. Pass `sizes` per span instead of the single `(min-width: 768px) 45vw, 100vw` (`:39`). A 3-span module renders at about 25vw.
5. Module order is source order. The `THREE` and `SPANS` arrays never reorder. Keep that, because "mobile collapses to one column with source order = reading priority" already holds.

---

## 15. Theme and token audit, Mights primitive inventory

### Every export of `packages/theme/tokens.ts`

| Export | Lines | Contents | Notes |
|---|---|---|---|
| `palette` | 16-110 | `mights` (17 named colours: gold, gold-highlight, gold-shade, gold-dim, warm-black, limestone, paper, raised, stoop-iron, iron-muted, brownstone, marquee-red, transit-cobalt, verdigris, sodium-amber, spatial-cyan, night), legacy 50-950 scales `burgundy`, `ember`, `ink`, `gold`, `forest`, `sky`, `rose`, `slate`, and `white` | Emitted as `--color-<scale>-<step>` and `--color-mights-<name>` by `build-css.mjs` (sharedThemeTokens) |
| `semantic` | 115-141 | 25 light/dark pairs: surface, surface-raised, surface-sunken, paper, brownstone, verdigris, amber, spatial, rule-hairline, rule-rail, text, text-muted, text-inverse, primary, primary-pressed, on-primary, accent, accent-pressed, on-accent, border, border-strong, focus, danger, on-danger | Emitted with `light-dark()`. `apps/web/app/Document.tsx:12` pins `data-theme="dark"`, so the site always resolves the dark column. |
| `fontFamilies` | 145-152 | display, sans (Mona Sans), serif (Newsreader) | |
| `typeScale` | 156-166 | marquee, display-2xl, display-xl, display-lg, display-md, display-sm, title-lg, title, lead | Smallest step is `lead` (20px). Nothing exists for body, small, caption or label. |
| `contentWidths` | 171-187 | content-form, content-feed, content-prose, content-detail, content-screen, content-wide, screen-2xl, pane-primary, pane-primary-narrow, pane-supplementary, pane-inspector | `pane-*` exists but Explore hardcodes `lg:w-[400px]` and `lg:w-[440px]` (`ExploreWorkspace.tsx:227,245`) |
| `radius` | 189-197 | xs to sheet, full | The Mights language is clip-path cuts. No Mights primitive uses `rounded-*`. |
| `shadows` | 200-206 | stoop, card, raised, overlay | All `rgba(23, 28, 26, …)`, i.e. stoop-iron, which is invisible on the `#0B0906` dark canvas |
| `zIndex` | 208-216 | base to toast | Emitted as `--z-*` vars, not Tailwind utilities. Mights uses `z-50`/`z-10` literals (`MightsNavbar.tsx:36`, `MightsDock.tsx:30`). |
| `motion` | 220-232 | duration fast/base/slow/slower, easing standard/emphasized/exit | Durations are emitted as `--duration-*` outside Tailwind's namespace, which is why five primitives hardcode `duration-[120ms]` |
| `breakpoints` | 234-240 | sm to 2xl | |
| types `Palette`, `SemanticColor`, `ContentWidth` | 242-244 | | |

There is **no spacing token**. Every gap and padding uses Tailwind's default 4px scale. That scale is coherent, but nothing in the theme names the "bay", "rail" or "gutter" rhythm the Mights language talks about.

### Contradictions

1. **Legacy scales lie about their colour.** `palette.gold` is a blue scale (`tokens.ts:85-89`, `gold-500: #3B6DF6`). `palette.burgundy` is electric yellow (`:42-54`). `palette.ember` is hot pink (`:56-68`). The comment at `:39-40` says "ponytail: … delete them with those screens". They still back live code: 25 class uses in `packages/app/features/schedule/accent-classes.ts`, plus `packages/ui/Badge.tsx`, `Avatar.tsx`, `Lightbox.tsx`, and TS reads like `palette.burgundy[300]` in `packages/app/features/schedule/NotesEditor.tsx:187` and `palette.ink[50]` in `apps/mobile/app.config.ts:26`. A `bg-gold-500` written by someone who believes the name renders blue. Neither `apps/web` nor `packages/ui/mights` uses them, so the fix is a rename (gold to legacy-cobalt and so on) or deleting them together with the schedule demo. A new web surface must not adopt them.
2. **`packages/theme/index.ts:2`** says "Brand palette: burgundy, black, pumpkin orange." That is stale. The brand is gold on warm black (`tokens.ts:3-5`).
3. **`tokens.ts:199`** says "quiet depth on light surfaces", but the site is dark-only (`Document.tsx:12`). `shadow-stoop` is used on the More sheet (`MightsDock.tsx:70`) over dark paper, where an iron shadow at 12% does nothing. Shadows need dark values, or a decision that dark mode has no elevation and relies on rails.
4. **`tokens.ts:11`** says "No hex values exist outside this file". This is false: `packages/spatial/sightline/SightlineHeroRenderer.ts` has 15 hex literals (`:41` `createSightlineLensMaterial('#1F4FE0')`), and `sightlineMaterial.ts` has 1. `apps/web` and `packages/ui/mights` contain no hex (grep of `#[0-9a-f]{3,8}` and `rgba(` over `apps/web/app`, `apps/web/components` and `apps/web/content` returned nothing).
5. **Legacy `cobalt` tone names render gold.** `MapPin.tone: 'cobalt'` maps to `palette.mights.gold` (`MightsMapImage.tsx:12,39`). `MightsAccentFrame tone="cobalt"` maps to `--color-primary` (`MightsAccentFrame.tsx:6,11`), which is gold in dark. `globals.css:105` still says "keyboard focus (cobalt, 2px, 4px offset)". Call sites pass `tone="cobalt"` and get gold (`ProductHome.tsx:203`, `ar/page.tsx:18`). Rename the tone to `primary` (or `gold`) and keep `cobalt` as a deprecated alias for one release.
6. **`semantic.primary` is cobalt in light and gold in dark** (`tokens.ts:130`). That is intentional for the mobile light mode, but it means "primary" carries two brand meanings. Gold on light paper is 1.55:1 (computed), so the light column can never use gold for primary. Record that so nobody "fixes" it.
7. **`build-css.mjs` emits `--duration-*` and `--z-*` outside the Tailwind theme namespace.** Primitives therefore cannot write `duration-fast` and fall back to `duration-[120ms]`. Either emit them where Tailwind v4 reads them, or require `duration-(--duration-fast)` syntax.
8. **The non-text contrast of `border-strong` in dark fails WCAG 1.4.11.** `#5A503E` on surface-raised `#15120D` is 2.36:1, under 3:1. It is the only boundary of the search inputs (`MightsSearchForm.tsx:17`, `ExploreWorkspace.tsx:112`). Other dark pairs pass: text 17.19:1, text-muted 7.57:1, gold on surface 12.40:1, accent 7.26:1, rule-rail 4.10:1.

### Arbitrary Tailwind values

`grep -rnoE '\[[0-9.]+(px|rem|ms)\]'` over `packages/ui/mights`, `apps/web/app` and `apps/web/components` finds **45 occurrences in 14 files**: 32 in `packages/ui/mights`, 13 in `apps/web`.

| File | Lines and values |
|---|---|
| `packages/ui/mights/MightsProse.tsx` | 19 `[13px]`, 21 `[15px]`, 28 `[14px]`, 34 `[19px]`, 40 `[19px]` |
| `packages/ui/mights/MightsNavbar.tsx` | 36 `[120ms]`, 38 `[12px]` (blur), 53 `[14px]`, 58 `[2px]`, 58 `[120ms]` |
| `packages/ui/mights/MightsButton.tsx` | 13 `[120ms]`, 29 `[120ms]`, 33 `[52px]`, 33 `[15px]`, 34 `[14px]` |
| `packages/ui/mights/MightsFooter.tsx` | 22 `[15px]`, 23 `[13px]`, 31 `[15px]`, 60 `[13px]` |
| `packages/ui/mights/MightsType.tsx` | 14 `[20px]` (card), 41 `[18px]` (lead mobile), 43 `[14px]` (small) |
| `packages/ui/mights/MightsNotchCard.tsx` | 28 `[2px]`, 28 `[120ms]` |
| `packages/ui/mights/MightsMapImage.tsx` | 92 `[13px]`, 119 `[11px]` |
| `packages/ui/mights/MightsFigure.tsx` | 23 `[2px]`, 36 `[13px]` |
| `packages/ui/mights/MightsDock.tsx` | 17 `[11px]`, 30 `[12px]` |
| `packages/ui/mights/MightsPlaceBento.tsx` | 44 `[13px]` |
| `packages/ui/mights/MightsBreadcrumb.tsx` | 28 `[13px]` |
| `apps/web/components/explore/ExploreWorkspace.tsx` | 130 `[13px]`, 151 `[15px]`, 168 `[17px]`, 169 `[14px]`, 183 `[2px]`, 194 `[14px]`, 227 `[400px]`, 245 `[440px]`, 260 `[14px]` |
| `apps/web/components/site/ProductHome.tsx` | 91 `[560px]`, 107 `[2px]` |
| `apps/web/app/(site)/error.tsx` | 13 `[52px]`, 14 `[15px]` |

By value: 28 of the 45 are font sizes (13px ×8, 14px ×7, 15px ×6, 11px ×2, 19px ×2, 17/18/20px ×1). The root cause is the type-scale gap above. Add `body` (16), `small` (14), `label` (13), `caption` (11) and `prose` (19, leading 1.75) to `typeScale`, and these collapse into named utilities. 5 are `120ms`, which equals `motion.duration.fast` (contradiction 7). 5 are the `2px` rail, which should be a token (`rail: 2px`, used by NotchCard, Figure, Navbar underline, the hero lens and the Explore sheet). The 400px/440px values should be the existing `pane-*` widths.

A wider grep that counts any `-[…]` utility other than clip-path or font-stretch finds 78. The other 33 are layout expressions such as `aspect-[16/10]`, `max-w-[18ch]`, safe-area `calc(env(...))` and `h-[calc(100dvh-4rem-56px-…)]`. The `ch` measures and safe-area math are defensible. `56px` (dock height) appears three times (`MightsFooter.tsx:27`, `ExploreWorkspace.tsx:221`, implied by `MightsDock.tsx:32 h-14`) and should be a token.

**Raw hex and inline styles:** none in `apps/web` (see contradiction 4). `style={{` does not appear in `apps/web/app`, `apps/web/components` or `packages/ui/mights`. Two raw Tailwind colours bypass semantics: `text-white` (`MightsLocationStamp.tsx:17`, `MightsNavbar.tsx:32`). `--color-white` is a token (`palette.white`), so this is a naming gap, not a raw value.

### Mights primitive inventory (read from source)

| File | Export | Real props and variants | Notes and gaps |
|---|---|---|---|
| `MightsButton.tsx` | `MightsButton`, `MightsButtonProps` | `href` (required), `children`, `variant: 'primary' \| 'secondary' \| 'ghost'`, `size: 'md' \| 'sm'`, `className`, `external`, `fill`, `aria-current` | **Link-only.** It always renders `<a>`, via solito `Link` or a raw `<a>` (`:70-81`). There is no `<button>`, no `onPress`, no `type="submit"` and no disabled or loading state. That forced hand-rolled clones at `error.tsx:12-15`, `MightsSearchForm.tsx:20-26` and the Explore chips and toggles (`ExploreWorkspace.tsx:119-134,253-264`). |
| `MightsNotchCard.tsx` | `MightsNotchCard`, props | `href?`, `children`, `className`, `innerClassName`, `state: 'rest' \| 'live'`, `label?` | `label` becomes `aria-label` (see the bento fix). Renders `<div>` without `href`. |
| `MightsAccentFrame.tsx` | `MightsAccentFrame`, props | `children`, `className`, `tone: 'iron' \| 'cobalt' \| 'live'` | `cobalt` renders primary gold |
| `MightsLocationStamp.tsx` | `MightsLocationStamp`, props | `name`, `street?`, `href?`, `tone: 'light' \| 'dark'`, `className` | `tone` names describe the backdrop, not the theme. `dark` hardcodes `text-white`. |
| `MightsBreadcrumb.tsx` | `MightsBreadcrumb`, `Crumb` | `items: Crumb[]`, `origin?` | Emits BreadcrumbList JSON-LD. `SITE` falls back to `localhost:3000` (`:13`). |
| `MightsWordmark.tsx` | `MightsWordmark` | `height = 40`, `className` | It is the mobile LCP element on `/explore` (section 18) |
| `MightsNavbar.tsx` | `MightsNavbar`, props | `overlay?`, `tone: 'iron' \| 'paper'` | The scroll listener writes the Zustand `useShell` (`store.ts`) |
| `MightsDock.tsx` | `MightsDock` | none | Native `<dialog>` for More. `shadow-stoop` on dark. |
| `MightsFooter.tsx` | `MightsFooter` | none | Store badges deferred (ponytail note `:51-53`) |
| `MightsMapImage.tsx` | `MightsMapImage`, `MapAttribution`, `mapboxStaticUrl`, `mapboxStaticSrcSet`, `MapPin`, props | `center`, `zoom`, `pitch?`, `bearing?`, `width`, `height`, `pins?: MapPin[]` (`tone: 'cobalt' \| 'live' \| 'iron'`), `alt`, `className`, `priority?`, `sizes?`. `MapAttribution({ className })` | `STYLE = 'mapbox/dark-v11'` is a module constant (`:8`), not a prop or token. srcSet is only emitted when `sizes` is passed (`:86`). |
| `MightsType.tsx` | `MightsHeading`, `MightsText`, `MightsHeadingProps` | Heading: `level: 1 \| 2 \| 3`, `size: 'marquee' \| 'display-lg' \| 'display-md' \| 'title' \| 'card'`, `className`, `id`. Text: `size: 'lead' \| 'body' \| 'small'`, `tone: 'default' \| 'muted'`, `className` | `MightsText` is always a `<p>`. There is no `as` prop and no inline span. |
| `MightsSearchForm.tsx` | `MightsSearchForm` | `defaultValue`, `className` | GET form, works without JS. Fixed `id="mights-search"`, so two on a page collide. |
| `MightsPage.tsx` | `MightsPage`, `MightsBand` | Page: `title`, `lead?`, `crumbs?`, `children`. Band: `title`, `action?`, `children` | Band heading is always h2 at `display-md` |
| `MightsPlaceBento.tsx` | `MightsPlaceBento`, `BentoPlace` | `places: readonly BentoPlace[]` (`id`, `name`, `area`, `street?`, `shortDescription`, `lngLat?`) | See section 14 |
| `MightsFigure.tsx` | `MightsFigure` | `src: string \| null`, `alt`, `caption?`, `ratio: 'wide' \| 'standard'`, `priority?`, `className` | No exported props type. Returns null without src. |
| `MightsProse.tsx` | `MightsProse`, `ProseSection` | `sections`, `updated?` | Newsreader at `text-[19px]`, an off-scale value |
| `MightsJsonLd.tsx` | `MightsJsonLd` | `data` | |
| `geometry.ts` | `cornerCut`, `cornerCutSm`, `notch`, `condensed`, `semiCondensed`, `expanded` | class strings | The cut sizes (20/12/8/140px) are geometry tokens living outside `tokens.ts` |
| `routes.ts` | `routes`, `primaryNav`, `secondaryNav`, `activeSection`, `PrimaryNavLabel` | | `routes.walk`, `walkStop`, `story`, `event` point at routes that do not exist yet |
| `store.ts` | `useShell` | `{ scrolled, setScrolled }` | Zustand |

**Gaps**, in priority order:

1. An action button. Add `MightsButton` `as="button"` with `onPress`/`type`/`disabled`, or a sibling `MightsAction` that shares the `tv()` recipes.
2. A chip or segmented control. The Explore categories and the map/list toggle are hand-rolled twice.
3. A text input. Two hand-rolled inputs with a failing border contrast.
4. Small type roles in the scale.
5. A map-style token.

---

## 16. Map-style prototypes to test

Standing decision: the site is dark by default. We prototype two dark styles and no light one. Note that `04-explore-map-workspace.md` ("Map style": "2. light/custom Mights daylit") still asks for a light prototype. Edit that prompt so Phase 4 doesn't reopen the question.

Today, one style string is hardcoded in two places: `packages/ui/mights/MightsMapImage.tsx:8` (`STYLE = 'mapbox/dark-v11'`, used for Static Images) and `apps/web/components/explore/ExploreMap.tsx:80` (`style: 'mapbox://styles/mapbox/dark-v11'`, used for GL). Before prototyping, move it to a single source. I suggest `tokens.ts` → `map: { style: { static: 'mapbox/dark-v11', gl: 'mapbox://styles/mapbox/dark-v11' } }`, with `build-css.mjs` ignoring it. Then a candidate swap is a one-line change, and static and GL can't drift apart.

### Candidates

| | A: `mapbox/dark-v11` (current) | B: Mights-tinted dark (Mapbox Studio, based on dark-v11) |
|---|---|---|
| Land / background | Mapbox's neutral dark grey | `semantic.surface.dark` `#0B0906` or `surface-sunken.dark` `#070604` |
| Roads | grey | `border.dark` `#2A241A` for minor roads, `border-strong.dark` `#5A503E` for major |
| Water / parks | blue-grey / dark green | `palette.mights.night` `#0E1412`, plus `semantic.verdigris.dark` `#5FB8A4` at low opacity for parks |
| Labels | Mapbox default light grey | `text-muted.dark` `#A89F8B`, halo `#0B0906` |
| POI icons | on | off, or limited to transit. Gold pins should be the only saturated thing on the map. |
| Pins | `pin-s+f8c626` static / gold diamond `.mights-marker` (`globals.css` `.mights-marker::before`) | same |
| Fonts | DIN Pro + Arial Unicode glyph PBFs (observed in requests) | the same glyph set. A custom font upload costs glyph bytes, so don't add one. |

### What to measure

1. **Pin and label contrast.** Sample the rendered static PNG at each pin and label (5 places at zoom 15.6 and 17.2). Compute the WCAG ratio for the gold `#F8C626` pin fill against the surrounding land and road pixels, and for label text against its halo. Pass: pins ≥3:1 against every adjacent pixel class (WCAG 1.4.11), labels ≥4.5:1. B's land equals our surface, which is 12.40:1 against gold, so B should pass by construction. A has to be measured.
2. **Pin versus POI confusion.** Count non-Mights saturated features within 40px of each pin. B targets 0.
3. **Sunlight legibility.** Run the same screenshots through a glare simulation: add a 40% white veil (luminance-add), then re-run the label contrast. Also view them on a phone at full brightness outdoors (manual, 3 observers, 125th St). Dark styles lose contrast fastest under glare, so this decides whether "dark everywhere" survives outdoors. If both candidates fail, record it. It is the argument for a light map inside a dark site, which we would only reopen with this evidence.
4. **Style load cost** (GL). Measure the style JSON, iconset and glyph bytes, plus time from `new Map()` to the first `idle` event (`map.on('idle')`, Mapbox API docs). Baseline from today's Lighthouse JSON, `/explore` mobile run 2: style JSON 5.2 KB, `iconset.pbf` 18.5 KB, vector tiles 229 KB (desktop 467 KB), glyphs 192 KB, 13 Mapbox requests and 445 KB in total (desktop 18 requests, 684 KB). Dropping POIs in B should shrink the iconset and the tile decode work.
5. **Static image bytes.** Fetch the same `720x405@2x` frame in both styles. Today's dark-v11 frames are 318 to 354 KB each (observed). A flatter palette should compress smaller.
6. **Brand cohesion.** Put screenshots next to `ProductHome` hero and Explore and score them in the Phase 8 design critique.

### Protocol

- The same 5 places from `MAPPED_PLACES`. The same views: hero (`ProductHome.tsx:43-50` HERO_MAP), the bento frame (`MightsPlaceBento.tsx:33-41`) and the Explore fit-bounds.
- Static: fetch both styles with `curl` at 1x and @2x and record bytes and TTFB 5 times each. GL: measure on the production build, Chrome 154, 3 cold loads per candidate, using `performance.mark` in a throwaway local branch (never committed), from `new Map` to the first `idle`.
- B lives as a Mapbox Studio style on the project account. A style URL is not a secret, but the token stays in `.env.local` only.
- Output: an ADR in Phase 4, with a table of the six measures for each candidate.

---

## 17. Accessibility baseline (WCAG 2.2 AA)

Method: axe-core 4.10.2 at 390 and 1280 on 9 routes (`axe-summary.txt`); bounding-box sweep of all interactive elements under 24px; 44-Tab keyboard traces on `/` and `/explore` at 390 and 1280 (`keyboard.json`); dock-occlusion measurement (`tool/obs.js`); reduced-motion captures (`*-rm.png`). Contrast from token hex (`tokens.ts:116-139`) with the WCAG relative-luminance formula. Screen-reader output was not tested with VoiceOver/NVDA. The roles below come from the DOM and axe.

### Per-screen table

| Screen | Criterion | Result | Evidence | Fix |
|---|---|---|---|---|
| All | 1.4.3 Contrast | Pass | text 17.19:1, text-muted 7.57:1 (7.11 on raised), primary on surface 12.4:1, on-primary 12.4:1 | none |
| All | 1.4.11 Non-text contrast | Fail (minor) | unselected chip fill / selected list row 1.06:1; `border` 1.29:1; `border-strong` input outline 2.36:1 on raised | add `border-strong`→≥3:1 value or 1px `rule-rail` (4.1:1) outline on inputs/chips |
| All | 2.4.7 Focus visible | Pass | bracket `::after` on `.mights-focus` (`globals.css:109-133`); computed `outline:none` is intentional | none |
| All | 2.5.8 Target size | Pass | only sub-24px targets are inline Mapbox/OSM attribution links (42×16, 82×16; inline-text exception) and footer links 23px tall with 34px row pitch (spacing exception) | optional: footer links `min-h-6` |
| All | 1.1.1 Non-text | Pass | every map `<img>` has a descriptive alt | none |
| Home | 1.3.1 / 4.1.2 | Minor | axe `aria-allowed-role` ×5: `<section role="region">` from `@acme/ui/tw` `Section` | drop explicit role or add `aria-labelledby` |
| Home 390 | 2.4.11 Focus not obscured (min) | Pass (marginal) | dock covers 40 of 54px of the focused "Open the map" (14px visible, label hidden), "See every place" 17px covered (`premium-p1/home@390-focus-dock-7.png`); not *entirely* hidden, so AA passes; AAA 2.4.12 fails | `html { scroll-padding-bottom: calc(56px + env(safe-area-inset-bottom)) }` and `scroll-padding-top: 4rem` |
| Home | 2.2.2 Pause, stop, hide | Pass | beam loops only on hover/focus, static under reduce | keep beam to one card |
| Explore | 4.1.2 Name, role, value | **Fail (critical)** | axe `aria-allowed-attr` ×6: Mapbox sets `role="img"` on marker `<button>`, so `aria-pressed` invalid and markers announced as images (`ExploreMap.tsx:92-102`) | after `new Marker(...)`, `el.setAttribute('role','button')` or wrap a real button inside the marker element |
| Explore | 1.3.1 / landmarks | Fail (moderate) | no `<main>` (`landmark-one-main`), content outside landmarks (`region` ×8–17); skip link target `#main` is a `View` (`SiteMotionShell.tsx:50`) | render workspace root as `Main` from `@acme/ui/tw` |
| Explore | 2.4.3 Focus order | **Fail** | sheet is last in DOM; 15 Tabs from top to its Close at 390 | dialog with focus moved to heading on open |
| Explore | 2.4.3 / 3.2.x on close | **Fail** | Close → `router.back()`, focus lands on `<body>` | restore focus to originating row/marker |
| Explore | 2.1.1 Keyboard | Pass | list rows, chips, markers, zoom, toggle all reachable and operable; Escape not bound (not required, but expected for a sheet) | bind Escape |
| Explore | 4.1.3 Status messages | Fail | filter/search result count not announced | `aria-live="polite"` count |
| Explore | 2.5.7 Dragging | Pass | list + marker buttons + ± zoom cover every map outcome | none |
| Explore | 1.4.10 Reflow | Pass | 390 renders map/list toggle, no horizontal scroll | none |
| Place | 1.3.1 | Minor | `aria-allowed-role` ×1 | as Home |
| Place | 2.5.8 | Pass | breadcrumb "Explore" 45×20, inline-text spacing ok | optional `min-h-6` |
| Walks/Stories/Today/Download | all tested | Pass | 0 axe violations | none |
| AR | 1.3.1 | Minor | `aria-allowed-role` ×1 | as Home |
| Map text | 1.4.3 (images of text) | Advisory | dark-v11 labels ≈3.9:1 and 6–8px at pitched views; map labels are incidental to the alt text, so not a strict fail | tokenized warm-dark style, larger labels (§9 H5) |

### Focus-order map

- **`/` 1280:** Skip link → wordmark → Explore, Walks, Stories, Today → Preview AR → Get the app → Open the map (hero) → location stamp → Mapbox/OSM → Open the map (block) → 3 place buttons → Mapbox/OSM → See every place → 6 bento cards → Mapbox/OSM → See how AR works → Open the map (close) → footer (11 links). Logical. "Open the map" appears three times and Mapbox attribution three times (11 low-value stops).
- **`/` 390:** same, without the navbar links (hidden), and the dock's 5 items come **last**, after the footer. Dock-first would match visual priority. Acceptable as-is.
- **`/explore` 1280:** skip → wordmark → nav (Explore `aria-current=page`) → search → 7 chips → 8 rows → map canvas → 6 markers → zoom/bearing → attribution. A selected place's inspector comes after the attribution.
- **`/explore` 390:** skip → wordmark → map canvas → 6 markers → controls → attribution → Map/List toggle → dock. Toggle should precede the map.

### Target-size map (under 24px)

| Element | Size | Verdict |
|---|---|---|
| Mapbox / OpenStreetMap attribution (static maps) | 42×16, 82×16 | inline text exception |
| Mapbox GL attribution (Explore) | 57×14, 98×14, 99×15; logo 88×23 | inline/essential exception |
| Footer links | full-width × 23px, 34px pitch | spacing exception |
| Breadcrumb "Explore" | 45×20 | spacing exception |
| Map markers | 28×28 | pass |
| Chips | 50–97 × 36 | pass |
| Dock items | 76×56 | pass (also meets 44px) |

### Reduced-motion matrix

| Motion | Default | `prefers-reduced-motion: reduce` | Verified |
|---|---|---|---|
| Hero map parallax scrub (`motion.ts:251-255`) | scrubbed | not bound | `home@1280-rm.png` |
| Section entrances (block, places, close) | fade/translate on enter | not bound, content at rest | `home@390-rm.png` |
| Sidewalk reveal scrub (`motion.ts:277-281`) | scrubbed, **reverses on scroll-up** | not bound | `home@1280-rm.png` vs `home@1280.png` |
| View transitions (`globals.css:59-99`) | crossfade | 0s | source |
| Notch-card beam (`globals.css:166-190`) | infinite 2.4s rotation on hover/focus | static gold rail | source |
| Explore `flyTo` (`ExploreMap.tsx:62-63`) | `flyTo` speed 1.4 | `jumpTo` | source |
| Marker selection grow | 120ms width/height | not gated (sub-threshold) | source |
| Lenis smooth scroll (`SiteMotionShell.tsx`) | on | assumed off via Kinetrell `system` mode, not verified in this pass | open |

## 18. Architecture, performance baseline and measurement protocol

### Rendering map today

| Route | Rendering | Client islands | Map surface |
|---|---|---|---|
| `/` | `ProductHome` is `"use client"` for the whole page (`ProductHome.tsx:1`) because `useHomeMotion` and `useBrowserReducedMotion` live in it | whole page | 1 hero static (preloaded, `fetchPriority=high`), 1 lens static, 1 block static, 6 bento statics, 1 sidewalk static, so 10 Static Images |
| `/explore` | server page, client `ExploreWorkspace` inside `Suspense` (`explore/page.tsx:12`) | workspace | GL map, dynamic `import('mapbox-gl')` |
| `/places/[slug]` | server, `generateStaticParams`, params awaited in Suspense | navbar, cards (solito `Link` makes them client components) | 1 priority static (no `sizes`), 3 bento statics |
| `/walks`, `/stories`, `/today` | server (`/today` is request-time via `connection()`) | | 3 bento statics each |
| `/ar` | server | | 1 static (no `sizes`) |

Every page also loads the shell (`SiteMotionShell.tsx`): navbar, dock, footer, plus Lenis and the GSAP clock (`:27-36`). Lenis is skipped on `/explore` and under reduced motion. The GSAP and Lenis chunks still ship on every route (see bundle below).

### Static Mapbox images

- `mapboxStaticUrl` / `mapboxStaticSrcSet` (`MightsMapImage.tsx:44-81`) build 0.5x/1x/1.5x candidates, capped at 1280 per side, with `@2x` rasters. The srcSet is only emitted when a caller passes `sizes` (`:86`). **Callers without `sizes` ship one fixed @2x raster to phones:** `places/[slug]/page.tsx:85-93` (1120x700@2x, observed **847 KB** on mobile) and `ar/page.tsx:20-29` (960x720@2x, observed **677 KB**). These are the LCP images on those routes, and they are the main reason mobile LCP is 14.3 s on place and 9.0 s on AR.
- The bento's `sizes="(min-width: 768px) 45vw, 100vw"` (`MightsPlaceBento.tsx:39`) picks the 1440w candidate on Lighthouse's 412px × 1.75 DPR viewport (721 device px is above the 720w candidate). Each card costs 318 to 354 KB.
- **Observed, cause unconfirmed:** `/walks` mobile downloads the 847 KB `1120x700@2x` Apollo place hero at High priority, although `/walks` doesn't render it (`mobile-walks-2.json`). `/places/apollo-theater` fetches it twice (847 KB + 895 KB). Hypothesis: Next `Link` prefetch of `/places/apollo-theater` carries React's image preload for the `priority` (eager plus `fetchPriority=high`) `<img>`. Confirm with a DevTools initiator trace before fixing.
- `MightsMapImage` uses a plain `<img>` with `width`/`height` (`:101-112`), so the CLS contribution is 0 (observed everywhere).
- The token rides in the URL (`:55`). That is normal for Mapbox public tokens. It must be URL-restricted in the Mapbox account, which I did not verify.

### Dynamic GL map (`apps/web/components/explore/ExploreMap.tsx`)

- `import('mapbox-gl')` runs inside `useEffect` (`:73`), so the 1.86 MB raw / 512 KB gzip chunk (`.next/static/chunks/0x6bbx5gw33h7.js`, mapbox-gl 3.32.0) is not in the initial `/explore` HTML. `curl /explore` lists 15 chunks and that one isn't among them. Lighthouse still counts it (transferred script on `/explore`: 764 KB, against 260 KB on `/`), and it lands during load, which is where the mobile TBT comes from (342 ms median).
- `import 'mapbox-gl/dist/mapbox-gl.css'` is static (`:3`). It ships as a separate 48.8 KB CSS chunk (`2fj5y6618fdfs.css`) on `/explore` only. That is acceptable.
- **DOM markers:** one `<button class="mights-marker">` per place (`:91-104`), 6 today. Mapbox recommends Style Layers from about 100 markers ("Markers create DOM elements … For scenarios with 100+ markers, consider Style Layers", Mapbox GL JS guides, Add your data → Markers). The threshold to switch should be 50 places, using a GeoJSON source plus symbol layer, with `feature-state` for selection.
- **A11y bug:** Mapbox's `Marker` constructor sets `role="img"` on any element that has no `role` (`node_modules/mapbox-gl/dist/mapbox-gl-dev.js:111909-111911`, mapbox-gl 3.32.0). Our buttons therefore announce as images, and `aria-pressed` becomes invalid. Lighthouse `aria-allowed-attr` fails on `/explore` for both presets (observed), which is the entire a11y drop from 100 to 93/95. Fix: `el.setAttribute('role', 'button')` before `new mapboxgl.Marker` (`ExploreMap.tsx:92-95`).
- Desktop `/explore` also fails `landmark-one-main`: the workspace has no `<main>`, and `SiteMotionShell.tsx:50` `#main` is a `View`/div.
- The marker target is 28×28 (`globals.css .mights-marker`). That passes WCAG 2.5.8 (24×24) but misses the pack's 44×44 goal.
- **flyTo/jumpTo:** `applySelection` (`:43-64`) uses `jumpTo` when not animating or when `prefers-reduced-motion` matches, and otherwise `flyTo({ speed: 1.4, essential: false })`. With `essential: false`, Mapbox itself honours reduced motion. Correct.
- **ResizeObserver** (`:110-118`): calls `map.resize()` on every observation, and does the first `fitBounds` when a hidden pane (`view=list` on a phone) gets a size. This is correct. There is no rAF coalescing, which is acceptable at this layout's resize frequency.
- `cooperativeGestures: false` (`:85`). Right for a full-viewport workspace. If a GL map ever goes inline in a scrolling page, it needs `true`.
- `places` is read once on mount (eslint-disable at `:129-130`). Fine for a static catalogue. A CMS-backed catalogue will need marker diffing.
- `rightInset={selected ? 460 : 0}` (`ExploreWorkspace.tsx:239`) duplicates the sheet width `lg:w-[440px]` + `right-4` (`:245`) as a magic number.
- No `mapboxgl.prewarm()`. If Explore entry from the homepage CTA feels slow, warming the workers on CTA hover is the cheap lever (Mapbox API `prewarm`).

### URL workspace state and Zustand

- The URL is the source of truth for `view`, `q`, `category` and `place` (`ExploreWorkspace.tsx:38-40,63-68`). The `q` draft lives in `useExplore.query` and is mirrored to the URL by a debounced `history.replaceState` (`:46-56,90-94`). Selecting pushes; filtering and typing replace. That is a sound contract.
- **`useExplore` fields unused on web:** `category`, `selectedPlaceId`, `savedPreviewIds`, `setCategory`, `selectPlace`, `toggleSavedPreview` (`explore.store.ts:162-187`). Web reads only `query`/`setQuery` (`ExploreWorkspace.tsx:48-49`). The others are used by the mobile/shared panes (`packages/app/features/explore/ExploreMasterPane.tsx:22-25`, `MightsPanel.tsx:16-18`, `apps/mobile/app/(drawer)/(tabs)/explore/_layout.tsx:18-19`), so they are not dead code. But web and mobile now own category and selection differently (URL versus store). Phase 2's Explore state contract has to choose one model per platform and document it.
- `filterHarlemPlacePreviews` (`explore.store.ts:193`) is re-implemented locally as `matches` (`ExploreWorkspace.tsx:29-36`). Delete the duplicate.
- **Bare `useState`/`useReducer`:** 0 in `apps/web` and 0 in `packages/ui/mights`. **Not 0 in `packages/ui`:** 4 calls in `packages/ui/backgrounds/GlyphCity.skia.tsx:171`, `GridFloor.skia.tsx:37`, `GridScene.skia.tsx:37` and `SkiaWebGate.tsx:24`. These are exported from `packages/ui/index.ts:75-77` but no `apps/web` route imports them. They are violations of the repo rule, outside the public site. The rule's own helper, `packages/ui/use-instance-store.ts`, shows the replacement.
- `useRef` holds the typing timer and the `pushed` flag (`ExploreWorkspace.tsx:56,62`). Imperative values live in refs, which follows the roster rule.

### Bundle (production build `BUILD_ID hL8kTNhOWnsbuym0CCATK`, built 2026-10-07 18:38)

- `/` initial JS: 12 chunks, **292 KB gzip** (gzip -9 of each chunk listed in the served HTML). The largest are react-dom (71.6 KB), two framework/RNW chunks (46.5 KB, 39.4 KB), **GSAP 45.0 KB** and **Lenis + Kinetrell 17.3 KB**, and a lucide chunk of 20.7 KB.
- `/explore` initial JS: **292 KB gzip**. The same shell, with GSAP and Lenis still shipped although Lenis is disabled there. Then mapbox-gl comes lazily at **512 KB gzip / 1.86 MB raw**.
- Fonts: `MonaSans_Variable…woff2` is **422 KB** at High priority on every route (observed). `fonts.ts:3` says "Latin subsets" but the file is the full variable font with all axes. With `display: 'optional'` on throttled mobile, the font likely misses its block window and Arial renders (inferred). Subsetting to Latin plus the used axes is the cheapest LCP and byte win on every route.

### First interaction

Lighthouse navigation mode has no INP. TBT is the lab proxy: mobile medians run 47 to 83 ms on content routes and 342 ms on `/explore`. For the map, "first interaction" really means two things. One is time until markers respond, which follows map `load` plus the marker loop at `ExploreMap.tsx:91-104`. The other is the INP of the first marker click: `router.push`, the URL re-render, and `flyTo`. Neither is in Lighthouse. Measure them with a DevTools Performance trace of "load /explore → tap Apollo marker → sheet open" (CPU 4×, 3 runs), and with field INP from `web-vitals` `onINP` once there is traffic. `pnpm perf:tracesift` (`package.json:24`, `@callstack/tracesift@0.3.1`) analyses React Profiler and JS CPU captures, and `docs/performance/tracesift.md` lists "Explore map pan/zoom plus place selection" as a scenario. It does not need a device for web: export a Chrome CPU profile or React Profiler JSON and load it. I did not run it in this phase.

### Lighthouse baseline (measured 2026-10-07)

**Protocol.** Repeat it exactly in later phases.

- Machine: Apple M3 Pro, 18 GB (`hw.memsize` 19327352832), macOS (Darwin 27.0.0). Lighthouse `benchmarkIndex` 2610.
- Chrome: Google Chrome 154.0.8037.98, headless (`--headless=new --incognito --no-first-run`), UA reports HeadlessChrome/154.
- Lighthouse: `npx lighthouse@latest` resolved to **13.5.0**.
- Server: `next start` (Next 16.3.8) from `~/Harlem-Might/apps/web` on localhost, production build above, same machine.
- Mobile: Lighthouse default. Simulated throttling: RTT 150 ms, 1.6 Mbps, 4× CPU, Moto G Power viewport (412×823 @1.75).
- Desktop: `--preset=desktop`. Simulated RTT 40 ms, 10 Mbps, 1× CPU.
- 3 sequential runs per route per preset, 30 runs in total, median per metric. Routes: `/`, `/explore`, `/places/apollo-theater`, `/walks`, `/ar`.
- Script: `tooling/perf/lighthouse-baseline.sh <base-url> <out-dir>` writes `<preset>-<route>-<n>.json`; `node tooling/perf/lighthouse-medians.mjs <out-dir>` prints the medians.
- Mapbox Static and GL requests go to the live Mapbox API, so LCP includes Mapbox server render time and varies with their cache.

**Medians**

| Preset | Route | Perf | A11y | BP | SEO | LCP | CLS | TBT | FCP | SI | Page weight | Perf per run |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mobile | `/` | 75 | 100 | 100 | 100 | 9.29 s | 0 | 48 ms | 0.97 s | 1.60 s | 3540 KB | 75/75/75 |
| mobile | `/explore` | 70 | 95 | 100 | 100 | 5.27 s | 0 | 342 ms | 1.15 s | 4.15 s | 1731 KB | 29/70/78 |
| mobile | `/places/apollo-theater` | 75 | 100 | 100 | 100 | 14.29 s | 0 | 83 ms | 0.96 s | 1.26 s | 3527 KB | 75/75/75 |
| mobile | `/walks` | 76 | 100 | 100 | 100 | 7.22 s | 0 | 47 ms | 0.96 s | 1.21 s | 2624 KB | 76/77/75 |
| mobile | `/ar` | 75 | 100 | 100 | 100 | 8.97 s | 0 | 49 ms | 0.94 s | 1.22 s | 1458 KB | 75/75/75 |
| desktop | `/` | 95 | 100 | 100 | 100 | 1.48 s | 0 | 0 ms | 0.26 s | 0.41 s | 2162 KB | 95/95/96 |
| desktop | `/explore` | 98 | 93 | 100 | 100 | 1.09 s | 0 | 3 ms | 0.30 s | 1.08 s | 1967 KB | 84/98/98 |
| desktop | `/places/apollo-theater` | 92 | 100 | 100 | 100 | 1.82 s | 0 | 0 ms | 0.26 s | 0.28 s | 2745 KB | 87/93/92 |
| desktop | `/walks` | 97 | 100 | 100 | 100 | 1.29 s | 0 | 0 ms | 0.26 s | 0.29 s | 1839 KB | 97/97/97 |
| desktop | `/ar` | 91 | 100 | 100 | 100 | 1.94 s | 0 | 0 ms | 0.25 s | 0.30 s | 2565 KB | 91/91/91 |

The mobile `/explore` run 1 is an outlier: perf 29, TBT 4952 ms, bootup 8.7 s. Runs 2 and 3 show TBT 342 ms and bootup 1.6 s. Treat the first cold load of the mapbox chunk as real but noisy. Later phases should run 5 samples on `/explore` and report the median plus the max.

**LCP element per route.** Lighthouse 13 has no `largest-contentful-paint-element` audit, so this comes from `lcp-breakdown-insight`, run 2.

| Route | Mobile | Desktop |
|---|---|---|
| `/` | hero static map, `img` alt "Map of West 125th Street in Harlem, from the Apollo Theater to the Studio Museum" (`section#trg-hero > … > div#mpx-hero-map > img.block`) | same |
| `/explore` | **navbar wordmark** `img` "Harlem Might" (`header.sticky > … > a.mights-focus > img.block`) | **"Explore" title text** (RNW `Text`, `ExploreWorkspace.tsx:102`) |
| `/places/apollo-theater` | place hero static "Map of Apollo Theater" (`div.group > span.relative > span.relative > img.block`) | same |
| `/walks` | first bento card static "Map of Apollo Theater" (`… div.h-56 > img.block`) | same |
| `/ar` | "Street-level map view of the Apollo Theater on West 125th Street" (`div.mights-frame > … > img.block`) | same |

On `/explore` the map is a WebGL canvas, so it never counts as an LCP candidate. Explore's LCP of 5.27 s says nothing about when the map becomes usable. Phase 2 needs a custom mark: `performance.mark('map-idle')` on the first `idle` event, reported next to LCP.

Unthrottled LCP breakdown, mobile run 2: on `/`, TTFB 32 ms, load delay 13 ms, load 159 ms, render delay 25 ms. The simulated 9.29 s is therefore almost entirely a throttled transfer of the @2x Mapbox raster. On `/explore`, render delay is 172 ms (1616 ms in the cold run 1), which is hydration and JS.

**Against `docs/design/PRODUCT_SITE_MOTION.md` ("Measured", home only, protocol not recorded there):**

| Metric (home) | Doc desktop | Now desktop | Doc mobile | Now mobile |
|---|---|---|---|---|
| Performance | 95 | 95 | 74 | 75 |
| Accessibility | 99 | 100 | 99 | 100 |
| Best practices / SEO | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 |
| LCP | 1.6 s | 1.48 s | ~17 s | 9.29 s |
| CLS | 0 | 0 | 0 | 0 |
| TBT | 0 ms | 0 ms | 60 ms | 48 ms |
| Speed Index | 0.6 s | 0.41 s | 3.3 s | 1.60 s |

#15's CLS fix holds (0 on all 10 route and preset pairs). The score matches within one point. The mobile LCP gap (17 s → 9.3 s) is likely Mapbox server-cache state plus a different throttling path. The doc says "devtools throttle", while these runs use Lighthouse's simulated throttling. That gap is why this protocol fixes the throttling method.

### Budgets proposed for Phase 2 (mobile, this protocol)

- CLS 0 on every route; any regression blocks merge.
- TBT ≤ 100 ms on content routes and ≤ 300 ms on `/explore` (median of 5).
- LCP: no regression against the table above. Target ≤ 4 s on `/places/*` and `/ar` once `sizes` is passed and the font is subset.
- Initial JS ≤ 300 KB gzip (today 292 KB). mapbox-gl stays lazy.
- `/explore` map-idle mark: baseline in Phase 2, then budget.

### Cheapest wins, measured before any change

1. Pass `sizes` at `places/[slug]/page.tsx:85` and `ar/page.tsx:20`.
2. Subset Mona Sans.
3. Set `role="button"` on the markers.
4. Confirm the walks-page prefetch of the place hero image.
5. Drop GSAP/Lenis from `/explore`'s bundle if Explore never animates.

Do these one at a time and re-run this protocol after each.

---

## 19. Spatial and Specs truthfulness risks

### What the code ships

- `/ar` (`apps/web/app/(site)/ar/page.tsx`) renders one Mapbox static map (`:20-29`) and two paragraphs. It contains no camera or WebXR code, and it says so: "Nothing here asks for your camera" (`:39`).
- `packages/spatial` (imported by no `apps/web` source file; it is listed only in `apps/web/next.config.ts:35` transpilePackages and `apps/web/package.json:22`) contains one AR scene: `TabletopColocationScene.native.tsx`, a light-cycle tabletop race on a detected plane (`ViroARScene` `:870`, `ViroARPlaneSelector` `:923`). It is reached through `apps/mobile/app/(drawer)/spatial.tsx` → `SpatialScreen`.
- **No place-label or geospatial AR exists anywhere in the repo.** No `ViroARScene` reads `HARLEM_PLACE_PREVIEWS`, and `grep -rnE 'Geospatial|geospatial'` returns nothing in `apps/mobile` or `packages`. `arCandidate` (`explore.store.ts:29`) is only shown as the text "Candidate" (`packages/app/features/explore/MightsPanel.tsx:56`).
- **Sightline** (`packages/spatial/sightline/*`, exported as `@acme/spatial/sightline` in `packages/spatial/package.json:27-29`) has no importer outside its own folder. `grep -rln Sightline apps packages` finds only its own files. Its README says "The Harlem Mights hero is a shared WebGPU scene" and describes "a route ribbon + POI anchors showing the intended AR navigation use". The live homepage hero is a static Mapbox image (`ProductHome.tsx:91-99`).
- The app isn't in the stores: "The app is in testing and is not listed on the App Store or Google Play yet" (`apps/web/app/(site)/download/page.tsx:15`).

### Copy that overclaims, against the code

| Claim | Location | Present-tense claim | Code reality | Status word per the pack's ladder (preview / concept / integration path / in testing / verified) |
|---|---|---|---|---|
| "Hold up your phone on the block and each label sits on the building it belongs to." | `ar/page.tsx:15` (lead) | yes | no place-label AR scene exists | **concept** |
| "AR runs in the Harlem Might app. It uses the same place records as the map, so the label you see in the street is the place you opened…" | `ar/page.tsx:36-37` | yes | the app's only AR scene is the tabletop race | concept |
| "In the app, the same place record follows you outside. Hold up your phone on the block and the label sits on the building it belongs to." | `ProductHome.tsx:221-225` | yes | same | concept |
| "…and the label you see through your phone in AR" | `apps/web/content/about.ts:46` | yes | same | concept |
| "an app with walking routes and augmented-reality labels" / "an augmented-reality view that pins labels to the buildings" / "the AR label all come from the same place record" | `apps/web/content/press.ts:4,13,37` | yes, in a press kit that journalists will quote | no walks route and no place AR | concept (walks: not started) |
| "Everything shown in AR is also available as text on the place's page." | `apps/web/content/legal.ts:161` (accessibility statement) | yes | an accessibility promise about a feature that doesn't exist | rewrite as future commitment |
| "Preview AR" nav label | `routes.ts:48`, `MightsNavbar.tsx:69-71`, `MightsFooter.tsx:12` | implies something to preview | the page shows a static map | acceptable only if the page says "concept" |

`docs/XR-PLATFORM-MATRIX.md:11` lists "iOS / Android phone + tablet → integrated → non-headset Viro previews and AR stay available". That describes Viro runtime availability, not a Harlem place-AR feature. Copy must not cite the matrix as evidence for place labels. The matrix's own rule (`:112`, "Do not label an adapter foundation, simulator result, or successful build as physical-device proof") applies to product copy too. No Specs or Spectacles, Quest, visionOS or glasses claim appears in `apps/web` (grep for `Spectacles|Specs|Quest|visionOS|glasses` over `app`, `components` and `content` returns nothing). The matrix rows for Specs ("adapter foundation merged", `:19`) and Meta VR Glasses ("physical-device verification still required", `:14`) are honest as written. The risk is future B11 or `/ar` copy promoting them. Each needs the matrix's verification record (`:114-123`) before any wording stronger than "integration path".

### Recommendations for Phase 7 (copy and Spatial Engineer)

1. Rewrite the `/ar` lead and body, the home sidewalk chapter, `about.ts:46`, `press.ts:4,13,37` and `legal.ts:161` into a clearly future or concept tense, for example "We're building an AR view that…". The Copy Editor owns the wording.
2. B11 (AR proof cluster) cannot ship until a place-label AR scene exists and has a matrix-style verification record. Until then the cluster can show "map: live", "AR: concept", "Specs: integration path".
3. Decide on Sightline: either wire it into the hero behind the PR #15 motion contract (one renderer, DPR cap 2, dispose on unmount, as in its README), or mark the README as a concept asset so nobody cites it as a shipped hero.
4. Brand naming: public web copy says "Harlem Might". Catalogue strings still say "Harlem Mights" (`explore.store.ts:58,90`), and those `whyItMatters` strings render on the place page (`places/[slug]/page.tsx:67`) and in the Explore sheet (`ExploreWorkspace.tsx:199`), so the inconsistency is public. Flag it for the Copy Editor. I made no brand decision here.

## 19a. Aesthetic-direction memo (frontend-design)

**What reads as templated now**
1. *The SaaS card kit, Harlem-skinned.* One card shape (map-top, title, street, one-line description) repeats across five routes at near-equal spans. The notch-and-cut geometry is distinctive, but repeating it six times per viewport turns it into wallpaper.
2. *Near-black with one bright accent.* Warm black plus gold is the brand and stays. The templated part is that gold does every job (CTA, rail, pin, marker, focus, selected chip, beam) while cobalt and red never appear. One accent doing everything reads as a default, not a choice.
3. *Generic descriptor copy.* "A Harlem performing-arts landmark with a global cultural reach" or "Food, music, and neighborhood energy in the heart of Harlem" could describe any venue. Every card has the same sentence shape.
4. *Maps as decoration.* A stock dark basemap fills space that should hold Harlem itself. It is the visual equivalent of the gradient wash.
5. *Equal page skeletons.* Walks, Stories, Today and Download all share the H1, lead, rail, H2 and CTA stack.

**Token- and primitive-only moves (no new kit, no light mode)**
1. **Give cobalt and red real jobs through tokens.** Add mode-stable semantic tokens `transit` (cobalt `#1F4FE0` lifted for dark, ≥4.5:1 on `surface`) and `live` (`marquee-red` dark value, already `accent` `#FF6B7F`) to `packages/theme/tokens.ts` `semantic`. Rules: gold = action and selection; transit = subway/route/directions ("Get directions", walk route lines, the `MightsAccentFrame tone="cobalt"` that currently resolves to gold); live = Today/now (event-happening stamps, `MightsNotchCard state="live"`). This alone breaks the one-accent tell.
2. **One dominant module per bento, encoded as a `MightsPlaceBento` variant.** Add `variant: 'lead-media' | 'strip' | 'trio'` with a `lead` slot spanning `md:col-span-8 md:row-span-2` filled by a `MightsFigure`, and supporting modules that are text-first (`MightsLocationStamp` + `MightsHeading size="card"`, with no map thumbnail). Supporting cards lose their map raster entirely, so the bento stops being six maps.
3. **Notch only where something is selected or dominant.** Make `MightsNotchCard` notch a prop (`notch?: 'top' | 'bottom' | 'both' | 'none'`, default `'none'`) and keep the one corner cut. The dominant module and the selected Explore sheet get the notch, so the notch means "this one".
4. **Bring Newsreader onto product routes.** Place "why it matters" and Stories excerpts go through `MightsProse` (Newsreader, `tokens.ts:150`) in the full `text` color (not `text-muted`), measure ≤66ch. Contrast between condensed Mona display and serif prose gives the editorial voice the site claims.
5. **Warm the map, then demote it.** A tokenized warm-dark Studio style (§9 H5) makes maps belong to the warm-black surface. On place pages and the bento, use pitch 0, zoom ≥17, Mapbox POI labels hidden under our pin, and one map per group.
6. **Replace the type scale bypasses.** Map `text-[13|14|15|17px]` in `ExploreWorkspace.tsx` onto the existing scale steps (`label`, `small`, `body`, `card`) via `MightsText`/`MightsHeading` sizes, so Explore and home share one rhythm.
7. **Differentiate the empty states by content, not chrome.** Walks: one sourced route sketch on `MightsMapImage` with the stop count "in research". Stories: one archive `MightsFigure` with credit. Today: a `live`-token stamp with the fetched date. The H1/lead/rail skeleton stays; the module under it changes per route, and the three shared map cards go.
8. **Spend boldness once.** The marquee hero type is the memorable element. Keep everything around it quiet. Put the photograph in the lens, cut the outer map to a darker, lower-contrast field, and leave the beam only on the dominant card.

Out of scope here and deferred to later phases: copy rewrites (copy ladder, §12), Explore layout restructure beyond the sheet semantics (Phase 4), and AR concept imagery production (Phase 7, must be labelled "concept" per `docs/IMAGE_POLICY.md`).

## 20. Open questions

Each one says whether it blocks work and who can answer it.

1. **Schomburg source of truth.** nypl.org returned a bot challenge to fetches (section 6). Someone needs to read it in a browser before any Schomburg record ships. Blocks Schomburg visit facts only.
2. **Photography.** Every image on the site is a Mapbox static map (section 13), yet the footer promises credited photographs (`MightsFooter.tsx:62`). Commissioned or archival media needs a budget and a rights owner. Until then the footer line comes out and B1/B5 stay map-led. Owner: repo owner.
3. **Hours and entrances.** Current copy promises "the hours, the way in" (`ProductHome.tsx:147-148`, `/ar`), but no field stores either (section 7). Phase 2 removes the claim. Adding the fields waits on a sourcing plan.
4. **`quest3+` vs `supportedDevices`.** See `docs/META_VR_GLASSES.md` §3. Not a site blocker.
5. **Status vocabulary.** `XR-PLATFORM-MATRIX.md` says "integrated" and "adapter foundation merged". The pack and the glasses doc use preview / concept / integration path / in testing / verified. Phase 7 maps the matrix onto the five words (section 12 has the mapping).
6. **Mobile in CI.** Deferred until viro-external's `codex/specs-generated-preview` merges and CI can read the private repo (`.github/workflows/ci.yml`). Until then every phase runs `pnpm --filter mobile typecheck` locally.
7. **Mobile Explore measurement.** One cold run scored 29 (section 18). Later phases take five samples on `/explore`.


## 21. Do-not-build list

- No `/events/[slug]` until there is an event Harlem Might writes about or hosts itself; link out to the venue.
- No `/walks/[slug]/stops/[n]`; a stop is a `/places/[slug]` page.
- No profile, saved places, accounts or sign-in on the web (B12 struck; `/profile` redirects to `/`).
- No glasses or Specs claims, renders or waitlist on public pages until a build passes the device bar in `docs/XR-PLATFORM-MATRIX.md`.
- No web camera AR; `/ar` stays an explanation of the app path.
- No copy promising hours, entrances or access details until the place record has those fields.
- No new nav items for empty sections; Walks, Stories and Today stay as honest empty states, not filler pages.
- No home modules that reuse the same three places again; the next visual needs a photograph or archival image, not another map tile.
- No ratings, reviews or user comments; they pull the product toward Google Maps' ground and add moderation load.
- No re-hosting of Schomburg or other archive material; link to the source.
