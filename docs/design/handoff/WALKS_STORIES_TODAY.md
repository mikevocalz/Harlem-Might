# Handoff: Walks, Stories, Today

Phase 6 of the premium experience pack. Routes:

| Route | File | Reader |
|---|---|---|
| `/walks` | `apps/web/app/(site)/walks/page.tsx` | `listWalks()` |
| `/walks/[slug]` (new) | `apps/web/app/(site)/walks/[slug]/page.tsx` | `getWalk(slug)` via `components/walks/load.ts:loadWalk` |
| `/stories` | `apps/web/app/(site)/stories/page.tsx` | `listStories()` |
| `/stories/[slug]` (new) | `apps/web/app/(site)/stories/[slug]/page.tsx` | `getStory(slug)` via `components/stories/load.ts:loadStory`, plus `listWalks()` for B9 |
| `/today` | `apps/web/app/(site)/today/page.tsx` | `listEventsForDate(harlemToday())` |

Components live in `apps/web/components/walks/`, `components/stories/` and `components/today/`. Readers come from `@acme/payload/server` (`packages/app/content/README.md` for the contract).

Checked by typecheck, lint and three `node:test` files (`walk-facts.test.ts`, `story-format.test.ts`, `event-format.test.ts`). **Not checked in a browser.** This phase ran beside other agents in the same working tree and was not allowed to start a server or build, and no walk, story or event records exist, so there are no screenshots, axe runs or rendered states yet. The tables below come from the source and the primitives' classes.

## What changed and why

1. **The placeholder bentos are gone.** All three index pages used to say "nothing published" and then show three fixture places in a bento (audit §14). That bento is removed. Empty is now a sentence and one live exit, Open the map.
2. **Three states, three sentences.** `ok` with records renders the content; `ok` with `[]` renders "No {walks|stories} published yet" / "No events listed for today"; `unavailable` renders "We couldn't check for {walks|stories|events} right now" with Try again (same route) and Open the map. The calm empty sentence never appears when the read failed. `query-failed` errors go to `console.error` for the logs.
3. **Request-time reads.** Index pages call `await connection()` before the reader, inside `<Suspense>`. The build has no `DATABASE_URL`, so a build-time read would return `unavailable` and bake "we couldn't check" into the static shell. Detail pages await `params` inside `<Suspense>` and have no `generateStaticParams` (with Cache Components an empty list is a build error, and the build cannot list slugs). `loadWalk`/`loadStory` wrap the reader in React `cache()` so `generateMetadata` and the page share one query.
4. **Bento only from two records up.** One record renders as a single `MightsNotchCard`. The bento takes up to five (one dominant plus four), and anything beyond goes into a plain "More walks" / "More stories" list. Today has no cap yet: one day's listings in Harlem are unlikely to pass a handful; revisit if they do.
5. **Stops are an `<ol>`, never a bento.** Each `<li>` has `id="stop-n"` (`walk-facts.ts:stopAnchor`) and links to `/places/[slug]`. `routes.walkStop` is deleted (audit §11: a stop is a place).
6. **Events have no page.** `routes.event` and the `/^\/events/` match in `primaryNav` are deleted. An event module links to the venue's listing (`sourceUrl`), tickets when the event is running, and the venue's place page when the venue is catalogued. `routes.today` no longer takes a date: `/today/[date]` is deferred until listings exist. The `/events` → `/today` redirect in `next.config.ts` stays. Consumers checked with `git grep`: `sitemap.ts:13` and `MightsFooter.tsx:11` call `routes.today()` with no argument; nothing called `walkStop` or `event`.
7. **Place links only when the page exists.** `/places/[slug]` renders from the static catalogue (`explore.store.ts:HARLEM_PLACE_PREVIEWS`), not from Payload. `components/walks/place-link.ts:linkPlace` returns a link only when the Payload place's slug is in that catalogue; otherwise the name renders without a link. This keeps "nav never 404s" until Places move to Payload.
8. **The walk map shows stops, not the path.** `WalkRecord` has no route geometry. `walk-facts.ts:walkMapView` builds a static map from the stops' catalogue points (first stop red, the rest gold) and the caption says so. If some stops have no point, the caption says how many of the total are on the map.
9. **"Start walk" is "Directions to the first stop".** There is no walking mode, pause or resume on web. The button opens Google Maps walking directions to the first stop's catalogue point, the same pattern as the place page. It renders only when the first stop has a point.
10. **"Checked" uses the later of `fetchedAt` and `lastVerifiedAt`** (`event-format.ts:checkedAt`), so the label never understates freshness. Listings checked more than 7 days ago add "Confirm with the venue before you go." (`STALE_AFTER_DAYS`).
11. **Time zone.** Every date and time on these pages is formatted in `America/New_York`: the Today heading, event ranges (`eventWhen`, `Intl.DateTimeFormat.formatRange`), "Checked today at …", story bylines. The tests include a late-evening EDT instant that is already the next day in UTC.
12. **Story body uses Newsreader** at the `prose` step and a 65ch measure (`StoryArticle.tsx`). The first archive image leads; the others are spread evenly through the paragraphs. Every image carries caption, credit and rights in its `MightsFigure` caption (`story-format.ts:archiveCaption`).

