# packages/app/content

Read contract for published Walks, Stories and Events. Nothing in this package seeds or changes production records.

## Where to import from

| Need | Import |
|---|---|
| Call a reader from a Server Component or route handler | `@acme/payload/server` |
| Types, the result union, `harlemToday()` / `isHarlemDate()` | `@acme/app/content` |

The readers are bound to Payload in `packages/payload/server.ts` because `packages/app` may not import Payload (`packages/config/eslint/boundaries.mjs`, `FORBID_BACKEND_DIRECT`). `@acme/payload/server` imports `server-only`, so pulling it into a client bundle fails the build.

## Readers

| Function | Returns |
|---|---|
| `listWalks()` | `ContentResult<WalkRecord[]>`, newest update first |
| `getWalk(slug)` | `DetailResult<WalkRecord>` |
| `listStories()` | `ContentResult<StoryRecord[]>`, newest `publishedAt` first |
| `getStory(slug)` | `DetailResult<StoryRecord>` |
| `listEventsForDate(dateInNY)` | `ContentResult<EventRecord[]>`, earliest start first |
| `listEventsForDateRange(startDateInNY, endDateInNY, page = 1)` | `ContentResult<EventPage>`, 24 records per page, start/id order |
| `listMusicArtistsPage(page = 1)` | `ContentResult<MusicArtistPage>`, 24 artists per page, name/id order |

Every query filters on `_status = published` and runs with `overrideAccess: false`, so the anonymous read rule applies as well. Drafts never come back. Non-paginated editorial lists cap at 100 (`LIST_LIMIT`); the paginated event reader returns `events`, `hasNextPage`, and `totalDocs`.

## Source queries and projections

`ContentSource.find` and `findPage` return collection-specific documents when
`select` is omitted. An include-list returns `ContentDocument<Collection,
Selection>`: the implicit `id` plus only the contract fields known to be
selected. A literal `select: ['title']` on walks exposes `id` and `title`, not
`summary`, and cannot be passed to a mapper that needs a whole `WalkDoc`.
Selected optional fields keep their original nullability/optionality.

Keep a reusable selection as a readonly tuple (`as const`) for precise fields.
A runtime string array, an optional selection, or a broadly annotated
`ContentQuery` remains supported, but its result cannot promise fields the query
might omit. Supplying just the collection generic explicitly also uses that
conservative result for selected queries. The Explore include-lists select all
required `PlaceDoc` fields, so the existing mapper remains valid while optional
detail facts stay absent.

Field strings still pass through unchanged, including names outside the minimal
reader document contract; these do not acquire invented field types. An empty
include-list guarantees only `id` across transports: the Local API receives
`select: {}` and returns id-only, while REST emits no selection parameters and
can return more. No selection behavior or CMS schema is changed by the types.

The Payload binding lives in `packages/payload/src/content-source.ts` and is
wired to `getPayload` only by the server-only entry point. Its generated-document
drift check and compiler fixtures protect the collection contract; offline tests
run the installed Payload Local API and real Places schema over an in-memory
adapter to verify projection, paging and reader mapping. The REST boundary
checks the response envelope, but does not validate every field of trusted CMS
JSON at runtime.

## Failure semantics

```ts
type ContentResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'unavailable'; reason: 'not-configured' }
  | { status: 'unavailable'; reason: 'query-failed'; error: Error };

type DetailResult<T> = ContentResult<T> | { status: 'not-found' };
```

- `ok` with `[]`: the database answered and nothing is published. Show the empty state.
- `unavailable`: we could not check. Say so ("Couldn't load walks right now"), never the empty state, and never 404. `not-configured` means `DATABASE_URL` is unset in this process; `query-failed` carries the error for logging.
- `not-found` (detail reads only): the database answered and no published record has that slug. Call `notFound()`.

A malformed slug returns `not-found` without a query when the content source is
configured. If it is unconfigured, the reader returns `unavailable` with reason
`not-configured`, including for malformed slugs.

`listMusicArtistsPage` accepts positive safe integer page numbers and defaults to page 1. Zero, negative, fractional, non-finite and unsafe page numbers reject with `RangeError` before configuration checks or database queries, even when content is unconfigured. Valid reads keep the usual `unavailable` behavior for missing configuration or query failures.

## Events and Harlem time

`listEventsForDate('2026-10-07')` returns published events that overlap that New York calendar day: `startsAt` before the next local midnight and `endsAt` after this one. The window is computed in `America/New_York`, so 23- and 25-hour DST days work and "today" after 8 pm EDT is not tomorrow. Get today's date with `harlemToday()`. The function throws `RangeError` on an invalid date; validate route params with `isHarlemDate()` and 404 first.

`listEventsForDateRange` accepts an inclusive range of at most 90 calendar days. Use `addHarlemDays(date, 89)` for the Upcoming window; elapsed hours are not calendar days across DST. Invalid, reversed or oversized ranges and non-positive/unsafe pages reject with `RangeError`.

Cancelled and postponed events are returned with their `status` so the page can label them. Each record carries `sourceUrl`, `fetchedAt` and `lastVerifiedAt`; show the source and "Checked {date}" next to every event.

## Mapping rules

- A walk stop whose place was deleted keeps its position with `place: undefined`, so the stop count stays true.
- An accessibility note without a source URL is dropped.
- Story archive items whose image is missing are dropped. Unpopulated place links are dropped.
- Payload `null` becomes `undefined`. Dates stay ISO strings so records serialise across the RSC boundary.

## Tests

```sh
cd packages/app && node --test 'content/**/*.test.ts'
```

`harlem-time.test.ts` covers DST, rollover and validation. `readers.test.ts` drives the factory with an in-memory source: unavailable versus empty, published-only filters, the event window, and the record mapping.

`selection-types.test.ts` runs the TypeScript compiler on accepted consumers and
`@ts-expect-error` rejection cases. The Payload binding's corresponding compiler
and offline Local API checks run with:

```sh
cd packages/payload && node --test src/content-source.test.ts
```
