import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HARLEM_PLACE_PREVIEWS, getHarlemPlacePreview } from '@acme/app/features/explore/explore.store.ts';
import { MightsJsonLd, MightsPage, routes } from '@acme/ui/mights';
import { PlaceHero } from '../../../../components/place/PlaceHero';
import { PlaceNearby } from '../../../../components/place/PlaceNearby';
import { PlaceSources } from '../../../../components/place/PlaceSources';
import { nearbyLayout, nearbyPlaces } from '../../../../components/place/nearby';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export function generateStaticParams() {
  return HARLEM_PLACE_PREVIEWS.map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const place = getHarlemPlacePreview(slug);
  return place
    ? { title: place.name, description: place.shortDescription, alternates: { canonical: routes.place(place.id) } }
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
// No story layer: `whyItMatters` in the fixture is planning copy about the
// product ("A place detail can pair…", "Harlem Might can connect…"), not a
// sourced account of the place, and the catalogue holds no other long-form
// text. It returns, set in MightsProse, with the first sourced place story.
//
// No current layer: there is no per-place events reader. listEventsForDate
// returns a whole day across venues; filtering it here would hide every
// event without a venue relation. It returns with an events-by-place reader.
async function PlacePageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = getHarlemPlacePreview(slug);
  if (!place) notFound();
  const { lngLat } = place;
  const nearby = nearbyPlaces(place, HARLEM_PLACE_PREVIEWS);

  return (
    <MightsPage
      title={place.name}
      lead={place.shortDescription}
      crumbs={[
        { label: 'Explore', href: routes.explore() },
        { label: place.name, href: routes.place(place.id) },
      ]}
    >
      {/* Only fields the record can back: no description (editorial, unreviewed),
          no hours, status or accessibility properties. */}
      <MightsJsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'TouristAttraction',
          name: place.name,
          url: new URL(routes.place(place.id), SITE).href,
          ...(place.street ? { address: { '@type': 'PostalAddress', streetAddress: place.street } } : {}),
          ...(lngLat ? { geo: { '@type': 'GeoCoordinates', latitude: lngLat[1], longitude: lngLat[0] } } : {}),
        }}
      />
      <PlaceHero place={place} />
      <PlaceNearby place={place} nearby={nearby} />
      <PlaceSources place={place} showsDistances={nearbyLayout(nearby.length) !== 'none'} />
    </MightsPage>
  );
}
