# packages/app/content

Read contract for Walks, Stories and Events. No records exist in any of these collections yet, and nothing here seeds them.

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

Every query filters on `_status = published` and runs with `overrideAccess: false`, so the anonymous read rule applies as well. Drafts never come back. Lists cap at 100 (`LIST_LIMIT`).

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

A malformed slug returns `not-found` without a query.

## Events and Harlem time

`listEventsForDate('2026-10-07')` returns published events that overlap that New York calendar day: `startsAt` before the next local midnight and `endsAt` after this one. The window is computed in `America/New_York`, so 23- and 25-hour DST days work and "today" after 8 pm EDT is not tomorrow. Get today's date with `harlemToday()`. The function throws `RangeError` on an invalid date; validate route params with `isHarlemDate()` and 404 first.

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
