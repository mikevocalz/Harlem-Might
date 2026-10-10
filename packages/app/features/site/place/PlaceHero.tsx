import type { ExplorePlace } from '@acme/app/features/explore/explore.store.ts';
import { HARLEM_ARCHIVAL_IMAGES, type EditorialImage, type PlaceRecord } from '@acme/app/content';
import { Badge } from '@acme/ui';
import { Link, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import {
  MapAttribution,
  MightsButton,
  MightsEditorialImage,
  MightsHeading,
  MightsLocationStamp,
  MightsMapImage,
  MightsNotchCard,
  mapboxStaticUrl,
  MightsText,
  routes,
} from '@acme/ui/mights';
import { PlaceGallery } from './PlaceGallery.tsx';
import { PlaceHours } from './PlaceHours.tsx';

// /places/[slug], top of page (docs/design/handoff/PLACE.md). The masthead is
// always the carousel: the place's own photographs when it has them, otherwise
// the satellite frame of the block plus archival Harlem pictures. Below it,
// one visit card holds the facts (address, phone, website, hours) beside a
// second picture.

const link = 'mights-focus text-primary underline underline-offset-4 hover:no-underline';

function hashSlug(slug: string): number {
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

/** A stable archive photograph for a place without its own: same place, same picture. */
function archiveFor(slug: string): EditorialImage | undefined {
  return HARLEM_ARCHIVAL_IMAGES[hashSlug(slug) % HARLEM_ARCHIVAL_IMAGES.length];
}

/** A stable run of archive photographs for a place: same place, same set. */
function archivesFor(slug: string, count: number): EditorialImage[] {
  const start = hashSlug(slug) % HARLEM_ARCHIVAL_IMAGES.length;
  return Array.from({ length: count }, (_, i) => HARLEM_ARCHIVAL_IMAGES[(start + i) % HARLEM_ARCHIVAL_IMAGES.length]!);
}

/** The satellite frame as a gallery slide, so the map sits inside the carousel. */
function mapSlide(place: ExplorePlace, where: string): EditorialImage | undefined {
  const { lngLat } = place;
  if (!lngLat) return undefined;
  const url = mapboxStaticUrl({
    center: lngLat,
    zoom: 17.4,
    // ADR-04 route map: place hero pitch stays at or under 30.
    pitch: 30,
    bearing: -29,
    width: 960,
    height: 720,
    pins: [{ lngLat }],
  });
  if (!url) return undefined;
  return {
    id: `place-${place.id}-map`,
    role: 'map_pin',
    url,
    altText: `Satellite view of ${place.name}, ${where}`,
    source: 'other',
    sourceUrl: 'https://www.mapbox.com/',
    license: '© Mapbox © OpenStreetMap © Maxar',
    licenseUrl: 'https://www.mapbox.com/legal/tos',
    credit: 'Mapbox',
    attributionText: '© Mapbox © OpenStreetMap © Maxar',
    shareAlike: false,
    noDerivatives: true,
  };
}

/** The `media` slot of MightsPage: the place's photos, or location images — the satellite frame and archival Harlem. */
export function PlaceMasthead({ place, images }: { place: ExplorePlace; images: readonly EditorialImage[] }) {
  const where = place.street ?? place.area;
  const slides = images.length
    ? images
    : [mapSlide(place, where), ...archivesFor(place.id, 2)].filter((i): i is EditorialImage => i !== undefined);
  if (slides.length) return <PlaceGallery images={slides} placeId={place.id} name={place.name} street={where} />;
  return (
    <MightsNotchCard className="aspect-4/3">
      <View className="h-full items-start justify-end bg-surface-sunken p-5">
        <MightsText size="small">Location pending verification</MightsText>
      </View>
    </MightsNotchCard>
  );
}

/** The chips under the title: category, area and open-now status at a glance. */
export function PlaceTags({ place }: { place: ExplorePlace }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      <Badge label={place.category} tone="primary" />
      <Badge label={place.area} />
    </View>
  );
}

export function PlaceVisit({
  place,
  hours,
  hasPhotos,
  now,
}: {
  place: ExplorePlace;
  hours?: PlaceRecord['openingHours'];
  hasPhotos: boolean;
  now: Date;
}) {
  const { lngLat } = place;
  const where = place.street ?? place.area;
  const archive = hasPhotos ? undefined : archiveFor(place.id);
  // Link text is the host alone; the full path wraps badly on phones.
  const site = place.website?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];

  return (
    <Section aria-labelledby="place-visit" className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-6">
      <View className="gap-6 md:col-span-5">
        <MightsNotchCard>
          <View className="gap-5 p-6">
            <MightsHeading level={2} size="title" id="place-visit">
              Visit
            </MightsHeading>
            <PlaceTags place={place} />
            <View className="gap-2">
              <MightsHeading level={3} size="card">
                Address
              </MightsHeading>
              <MightsText tone="default">{where}</MightsText>
              {lngLat ? (
                <>
                  <View className="flex-row flex-wrap gap-3 pt-1">
                    <MightsButton
                      external
                      size="sm"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${lngLat[1]},${lngLat[0]}`}
                    >
                      Get directions
                    </MightsButton>
                    <MightsButton href={routes.explore({ place: place.id })} variant="secondary" size="sm">
                      See it on the map
                    </MightsButton>
                  </View>
                  {/* The point is a geocode, not a surveyed door (audit §7, locationAccuracy "approx"). */}
                  <MightsText size="small">Directions go to the map point, not to a checked entrance.</MightsText>
                </>
              ) : (
                <MightsText size="small">Directions open once the location is verified.</MightsText>
              )}
            </View>
            {place.phone || site ? (
              <View className="gap-2 border-t border-rule-hairline pt-4">
                <MightsHeading level={3} size="card">
                  Contact
                </MightsHeading>
                {place.phone ? (
                  <MightsText tone="default">
                    <Link className={link} href={`tel:${place.phone.replace(/[^\d+]/g, '')}`}>
                      {place.phone}
                    </Link>
                  </MightsText>
                ) : null}
                {place.website && site ? (
                  <MightsText tone="default">
                    <Link className={link} href={place.website} rel="noopener noreferrer" target="_blank">
                      {site}
                    </Link>
                  </MightsText>
                ) : null}
                {place.menus?.map((menu) => (
                  <MightsText key={menu.url} size="small">
                    <Link className={link} href={menu.url} rel="noopener noreferrer" target="_blank">
                      {menu.label}
                    </Link>
                  </MightsText>
                ))}
              </View>
            ) : null}
            <View className="border-t border-rule-hairline pt-4">
              {hours && (hours.osm || hours.note) ? (
                <PlaceHours hours={hours} now={now} />
              ) : (
                <MightsText size="small">
                  No published hours for this place yet. Check with the place before you go.
                </MightsText>
              )}
            </View>
          </View>
        </MightsNotchCard>
        <MightsButton href={routes.explore({ category: place.category })} variant="secondary" size="sm">
          {`More ${place.category.toLowerCase()} on the map`}
        </MightsButton>
      </View>

      <View className="gap-6 md:col-span-7">
        {lngLat ? (
          <View className="gap-2">
            <MightsNotchCard className="aspect-video">
              <View className="relative h-full">
                <MightsMapImage
                  center={lngLat}
                  zoom={15.2}
                  width={1120}
                  height={630}
                  sizes="(min-width: 768px) 58vw, 100vw"
                  pins={[{ lngLat }]}
                  alt={`Map of the blocks around ${place.name}`}
                />
                <MightsLocationStamp name={place.name} street={where} className="absolute bottom-4 left-4" />
              </View>
            </MightsNotchCard>
            <MapAttribution />
          </View>
        ) : null}
        {archive ? (
          <View className="gap-2">
            <MightsEditorialImage
              image={archive}
              screenId={`place-archive-${place.id}`}
              ratio="wide"
              sizes="(min-width: 768px) 58vw, 100vw"
            />
            <MightsText size="small">Harlem in the archive. Not a photograph of this place.</MightsText>
          </View>
        ) : null}
      </View>
    </Section>
  );
}
