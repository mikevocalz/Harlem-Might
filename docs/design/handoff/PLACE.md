# Handoff: place detail (`/places/[slug]`)

Phase 5 of the premium experience pack. Source: `apps/web/app/(site)/places/[slug]/page.tsx` (server component, `generateStaticParams` over the 8 fixture places) and `apps/web/components/place/` (`PlaceHero.tsx`, `PlaceNearby.tsx`, `PlaceSources.tsx`, `nearby.ts`). No client island of its own; `MightsLocationStamp`, `MightsNotchCard` and `MightsButton` are client primitives rendered from the server tree.

Checked by typecheck, lint and `apps/web/components/place/nearby.test.ts`. **Not checked in a browser.** This phase ran beside another agent in the same working tree and was not allowed to start a server, so there are no screenshots, axe runs or measured LCP for this page yet. The breakpoint and accessibility tables below come from the source and the primitives' classes, not from captures.

## What the page does

It answers four of the pack's nine place questions from data the catalogue actually holds, and says so when it can't answer the rest.

| # | Question | Answered today? | From |
|---|---|---|---|
| 1 | What is this place? | Yes | `shortDescription`, `category` |
| 2 | Why does it matter? | No (see Decisions 2) | — |
| 3 | Can I go now? | No, and the page says it hasn't verified hours | — |
| 4 | How do I get there? | Yes, to the map point | `street` / `area`, `lngLat` |
| 5 | What should I know before arriving? | No, same line as 3 | — |
| 6 | What happened here? | No | — |
| 7 | What is happening here now? | No (Decisions 3) | — |
| 8 | What is nearby? | Yes, by straight-line distance | `lngLat` + `haversine` |
| 9 | Where did the information come from? | Yes | `osm`, fixture fetch date |

Data: `packages/app/features/explore/explore.store.ts:HARLEM_PLACE_PREVIEWS`. Payload Places are not read yet (architecture "Data ownership": the fixture stays until Places are seeded).

## Decisions

The ones the code can't show are also short comments in the files named.

