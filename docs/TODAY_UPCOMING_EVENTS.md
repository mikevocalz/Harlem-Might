# Today and Upcoming events

The existing `/today` page now has URL-backed Today and Upcoming controls.
`/events` keeps its existing query-preserving redirect to `/today`.

- Today means events overlapping the current New York calendar day.
- Upcoming means today plus the following 89 New York calendar days. The exact
  inclusive range is displayed, and ongoing multi-day events are included.
- Both views paginate 24 records at a time with total counts, Previous/Next
  links, and an empty-page recovery. Views reset to page 1 when switched.
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

Read before implementation: repository `AGENTS.md` and its full pinned
`mikevocalz-foldable-layouts` reference at commit
`256a97b132803fd2fb8049f7a120cef9cb641f41`. No checkout-local `.agents/skills`
directory was present.

## Verification on the implementation

Passed in the cloud workspace:

- Shared app: 630 tests, both feature and content TypeScript projects, ESLint.
- Mobile: 358 Node tests, TypeScript using available linked spatial forks, and
  targeted ESLint. The new route harness covers URL/back state, cache isolation,
  midnight/resume, cleanup and retry; these are not physical-device tests.
- Payload: 79 tests, TypeScript, targeted ESLint; transport checks preserve
  `draft: false`, anonymous access, range predicates and page metadata.
- Next.js: 24 tests, full project TypeScript and targeted ESLint.
- Next.js selective `/today` production build using
  `node apps/web/scripts/next.mjs build --debug-build-paths='app/(site)/today/page.tsx'`.
  This also ran full-project TypeScript and emitted the dynamic `/today` route.
  Local production HTTP smoke checks then passed for Today/Upcoming, page-2
  URL state, unavailable (not empty) copy, and the `/events` query-preserving redirect.
- Vite: TypeScript, targeted ESLint and complete production build. Production
  HTTP/SSR smoke checks against a local synthetic REST fixture verified Today,
  Upcoming, page 2, December dates, cancellation warnings, empty/error states,
  recovery at the same URL and `draft=false` on every REST read.
- Shared screen render tests cover active navigation semantics, date labels,
  pagination, empty/loading/error states and cancelled ticket suppression.

Validation limits:

- Two full Next.js builds were killed by the executor (exit 137), including a
  reduced-concurrency retry. The selective route build passed; a full build is
  still required in CI. No runtime changes were made to work around it.
- Installed headless Chromium could not create its process socket in this
  executor, including the supported elevated attempt (`Operation not permitted`).
  No browser interaction/screenshot or physical native-device pass is claimed.
- No deployed application URL was available, so live deployed visual validation
  was not performed. Nothing was merged or deployed.