## Composition maps

### Walks index

| Surface | Primitives | Bento |
|---|---|---|
| Header | `MightsPage` (h1 "Walks", lead) | none |
| ≥ 2 walks | `MightsPlaceBento` default, custom modules (`WalksIndex.tsx:WalkModule`), module 0 dominant with the stops map; others text only | **B6** |
| 1 walk | one `MightsNotchCard` with the map | none |
| > 5 walks | B6 for the first five, then "More walks" `<ul>` of `MightsNotchCard` | B6 + list |
| Empty / unavailable | `ContentNotice` (`MightsHeading`, `MightsText`, `MightsButton`) | none |

### Walk detail

| Surface | Primitives | Bento |
|---|---|---|
| Header | `MightsPage` with breadcrumb Walks › title, lead = `summary` | none |
| Route facts | `MightsPlaceBento variant="compact"` with fact modules from `walkFactModules` (distance, walking time, stops, start with "Ends at" note); only facts present. 1 fact → one `MightsText` line; 0 → nothing | **B7** |
| Actions + access | `MightsButton` (Directions to the first stop, Open the map), "The walk starts at …", "Getting around" note with source link and checked date | none |
| Map | `MightsNotchCard` 16:9 with `MightsMapImage`, caption, `MapAttribution` | none |
| Stops | `WalkStops.tsx`: `<ol>` of `MightsNotchCard` rows, visual numeral `aria-hidden` | **none** |
| Sources | `SourcesList.tsx` | none |

### Stories index

| Surface | Primitives | Bento |
|---|---|---|
| Header | `MightsPage` (lead adds "Every story names its sources.", audit §12 ★B) | none |
| ≥ 2 stories, feature has an archive image | `MightsPlaceBento variant="story-dominant"`, lead = feature's first archive image with credit; modules = feature text, then secondaries | **B8** |
| ≥ 2 stories, no feature image | default variant, feature text module dominant | **B8** |
| 1 story | `<ul>` with one `MightsNotchCard` | none |
| > 5 | B8 + "More stories" list | B8 + list |
| Empty / unavailable | `ContentNotice` | none |

### Story detail

| Surface | Primitives | Bento |
|---|---|---|
| Header | `MightsPage` with breadcrumb, lead = `dek` | none |
| Byline | `MightsText`: author, `<time>` published, updated only when on a later New York day | none |
| Body | `StoryArticle.tsx`: `MightsFigure` lead (priority), Newsreader paragraphs, inline `MightsFigure`s | none |
| End | `StoryRelated.tsx` "Where this happened": linked places first, then up to two walks whose stops include one of those places; capped at 3. ≥ 2 → default bento (place modules carry maps); 1 → single card; 0 → nothing | **B9** |
| Sources | `SourcesList.tsx` | none |

### Today

| Surface | Primitives | Bento |
|---|---|---|
| Header | `MightsPage` h1 "Today in Harlem, {weekday} {day} {month}" (New York), lead | none |
| ≥ 2 events | `MightsPlaceBento` default, custom modules (`TodayEvents.tsx:EventBody`); running events first, cancelled/postponed after | **B10** |
| 1 event | one `MightsNotchCard` | none |
| Empty / unavailable | `ContentNotice` | none |

No suggested-places list on an empty Today: a list of places under "nothing today" is the unsourced "worth the trip today" claim the audit removed.

## States matrix

| Case | Walks | Stories | Today |
|---|---|---|---|
| Loading | Fallback line "Checking for published walks." under the static h1 | "Checking for published stories." | Whole page streams (the h1 holds the date) |
| Unavailable | "We couldn't check for walks right now" + Try again + Open the map | same for stories | same for events |
| Empty (`ok`, `[]`) | "No walks published yet" + Open the map | "No stories published yet" + Open the map | "No events listed for today" + Open the map |
| 1 | single card, no bento | single card | single card |
| 3 | B6: dominant + 2 beside | B8: lead + 3 modules | B10: dominant + 2 beside |
| Many | B6 (5) + "More walks" | B8 (5) + "More stories" | B10, all events |
| Long title | `MightsHeading` wraps with `text-balance`; h1 capped at 18ch by `MightsPage` | same | same |
| Missing image | Walk: no stop has a catalogue point → no map, text-only module and no attribution | Feature without archive → default variant; story without archive → no lead figure | n/a |
| Stale event | n/a | n/a | "Checked Sep 28. Confirm with the venue before you go." |
| Cancelled / postponed | n/a | n/a | "Cancelled." before the time, title struck through, Tickets link hidden; sorted after running events |
| Detail not found | `notFound()` → global 404 | `notFound()` | n/a |
| Detail unavailable | "We couldn't load this walk right now" + Try again + All walks | same for stories | n/a |
| Deleted stop place | Row reads "This stop is no longer in the catalogue", no link; count unchanged | n/a | n/a |
| Place not in the static catalogue | Name shown, no link | Left out of B9 | Venue name shown, linked to `venueUrl` if present |