1. **Hero and visit share the first screen.** Facts on the left in one `MightsNotchCard` ("Getting there"), map on the right. Store-locator pages do the same (Mobbin refs below). Facts come first in the DOM and on screen, so on a phone "how do I get there" is answered before the picture. No bento in the hero.
2. **No story layer.** Every fixture `whyItMatters` is planning copy about the product, not about the place: "A place detail can pair the present-day restaurant with its history, menus…" (Sylvia's), "Harlem Might can connect a meal here…" (Red Rooster), "This is where entrance-aware navigation matters less…" (Strivers' Row). Printed under a "Why it matters" heading it reads as a spec leak, and Sylvia's promises menus the page doesn't have. The layer returns, in `MightsProse`, with the first sourced place story. (The page shipped before this phase rendered these lines; they are removed.)
3. **No current layer (DEFER).** There is no per-place events reader. `listEventsForDate` (`packages/payload/server.ts`) returns a whole day across venues; filtering it by venue in the route would drop events with no venue relation and run a database read inside a prerendered page. Returns with an events-by-place reader.
4. **Visit card holds only sourced facts:** the street (or area when there's no street), "Get directions" when the place has coordinates, a line saying directions go to the map point rather than an entrance (the fixture point is a Nominatim geocode, the Payload `locationAccuracy` "approx" case), and one line saying hours, accessibility and entry details aren't verified. No fixture has a website, so that line names no place to check.
5. **"Get directions" uses coordinates, not a name search,** so Google can't resolve to a different business with the same name.
6. **B5 is nearby places only.** `nearby.ts:nearbyPlaces` ranks mapped places by `haversine` from this place's point, keeps those within 1.5 km (`NEARBY_RADIUS_M`), caps at 4 (`NEARBY_MAX`). Each card's description line is the distance ("270 m away"); one line above the bento says the distances are straight-line. We never print walk times: there is no routing. Related-story and current-event modules wait for their readers (comment in `PlaceNearby.tsx`).
7. **B5 count rules** (`nearby.ts:nearbyLayout`): 2–4 places render `MightsPlaceBento` default variant with the nearest dominant; 1 renders a single `MightsNotchCard`; 0 renders no section. A place without coordinates always gets 0, because without a point there is no real distance.
8. **Sources band** lists one line per kind of fact shown: the OSM object (linked) and its fetch date, the description's authorship, and how distances were worked out (only when the nearby section renders). Map imagery credit stays under each map as `MapAttribution`.
9. **JSON-LD** keeps `TouristAttraction` with `name`, `url`, `address.streetAddress` (only when `street` exists) and `geo` (only with coordinates). `description` is dropped: it's our unreviewed summary.
10. **Category** shows as a secondary action, "{Category} on the map", which opens Explore filtered to it. That answers "what kind of place" without an eyebrow label over the h1.
11. **Hero map:** pitch 45 → 30 (architecture route map: "pitch ≤ 30"), `sizes` added (ADR-04), 16:9 frame (`aspect-video`) replaces the arbitrary `aspect-[16/10]`.
12. **Payload `Places`: no change.** Audit §7 gaps still open are hours/status with timestamps, structured accessibility, a sourced `whyItMatters` with a Pages↔Places relation, and one category vocabulary. Each is a schema decision (field shape, freshness window, citation model), not a missing column, and this page has no producer for any of them while it reads the fixture. Phase 2 already added `locationAccuracy`, `locationSource` and `entrance`. Types not regenerated because nothing changed.

## Composition map

| Layer | Component | Primitives (`packages/ui/mights`) and props used | Bento |
|---|---|---|---|
| Chrome | `MightsPage` | `title`, `lead` (= `shortDescription`), `crumbs` (Explore → place) | none |
| Hero + visit | `PlaceHero` | `MightsNotchCard` (no `href`), `MightsHeading level={2} size="title"`, `MightsText size="body" tone="default"` / `size="small"`, `MightsButton` (`external`, primary) and two `MightsButton variant="secondary" size="sm"` links, `MightsMapImage` (`center`, `zoom={16.8}`, `pitch={30}`, `width={1120}`, `height={630}`, `sizes`, `pins`, `alt`, `priority`), `MightsLocationStamp` (`name`, `street`, `className`), `MapAttribution` | none |
| Story | struck (Decisions 2) | — | — |
| Current | deferred (Decisions 3) | — | — |
| Nearby | `PlaceNearby` | `MightsBand title="Nearby"`, `MightsText size="small"`, `MightsPlaceBento places={…}` (default variant, `headingLevel` 3), or `MightsNotchCard href` + `MightsHeading level={3} size="card"` for one place | **B5** |
| Sources | `PlaceSources` | `MightsBand title="Where this comes from"`, `MightsText` | none |
| Structured data | page | `MightsJsonLd` | — |

No new primitive and no primitive change.

## Layout

| Width | Behaviour |
|---|---|
| 390, 430 | One column, `px-4`. h1, lead, Getting there card, the two secondary buttons (wrap to two rows at 390 if "Outdoors on the map" plus "See it on the map" exceed the width), map at 16:9 with the stamp bottom-left, attribution, Nearby (the explanatory line, then cards stacked nearest first), sources. Dock fixed at the bottom. |
| 768 (md) | Hero splits `md:col-span-5` facts / `md:col-span-7` map, `md:gap-6`. B5 goes 12 columns: dominant 7 cols × 2 rows, two supports 5 cols, a fourth module takes the full row (`MightsPlaceBento` spans). |
| 1024, 1280 | Same as md, wider. Sources text capped at `max-w-content-detail` (48rem). |
| 1440 | `max-w-screen-2xl` cap from `MightsPage`. |

Bands are separated by `MightsPage`'s `gap-16` and each `MightsBand`'s `border-rule-rail` top rule.

**Mobile source order** (= reading order = focus order): breadcrumb → h1 → lead → Getting there (Get directions) → See it on the map → {Category} on the map → map (stamp, attribution links) → Nearby cards → OSM link.

### Tokens used

Colors: `surface-sunken` (pending plate), `rule-hairline` (divider inside the visit card), `rule-rail` (band rules, primitive), `primary` / `text` (sources link and hover), plus primitive internals. Type: `MightsHeading` `title` / `card`, `MightsText` `lead` / `body` / `small`. Width: `content-detail`. Spacing: Tailwind 4px steps only (`gap-1…10`, `p-5`, `p-6`, `pt-4`, `bottom-4`, `left-4`). No arbitrary values in the new files.

## States and cases

| Case | Example | What renders |
|---|---|---|
| Mapped, street known | Apollo, Studio Museum, Sylvia's, Red Rooster, Schomburg | Map + stamp (name, street), Get directions, entrance caveat, hours line, B5 with 4 modules, sources with OSM link |
| Mapped, no street | Marcus Garvey Park | Stamp and card show the area ("Mount Morris Park"); JSON-LD has no `address` |
| No coordinates | National Black Theatre, Strivers' Row | Sunken plate "Location pending verification" with the stamp; "Directions open once the location is verified."; no attribution; no Nearby; sources say "Map point: none yet…"; JSON-LD has no `geo` |
| Coordinates without an OSM id | none today | Sources: "Map point: on the map, but its source isn't recorded yet." |
| No hours / status / accessibility | every place | One line in the visit card. No "hours unknown" row per field |
| No menu | every place (`menuAvailable` is a flag with no menu data behind it) | Nothing. No menu link until Payload `menus[]` is read |
| B5 with 4 / 3 / 2 candidates | 4 for all six mapped places today; 3 and 2 covered in tests | Default bento, nearest dominant |
| B5 with 1 | tests only | Single notch card |
| B5 with 0 | unmapped places | No Nearby band |
| No Mapbox token | any env without `NEXT_PUBLIC_MAPBOX_TOKEN` | `MightsMapImage`'s labelled "Map unavailable" plate; stamp still shows |
| Unknown slug | `/places/nope` | `notFound()` → `(site)/not-found.tsx` |
| Loading | — | Static at build; the `Suspense` boundary has no fallback because the content is prerendered for every known slug |
| Error | — | `(site)/error.tsx` |

Nearby today (straight line, from `nearbyPlaces`):

| Place | Nearby |
|---|---|
| Apollo Theater | Studio Museum 270 m, Sylvia's 490 m, Red Rooster 490 m, Marcus Garvey Park 820 m |
| The Studio Museum in Harlem | Red Rooster 230 m, Sylvia's 260 m, Apollo 270 m, Marcus Garvey Park 550 m |
| Sylvia's Restaurant | Red Rooster 80 m, Studio Museum 260 m, Marcus Garvey Park 470 m, Apollo 490 m |

## Copy

| String | Where | Why this wording |
|---|---|---|
| Getting there | visit card h2 | Names the job of the card; the card holds no hours, so "Visit" would overpromise |
| Directions go to the map point, not to a checked entrance. | under Get directions | Audit §7: never turn an approximate point into entrance directions |
| Directions open once the location is verified. | unmapped places | Says when the action will exist |
| We haven't verified hours, accessibility or entry details for this place, so this page doesn't list them. | visit card | One line covering every missing time-sensitive field |
| See it on the map / {Category} on the map | secondary actions | Verb-first, names the destination |
| Straight-line distance from the {name} map point. | above B5 | Said once instead of on every card |
| {n} m away | B5 card line | |
| Where this comes from | sources band | Plain version of pack question 9 |
| Description: written by Harlem Might and not yet checked against official sources. | sources | True for every fixture description |

Audit §12 offered a place intro line ("{Name}, {street}. Why it matters, what's nearby and where our facts come from."). Not used: the page can't show "why it matters" yet, and the lead slot already carries the description.

## Accessibility (WCAG 2.2 AA), from source

| Criterion | Status | Evidence / note |
|---|---|---|
| 1.3.1 Headings | Pass (source) | h1 name → h2 Getting there → h2 Nearby → h3 per nearby place → h2 Where this comes from. No skipped level. |
| 1.3.2 / 2.4.3 Order | Pass (source) | No CSS reordering. Facts precede the map at every width; B5 dominant is first in the DOM (`MightsPlaceBento` never reorders). |
| 1.1.1 Images | Pass (source) | Hero alt "Map of {name}, {street or area}"; B5 maps "Map of {name}" (primitive); pending plate is text. |
| 2.4.4 Link purpose | Pass (source) | "Get directions", "See it on the map", "{Category} on the map"; OSM link text is the object id inside a sentence that says what it is. B5 cards take their whole content as the name (reuse matrix §3 fix 1). |
| 2.5.8 Target size | Pass (source) | md button `h-13`, sm `h-10`, whole-card links; attribution links use the inline-text exception. |
| 1.4.3 Contrast | Pass (token math, audit §17) | `text-muted` 7.57:1, `primary` on surface 12.4:1. Not re-measured on this page. |
| 3.2.5 / new window | Advisory | "Get directions" and the OSM link open a new tab with no warning. AAA only; fixing it means a `MightsButton` `external` change (reported, not made). |
| Screen reader | Not tested | No VoiceOver/NVDA pass this phase. |

## References

Place-detail flows from audit §5.3 (Apple Maps place detail and location detail, Airbnb experience details, Beli place page) and the end-of-page cluster pattern from §5.6 (Google Arts & Culture "Objects that will tell you stories"). Added this phase, structure only:

- [Walmart store page](https://mobbin.com/screens/93946e2c-8768-40a0-8798-90ff35cd2f28): facts column left (address, status, directions), media right. Not copied: the app promo.
- [Urban Outfitters store page](https://mobbin.com/screens/90b76f48-229b-4a56-845a-106e28a328f1): narrow facts column beside a wide map.
- [Apple Store "Map and Directions"](https://mobbin.com/screens/1b00890c-317b-4945-b939-08dfb14c3b47): address and "How to get here" beside a map. Not copied: the modal.

## Open items

1. Fixture `whyItMatters` needs rewriting as place copy, with sources for any factual claim, before the story layer can return. The fixture file belongs to the Explore work, so it wasn't edited here.
2. Browser pass at 390–1440 with screenshots, axe and LCP (hero raster now has `sizes`; the audit's 847 KB mobile LCP image should drop, unmeasured).
3. OSM fetch date lives in a doc comment, so `PlaceSources.tsx` repeats it as a constant. Moves to `locationSource.verifiedAt` when places read from Payload.
4. `menuAvailable` is true for Red Rooster and Sylvia's but no menu record exists in the fixture. The flag shows nothing on this page; menus wait for Payload `menus[]`.
