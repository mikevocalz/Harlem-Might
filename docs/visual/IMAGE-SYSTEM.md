# Editorial image system

## Scope

This document describes the implemented image-content slice. It is not a claim that Harlem Might has full commissioned-photography coverage yet. The current system provides one verified interim archival image and the contracts needed for CMS-managed editorial imagery.

## Content model

`packages/assets/editorial-images.ts` defines `EditorialImage`:

- `id`, `role` (`hero`, `gallery`, `historical`, `thumbnail`, `map_pin`)
- `url`, `altText`
- `source`, `sourceUrl`
- `license`, `licenseUrl`
- `creator`, `credit`, `attributionText`
- `capturedAt`, `ingestedAt`
- `width`, `height`, `aspect`
- `placeholderHash`, `dominantColor`
- `shareAlike`, `noDerivatives`
- `caption`

`isDisplayableEditorialImage` is the fail-closed gate. An image does not render unless it has a known role and source, an HTTP(S) image URL, alt text, a source URL, license text, a license URL, visible credit, visible attribution text, and explicit share-alike/no-derivatives flags.

`editorialImageContentFit` returns `contain` when an image has `noDerivatives` or no intrinsic aspect ratio. It returns `cover` only when cropping is allowed and the source dimensions are known.

## CMS fields

`packages/payload/src/collections/Media.ts` carries the provenance and rights fields above. `Places`, `Walks`, `Stories`, and `Events` each expose a has-many `images` relationship to Media.

The shared reader contract in `packages/app/content` maps populated Payload media through `mapEditorialImages`. Unpopulated ids and media missing required provenance are dropped before records reach UI code.

## Reader flow

1. Payload Media stores the file and rights metadata.
2. Place, walk, story, or event records relate to Media through `images`.
3. `mapEditorialImages` normalizes the document into `EditorialImage` and drops anything that fails the gate.
4. `PlaceRef`, `PlaceRecord`, `WalkRecord`, `StoryRecord`, and `EventRecord` carry normalized `images`.
5. `listPlaces()` feeds the catalogue surfaces and `getPlace(slug)` returns a `PlaceRecord` for place-detail imagery.
6. `MightsEditorialImage` renders image, loading/error state, caption, creator/credit, source link, and rights link.

## Current rendering surfaces

- Homepage archival feature in `apps/web/components/site/ProductHome.tsx`
- Explore/Discover pane in `packages/app/features/explore/ExploreMasterPane.tsx`
- Story article and story index in `apps/web/components/stories/`
- Walk index/detail and per-stop place images in `apps/web/components/walks/` and `apps/web/app/(site)/walks/[slug]/page.tsx`
- Today/event cards in `apps/web/components/today/TodayEvents.tsx`
- Place detail hero/gallery in `apps/web/components/place/PlaceHero.tsx`, backed by `getPlace(slug)`

The shared component is exported for web and native through `packages/ui/mights/index.ts` and `index.native.ts`. It uses the existing `packages/ui/Image.tsx` Solito boundary, which resolves to Next Image on web and `expo-image` on native.

## Load and error state

`packages/assets/editorialImage.store.ts` keeps Zustand state keyed by `${screenId}:${imageId}`. A failed or loaded image on one screen cannot change the state shown for the same asset on another screen. Loading and error states are visible text overlays, not a white spinner or gray placeholder.

## Tests

Focused coverage currently includes:

- rights and attribution validation
- NYPL provenance wording
- intrinsic aspect handling
- no-derivatives crop protection
- CMS-to-record mapping for places, walks, stories, and events
- per-screen/image load-state isolation

## Not yet implemented

- Commissioned photography library or ingest contracts
- Responsive transform pipeline, BlurHash/ThumbHash generation, or dominant-color extraction at ingest
- Custom Mapbox Studio style, marker set, or camera choreography
- Complete screen coverage on native, tablet, foldable, Horizon, or visionOS-style surfaces
- Device FPS/memory measurements or visual-regression baselines
- Takedown automation beyond removing the asset/relationship and redeploying
