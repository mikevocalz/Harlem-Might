# Today and Upcoming events

The existing `/today` page now has URL-backed Today and Upcoming controls.
`/events` keeps its existing query-preserving redirect to `/today`.

- Today means events overlapping the current New York calendar day.
- Upcoming means today plus the following 89 New York calendar days. The exact
  inclusive range is displayed, and ongoing multi-day events are included.
- Both views paginate 24 records at a time with total counts, Previous/Next
  links, and an empty-page recovery. Views reset to page 1 when switched.
- Upcoming preserves the reader’s chronological `startsAt,id` order; Today
  keeps scheduled events ahead of cancelled/postponed listings.
- Upcoming cards include dates and years. Cancelled/postponed records retain
  visible warnings and their source, but never offer tickets.
- Drafts remain excluded by both the query and existing anonymous Payload
  access control. No CMS, schema, credential, or production data changes.
- Native query keys include view, both dates, and page. Native and web refresh
  the calendar at New York midnight or resume. Vite excludes the live calendar
  from static prerendering and reads through the existing REST mount.

## Rendering and navigation contracts

Next.js and Expo share the existing Mights page, controls, cards, loader,
source links, motion and archival context. Vite's curator runtime retains its
existing semantic Card components and TanStack navigation; it does not import
Solito/Next-only rendering. The only added dependency is the existing
`@acme/app` workspace package for shared readers/formatting.

No global navigation, pane geometry, renderer, device-family policy or XR
session ownership changes. Existing phone tabs, foldable/tablet/headset
physical-right rails, web headers, and Explore panes are unchanged.

Native Back follows the existing Expo tab policy: Today returns to Explore,
without stepping through calendar query changes. Selecting the Today tab again
retains its view/page and can reuse the corresponding fresh query cache. Opening
a fresh `/today` link instead selects Today, page 1. Deep-link parameters are
normalized for the read/UI; invalid or repeated values use safe defaults.

Next retries inspect the selected cached range/page and immediately expire its
failure-only tag only when the result is unavailable, then refresh the current
URL. Successful entries carry no retry tag, so delayed concurrent retries cannot
evict a recovered listing. The server validates view/page and derives today’s
New York date; clients cannot supply cache tags or arbitrary date ranges.
This is a cache-recovery boundary, not comprehensive abuse prevention: sustained
outages and backend request throttling remain deployment concerns.
