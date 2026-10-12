# ADR: Neon Postgres and Bunny Media

## Decision

Harlem Might uses Neon Postgres as the application database and Bunny Storage + Bunny CDN as the production media backend.

- Neon owns PostgreSQL data used by Payload.
- Payload 4 remains the CMS/admin/API layer and stores media metadata in Postgres.
- Bunny Storage + CDN owns uploaded media bytes and delivery.
- Supabase is not part of the Harlem backend.
- Payload's Admin Media collection must upload, preview, bulk-upload, replace, and delete against Bunny rather than local server disk.

## Bunny/Payload 4 implementation

The Bunny integration follows the known-good MoyoLearn Payload 4 implementation:

- @seshuk/payload-storage-bunny@3.0.0
- Payload 4 cloud-storage support is pinned to @payloadcms/plugin-cloud-storage@4.0.0-canary.33.
- The MoyoLearn Payload 4 compatibility patch for initClientUploads is carried in patches/@seshuk__payload-storage-bunny@3.0.0.patch.
- Media is namespaced under BUNNY_MEDIA_PREFIX so Harlem objects are isolated inside the Bunny storage zone.
- Bunny storage credentials are server-only.
- NEXT_PUBLIC_BUNNY_CDN_BASE_URL is the only public Bunny value.

### Safe remote reads on the pinned adapter

Cloud-storage canary.33 couples `disablePayloadAccessControl: true` (public CDN delivery) to `upload.skipSafeFetch: true`. The application’s Bunny boundary resets `skipSafeFetch` to `false` after the plugin runs, preserving CDN URLs while restoring Payload’s private-address and redirect checks. This is the narrow app-level mitigation for the [upstream storage security change](https://payloadcms.com/posts/blog/payload-security-update-available-for-3x-and-40); it grants no URL-upload allowlist or additional collection access.

The runtime regression suite loads the actual application config through Payload 4’s sanitizer with Bunny enabled/absent in production/development. It covers private IPs and DNS, redirects, public CDN reads, member PNG processing, curator access, and rejection of arbitrary URL uploads without contacting Bunny or a database: `pnpm --filter @acme/payload exec node --test src/plugins/storage-safe-fetch.test.ts`.

This boundary does not align the full storage adapter API. Do not independently bump the cloud-storage pin: Bunny 3.0.0 lacks the `deleteFile` and `copyFile` operations required by newer Payload 4 cloud-storage adapters. A future alignment needs its own lifecycle verification; it must not silently alter the live schema or storage configuration.

## Environment

Required production values:

- DATABASE_URL
- PAYLOAD_SECRET
- BUNNY_STORAGE_ZONE_NAME
- BUNNY_STORAGE_REGION
- BUNNY_STORAGE_ACCESS_KEY
- BUNNY_MEDIA_PREFIX
- NEXT_PUBLIC_BUNNY_CDN_BASE_URL

DATABASE_URL should point at the Neon project and use TLS.

## Admin behavior

The Payload media collection remains a normal upload collection. The Bunny adapter owns the physical file lifecycle while Payload owns the metadata.

The Admin panel therefore remains the normal Payload Media UI for:

- single upload
- bulk upload
- thumbnails/previews
- replacement
- deletion
- CDN-backed URLs

Production deployments must not rely on Payload's local filesystem for persistent media.

## Why we copy MoyoLearn

MoyoLearn already runs Payload 4 with Bunny storage and has a verified Payload 4 compatibility patch for the Bunny adapter. Harlem uses that implementation instead of creating a second custom storage adapter or maintaining divergent Bunny semantics.

## Verification

Before production rollout, verify:

1. Payload Admin upload creates an object under the Harlem Bunny prefix.
2. The returned media URL is the Bunny CDN URL.
3. Admin bulk upload works.
4. Replacing media removes/replaces the Bunny object correctly.
5. Deleting media removes the Bunny object.
6. No production upload writes to local disk.
7. A Neon-backed Payload restart retains media metadata while Bunny retains the media bytes.