## Copy

| Where | String |
|---|---|
| Walks lead | Take the long way. Walks connect places into a story without turning the neighborhood into a checklist. (kept, audit §12 A) |
| Stories lead | The history behind a block, kept on the block where it happened. Every story names its sources. |
| Today lead | Events with a date and a source, and when we last checked each one. |
| Walks empty | No walks published yet. The first routes are being researched now. Until they are published, start from a place on the map and walk out from there. |
| Stories empty | No stories published yet. Each story will be sourced and attached to the place where it happened. Until the first ones are published, start from a place on the map. |
| Today empty | No events listed for today. Venue listings appear here once we've checked them. Start from a place on the map instead. (audit §12 ★) |
| Unavailable (index) | We couldn't check for {walks/stories/events} right now. Our records didn't answer, so we can't say … Try again in a moment, or start from a place on the map. |
| Map caption | Pins mark the stops; the red pin is where the walk starts. |
| Stop gone | This stop is no longer in the catalogue |

The old Today lead "When an event ends, it comes off the list" was not used: `listEventsForDate` returns every event overlapping the day, including ones that ended earlier today.

## Accessibility

| Item | Implementation | WCAG |
|---|---|---|
| Stop order | `<ol>`; the visual numeral is `aria-hidden` so the position is announced once | 1.3.1 |
| Stop anchors | `id="stop-n"` with `scroll-mt-24` so the sticky header does not cover it | 2.4.3 |
| Dates and times | `<time dateTime>` on event start, "Checked" instant, story published/updated, source read dates, accessibility verified date | 1.3.1 |
| Heading outline | h1 page title; index modules h2 (bento sits under the h1, `headingLevel={2}`); detail sections h2 (Stops, Sources, Where this happened, Getting around); stop names and B9 modules h3 | 1.3.1, 2.4.6 |
| Bento reading order | Source order = visual order on mobile (one column); dominant module first | 1.3.2 |
| Link purpose | Repeated "Tickets" / "Venue listing" carry an `sr-only` "for {event title}"; card links take their name from the card text (no `aria-label` override) | 2.4.4 |
| Event cards | Frames, not links, so the links inside are not nested in another link | 4.1.2 |
| Status | Cancelled/postponed is a word, not only the strike-through | 1.4.1 |
| Images | Archive `alt` from the Media record; map `alt` names the walk and the number of stops | 1.1.1 |
| Focus | Every link uses `mights-focus` | 2.4.7 |
| Target size | Inline text links sit on a 24px line (`text-small`) | 2.5.8 |

Known gap, needs a primitive change (not made here): `MightsPlaceBento` fact modules render the value as a heading, so the B7 strip adds four h2s ("1.2 miles", "45 min" …) to the outline. A `<dl>` with label/value would be right.

## Primitive changes requested (not made; owned elsewhere)

1. `MightsPlaceBento` fact modules: render `dl`/`dt`/`dd`, not a heading per value.
2. `@acme/ui/html` has no ordered list, and its `Time` drops `dateTime` (`@expo/html-elements` `Time` strips it). These routes use raw `<ol>`, `<li>`, `<time>` and `<a>` inside `apps/web/components/{walks,stories,today}`, which the raw-tag lint rule does not cover. An `OrderedList` and a `Time` that keeps `dateTime` would let these move into the primitive layer.
3. `MightsFigure` caption is a single string; credit and rights would read better as a separate muted line.

## Unresolved

- No rendered check: no screenshots, axe run or Lighthouse for any state (server and build were off-limits for this phase).
- No walk route geometry in the `walks` collection; the map shows stops only. A `route` LineString field (and a static route image) is the Map Engineer's item.
- Pause/exit/resume and transit context for walks are not built: no data or walking mode exists.
- `/places/[slug]` reads the static catalogue, so any Payload place outside it is unlinked everywhere on these pages.
- Event bento has no module cap.
- `/today/[date]` deferred; `routes.today` takes no argument until it ships.
