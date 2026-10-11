# Member-session PR repair verification

Verified on 2026-10-11 against PR #56 head `54cd4a5373fb99c3a2d6e878ba15524ee0e6ce43`
and main `c9474820635b0a5168104e31f02b8f39a8671a08`.

## Integration

Six conflicts were resolved: the site layout, music detail/index screens, music
query keys, app provider exports, and Payload server readers. Main's verified
artist-photo resolver, grid, detail photo, 105-record catalogue, rights-cleared
photo persistence, and workflow changes are retained. The member UI and paginated
directory remain present. No workflow requirements were removed or weakened.

The auth entry/store repairs from #67 (`aaee7e9`) are included at their source
branch without importing its journey/watch features or changing any other branch.
Later integration should preserve the auth files in this branch, which include
those repairs plus the follow-on fixes below. #54 remains a backend prerequisite.

## Defects covered

- Session, saved-place, profile, and avatar continuations are fenced by initiating
  owner, origin, and session lifetime, including authentication before cookie writes.
- A photo picker opened by an older identity or a closed profile cannot upload into
  the current account. Same-owner refresh preserves the open picker and edit form.
- Failed HTTP/network logout presents a retry path. Private data stays cleared even
  when window focus tries to refresh the still-valid cookie.
- Post-login navigation has one profile destination; blank names fall back to email.
  The inline map link uses native-safe internal navigation.
- Infinite pagination does not interrupt a reconnect refresh or automatically retry
  a failed page. Repeated events cannot cancel the active page request.
- Music pages use `name,id` ordering through both content transports.
- The publishing utility reads all pages before writes, continues after individual
  update failures, and returns nonzero on failures. Tests use mocks; it was not run
  against any database.
- Member uploads must be raster avatar files. Positive file-byte detection and Payload dimension
  probing reject text/PDF/SVG disguised as PNG, including caller-forged dimensions.
  Member metadata is restricted to alt text before server-generated upload fields;
  editorial provenance and caller-selected storage prefixes cannot be submitted.
  Curator upload formats are preserved; media update/delete explicitly require curators.
- Bunny's storage-only adapter returns redundant document metadata that Payload 4
  attempts to update under the member's restricted access. A request-local hook
  wrapper suppresses only a no-op update for the freshly created media ID: every
  field must equal the persisted snapshot, apart from the exact null video marker.
  It never elevates access or mutates the shared Payload instance. Unexpected
  metadata, other IDs, and external updates retain the original access checks.
- Shared safety fixes from #66 validate free-photo licenses and public DNS answers,
  reject redirects, and bound metadata/image response sizes and total read time.
  CMS image ingestion retains its 20 MiB ceiling. Only these shared repairs were
  backported; #66's catalogue and new image-proxy features are not included.
- The generic wrong-person image test now uses an uncurated name; the dedicated
  Charles Hamilton test continues checking its verified Commons source.

## Validation

- Shared app: 449 passing tests; Payload: 38; web: 22; mobile: 173; mobile scripts:
  7; spatial/widgets: 28. Two additional mobile test files cannot load the private
  Viro dependency. Total successful tests: 717.
- App/content, Payload, and web typechecks pass. Aggregate build/typecheck/lint passes
  25 of 28 tasks; mobile lint/typecheck require the private spatial dependencies.
  The parallel Next build was killed with exit 137. An isolated Next production
  build then passed completely, including TypeScript, static generation, `/profile`
  and `/music`, and a nonempty `BUILD_ID`.
- Focused independent code review passed 67 auth/profile/pagination tests after
  addressing its findings. `git diff --check` passes.
- Sixteen media/storage tests plus the final shared-photo backports pass the
  standalone app/Payload/web suites and typechecks; Payload and affected app/web
  lint pass with one pre-existing unused-import warning in `seed-places.ts`. The
  final server-only delta was not rebuilt in standalone #56. The combined #67
  candidate (tree `79675ce`) separately passed its complete Next production build
  including these same admission/storage/photo changes; that is integration
  evidence, not a claim that standalone #56 was rebuilt.
- Existing dependencies were reused/copied for validation. This is not a fresh
  frozen-install pass. Exact-head hosted CI must still validate private dependency
  access and all required gates.

## Remaining acceptance limits

Browser-cookie and native-device end-to-end tests, real photo-picker behavior,
production signup, and deployment were not performed. Abort cannot roll back a
server-accepted request or prove safety across unobserved cross-tab cookie changes.

Member media creation is public-storage admission, not a per-member ownership or
cleanup system. Direct update/delete already required curators and now say so
explicitly. The member-create metadata allowlist also prevents a storage-prefix
collision path from selecting an existing editorial object destination. Raster
admission uses positive byte detection plus Payload's dimension probe, not client
MIME alone. Tests exercise the installed generation/storage hooks with local
adapters; they do not upload to live Bunny storage. The multipart parser
limits individual files to 20 MiB and requests to 50 MiB, but cumulative member
quotas and abandoned-avatar cleanup still need a product/storage policy. This
repair does not claim those acceptance decisions are complete.
