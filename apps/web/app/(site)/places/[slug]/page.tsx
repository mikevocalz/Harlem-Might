import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { getPlace, listExploreCatalogue } from '@acme/payload/server';
import type { EditorialImage } from '@acme/app/content';
import { getHarlemPlacePreview, type ExplorePlace } from '@acme/app/features/explore/explore.store.ts';
import { explorePlaceFromRecord } from '@acme/app/features/explore/catalogue.ts';
import { MightsButton, MightsJsonLd, MightsPage, routes } from '@acme/ui/mights';
import { ContentNotice } from '../../../../components/content/ContentNotice';
import { PlaceHero } from '../../../../components/place/PlaceHero';
import { PlaceNearby } from '../../../../components/place/PlaceNearby';
import { PlaceSources } from '../../../../components/place/PlaceSources';
import { nearbyLayout, nearbyPlaces } from '../../../../components/place/nearby';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

interface ResolvedPlace {
  place: ExplorePlace;
  images: EditorialImage[];
}

// The catalogue is dynamic — thousands of imported rows — so place pages
// render on demand rather than as static params.
async function resolvePlace(slug: string): Promise<ResolvedPlace | 'unavailable' | null> {
  const result = await getPlace(slug);
  if (result.status === 'ok') return { place: explorePlaceFromRecord(result.data), images: result.data.images };
  if (result.status === 'not-found') return null;
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

// params are awaited inside Suspense so the route can prerender a shell
// (Cache Components: 'Await params inside <Suspense>').
export default function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense>
      <PlacePageContent params={params} />
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
async function PlacePageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connection();
  const resolved = await resolvePlace(slug);
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
  const { place, images } = resolved;
  const { lngLat } = place;

  const catalogue = await listExploreCatalogue();
  const nearby =
    catalogue.status === 'ok'
      ? nearbyPlaces(place, catalogue.data.map(explorePlaceFromRecord))
      : nearbyPlaces(place, []);

  return (
    <MightsPage
      title={place.name}
      lead={place.shortDescription}
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
      <PlaceHero place={place} images={images} />
      <PlaceNearby place={place} nearby={nearby} />
      <PlaceSources place={place} showsDistances={nearbyLayout(nearby.length) !== 'none'} />
    </MightsPage>
  );
}
