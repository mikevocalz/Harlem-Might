# Payload maintenance

This directory owns operational seed, enrichment, publishing, repair and cleanup
commands. Their import-safe helpers and adjacent unit tests live here too;
`data/music-artist-candidates.ts` retains the reproducible 105-artist catalogue.

Runtime configuration, collections, access rules, auth, fields, plugins,
walk-session services, migrations and generated Payload types stay in `src/`
outside this directory. The shared `artist-photo-fetch.ts` helper stays there
because it is used by the public server/web API and has a package export.
Maintenance modules are not public package exports and must not be imported by
runtime code.

## Commands

Run the existing package scripts from the repository root with
`pnpm --filter @acme/payload <command>`. Their names and arguments are unchanged;
only their source paths now start with `src/maintenance/`.

- Seeds: `seed:events`, `seed:media`, `seed:places`, `seed:places-nyc`,
  `seed:stories`, `seed:walks`, `seed:story-images`
- Publishing: `publish:walks`, `publish:music-artists`
- Enrichment: `enrich:osm`, `enrich:menus`
- Repair/linking: `patch:place-slugs`, `link:media`

The other existing tools remain direct commands, run from `packages/payload/`:

- `pnpm exec payload run src/maintenance/fix-place-coords.ts`
- `pnpm exec payload run src/maintenance/patch-place-locations.ts`
- `pnpm exec payload run src/maintenance/purge-offtopic-media.ts`

These are real operational commands, not verification commands. Check each tool
and its environment requirements before running it. The relocation does not add
any preview mode or change existing write behavior: in particular,
`patch-place-locations.ts` writes coordinates and `purge-offtopic-media.ts`
deletes matching media immediately. Never import an entrypoint to inspect it;
top-level code can connect to the database, fetch external data or write records.
All original SQL, datasets, provenance, rights requirements and apply/preview
policies remain with their owning tools. See the [image policy](../../../../docs/IMAGE_POLICY.md)
and [maintenance reporting contract](../../../../docs/DEVELOPMENT.md#place-maintenance-reporting).

## Story lead-image outcomes

`seed:story-images` previews by default; only `--apply` downloads and attaches
images. HTTP, transport, timeout and response-body download failures identify the
story, count toward the final summary and produce a nonzero exit status while
independent stories continue. Deliberate source/licensing/image skips and images
already in the lead position are not failures. Metadata, database, file-write
and cleanup errors remain fatal; temporary files are cleaned up before returning
an outcome. Existing metadata retries and image admission rules are unchanged.

## Offline verification

From the repository root:

```sh
pnpm --filter @acme/payload test
pnpm --filter @acme/payload typecheck
pnpm --filter @acme/payload lint
```

The unchanged recursive test glob discovers tests here, including the catalogue
subdirectory. Runner tests inject fake Payload/fetch calls; they never initialize
an entrypoint. `command-paths.test.ts` exercises the installed Payload run handler
and argument forwarding, but intercepts each successfully resolved entrypoint
with an inert module before any original source executes. It also resolves every
moved module/import through Payload's installed TypeScript loader without
importing them, and checks the existing public package exports. These checks need
no live database, network requests or maintenance writes.
