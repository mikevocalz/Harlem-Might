import type { ExplorePlace } from '@acme/app/features/explore/explore.store.ts';
import { Link } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { MightsBand, MightsText } from '@acme/ui/mights';

// "Where did the information come from?" (pack prompt 05, question 9). One
// line per kind of fact the page shows, nothing for facts it doesn't show.
// Map imagery credit sits under each map (MapAttribution), not repeated here.

/**
 * When the fixture's coordinates were read from Nominatim; catalogue records
 * carry their own `locationSource.verifiedAt` (`sourceReadAt`).
 */
const OSM_FETCHED = 'October 3, 2026';

const link = 'mights-focus text-primary underline hover:text-text';

const readAt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export function PlaceSources({ place, showsDistances }: { place: ExplorePlace; showsDistances: boolean }) {
  return (
    <MightsBand title="Where this comes from">
      <View className="max-w-content-detail gap-4">
        {place.lngLat && place.osm ? (
          <MightsText>
            Map point: OpenStreetMap{' '}
            <Link
              className={link}
              href={`https://www.openstreetmap.org/${place.osm}`}
              target="_blank"
              rel="noreferrer"
            >
              {place.osm}
            </Link>
            , fetched {place.sourceReadAt ? readAt(place.sourceReadAt) : OSM_FETCHED}. It marks the place, not a
            checked entrance.
          </MightsText>
        ) : place.lngLat ? (
          <MightsText>Map point: on the map, but its source isn&apos;t recorded yet.</MightsText>
        ) : (
          <MightsText>
            Map point: none yet. {place.name} stays off the map until its location is verified.
          </MightsText>
        )}
        {place.shortDescription ? (
          <MightsText>
            Description: written by Harlem Might and not yet checked against official sources.
          </MightsText>
        ) : (
          <MightsText>Description: none yet — the record has a name, category and area so far.</MightsText>
        )}
        {showsDistances ? (
          <MightsText>Nearby distances: worked out by Harlem Might from the map points.</MightsText>
        ) : null}
      </View>
    </MightsBand>
  );
}
