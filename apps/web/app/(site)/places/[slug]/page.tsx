import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';
import { cachedExploreCatalogue, cachedPlace, cachedPlaceByLegacySlug, cachedStories } from '@/lib/cached-content';
import type { EditorialImage, PlaceRecord } from '@acme/app/content';
import { getHarlemPlacePreview, type ExplorePlace } from '@acme/app/features/explore/explore.store.ts';
import { explorePlaceFromRecord } from '@acme/app/features/explore/catalogue.ts';
import { MightsButton, MightsJsonLd, MightsPage, routes } from '@acme/ui/mights';
import { ContentNotice } from '@acme/app/features/site/content/ContentNotice.tsx';
import { PlaceMasthead, PlaceVisit } from '@acme/app/features/site/place/PlaceHero.tsx';
import { PlaceStories, storiesAbout } from '@acme/app/features/site/place/PlaceStories.tsx';
import { PlaceNearby } from '@acme/app/features/site/place/PlaceNearby.tsx';
import { PlaceSources } from '@acme/app/features/site/place/PlaceSources.tsx';
import { nearbyLayout, nearbyPlaces } from '@acme/app/features/site/place/nearby.ts';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

interface ResolvedPlace {
  place: ExplorePlace;
  images: EditorialImage[];
  hours?: PlaceRecord['openingHours'];
}

// The catalogue is dynamic — thousands of imported rows — so place pages
// render on demand rather than as static params.
async function resolvePlace(slug: string): Promise<ResolvedPlace | 'unavailable' | null> {
  const result = await cachedPlace(slug);
  if (result.status === 'ok')
    return { place: explorePlaceFromRecord(result.data), images: result.data.images, hours: result.data.openingHours };
  if (result.status === 'not-found') {
    // Imported rows once used osm-node-* / lpc-* / mon-* paths. Those stay
    // resolvable, but the canonical public URL is always the name-led slug.
    const legacy = await cachedPlaceByLegacySlug(slug);
    if (legacy.status === 'ok') permanentRedirect(routes.place(legacy.data.slug));
    if (legacy.status === 'unavailable') return 'unavailable';
    return null;
  }
  // No database in this process keeps the fixture places routable in dev.
  const fixture = getHarlemPlacePreview(slug);
  return fixture ? { place: fixture, images: [] } : 'unavailable';
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolvePlace(slug);
  return resolved && resolved !== 'unavailable'
    ? {
        title: resolved.place.name,
        description: resolved.place.shortDescription,
        alternates: { canonical: routes.place(resolved.place.id) },
      }
    : {};
}

// The permanent redirect for generated source-id paths can only be a real 308
// before the first byte streams, so the place resolution deliberately happens
// before the shell — `instant = false` keeps this route server-rendered
// (dynamic `connection()` read) rather than prerendered.
export const instant = false;

export default async function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const resolved = await resolvePlace(slug);
  return (
    <Suspense>
      <PlacePageContent resolved={resolved} />
    </Suspense>
  );
}

// Layers, top to bottom: hero + visit, nearby (B5), sources. Composition map
// and states: docs/design/handoff/PLACE.md.
//
// No story layer: place rows carry no reviewed long-form text, so there is
// nothing sourced to render. It returns, set in MightsProse, with the first
// sourced place story.
//
// No current layer: there is no per-place events reader. listEventsForDate
// returns a whole day across venues; filtering it here would hide every
// event without a venue relation. It returns with an events-by-place reader.
async function PlacePageContent({ resolved }: { resolved: ResolvedPlace | 'unavailable' | null }) {
  if (resolved === 'unavailable') {
    return (
      <ContentNotice
        title="We couldn’t load this place right now"
        actions={<MightsButton href={routes.explore()}>Open the map</MightsButton>}
      >
        Our records didn’t answer. Try again in a moment, or start from the map.
      </ContentNotice>
    );
  }
  if (!resolved) notFound();
  const { place, images, hours } = resolved;
  const { lngLat } = place;

  const [catalogue, stories] = await Promise.all([cachedExploreCatalogue(), cachedStories()]);
  const related = stories.status === 'ok' ? storiesAbout(place, stories.data) : [];
  const nearby =
    catalogue.status === 'ok'
      ? nearbyPlaces(place, catalogue.data.map(explorePlaceFromRecord))
      : nearbyPlaces(place, []);

  return (
    <MightsPage
      title={place.name}
      lead={place.shortDescription ?? `${place.category} in ${place.area}.`}
      media={<PlaceMasthead place={place} images={images} />}
      crumbs={[
        { label: 'Explore', href: routes.explore() },
        { label: place.name, href: routes.place(place.id) },
      ]}
    >
      {/* Only fields the record can back: no editorial description, no status
          or accessibility properties. Hours stay out — the raw OSM string is
          not schema.org's openingHoursSpecification shape. */}
      <MightsJsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'TouristAttraction',
          name: place.name,
          url: new URL(routes.place(place.id), SITE).href,
          ...(place.website ? { sameAs: place.website } : {}),
          ...(place.phone ? { telephone: place.phone } : {}),
          ...(place.street ? { address: { '@type': 'PostalAddress', streetAddress: place.street } } : {}),
          ...(lngLat ? { geo: { '@type': 'GeoCoordinates', latitude: lngLat[1], longitude: lngLat[0] } } : {}),
        }}
      />
      <PlaceVisit place={place} hours={hours} hasPhotos={images.length > 0} now={new Date()} />
      <PlaceStories place={place} stories={related} />
      <PlaceNearby place={place} nearby={nearby} />
      <PlaceSources place={place} showsDistances={nearbyLayout(nearby.length) !== 'none'} />
    </MightsPage>
  );
}
