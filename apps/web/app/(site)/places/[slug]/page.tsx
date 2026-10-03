import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HARLEM_PLACE_PREVIEWS, getHarlemPlacePreview, placesNear } from '@acme/app/features/explore/explore.store.ts';
import { Section, View } from '@acme/ui/tw';
import {
  MapAttribution,
  MightsBand,
  MightsButton,
  MightsJsonLd,
  MightsLocationStamp,
  MightsMapImage,
  MightsNotchCard,
  MightsPage,
  MightsPlaceBento,
  MightsText,
  routes,
} from '@acme/ui/mights';

export function generateStaticParams() {
  return HARLEM_PLACE_PREVIEWS.map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const place = getHarlemPlacePreview(slug);
  return place ? { title: place.name, description: place.shortDescription } : {};
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

async function PlacePageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = getHarlemPlacePreview(slug);
  if (!place) notFound();
  const lngLat = place.lngLat;

  return (
    <MightsPage
      title={place.name}
      lead={place.shortDescription}
      crumbs={[
        { label: 'Explore', href: routes.explore() },
        { label: place.name, href: routes.place(place.id) },
      ]}
    >
      <MightsJsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'TouristAttraction',
          name: place.name,
          description: place.shortDescription,
          ...(lngLat ? { geo: { '@type': 'GeoCoordinates', latitude: lngLat[1], longitude: lngLat[0] } } : {}),
        }}
      />
      <Section className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-6">
        <View className="gap-6 md:col-span-5">
          <MightsLocationStamp name={place.name} street={place.street ?? place.area} />
          <MightsText>{place.whyItMatters}</MightsText>
          <View className="flex-row flex-wrap gap-3">
            {lngLat ? (
              <MightsButton
                external
                href={`https://www.google.com/maps/dir/?api=1&destination=${lngLat[1]},${lngLat[0]}`}
              >
                Get directions
              </MightsButton>
            ) : null}
            <MightsButton href={routes.explore({ place: place.id })} variant="secondary">
              Back to the map
            </MightsButton>
          </View>
        </View>
        <View className="md:col-span-7">
          <MightsNotchCard className="aspect-[16/10]">
            {lngLat ? (
              <MightsMapImage
                center={lngLat}
                zoom={16.8}
                pitch={45}
                width={1120}
                height={700}
                pins={[{ lngLat }]}
                alt={`Map of ${place.name}`}
                priority
              />
            ) : (
              <View className="h-full items-start justify-end bg-surface-sunken p-5">
                <MightsText size="small">Location pending verification</MightsText>
              </View>
            )}
          </MightsNotchCard>
          {lngLat ? <MapAttribution className="mt-2 block" /> : null}
        </View>
      </Section>
      <MightsBand title="Nearby">
        <MightsPlaceBento places={placesNear(place.id, 3)} />
      </MightsBand>
    </MightsPage>
  );
}
