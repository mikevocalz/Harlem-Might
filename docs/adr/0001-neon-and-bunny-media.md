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
