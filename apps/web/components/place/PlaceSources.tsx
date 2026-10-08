import type { HarlemPlacePreview } from '@acme/app/features/explore/explore.store.ts';
import { View } from '@acme/ui/tw';
import { MightsBand, MightsText } from '@acme/ui/mights';

// "Where did the information come from?" (pack prompt 05, question 9). One
// line per kind of fact the page shows, nothing for facts it doesn't show.
// Map imagery credit sits under each map (MapAttribution), not repeated here.

/**
 * When the fixture's coordinates were read from Nominatim. Recorded only in
 * the doc comment on `HarlemPlacePreview.lngLat`
 * (packages/app/features/explore/explore.store.ts); Payload carries it per
 * record as `locationSource.verifiedAt` once places move there.
 */
// Moves to the per-record `locationSource.verifiedAt` when place pages read Payload.
const OSM_FETCHED = 'October 3, 2026';

const link = 'mights-focus text-primary underline hover:text-text';

export function PlaceSources({ place, showsDistances }: { place: HarlemPlacePreview; showsDistances: boolean }) {
  return (
    <MightsBand title="Where this comes from">
      <View className="max-w-content-detail gap-4">
        {place.lngLat && place.osm ? (
          <MightsText>
            Map point: OpenStreetMap{' '}
            <a
              className={link}
              href={`https://www.openstreetmap.org/${place.osm}`}
              target="_blank"
              rel="noreferrer"
            >
              {place.osm}
            </a>
            , fetched {OSM_FETCHED}. It marks the place, not a checked entrance.
          </MightsText>
        ) : place.lngLat ? (
          <MightsText>Map point: on the map, but its source isn&apos;t recorded yet.</MightsText>
        ) : (
          <MightsText>
            Map point: none yet. {place.name} stays off the map until its location is verified.
          </MightsText>
        )}
        <MightsText>
          Description: written by Harlem Might and not yet checked against official sources.
        </MightsText>
        {showsDistances ? (
          <MightsText>Nearby distances: worked out by Harlem Might from the map points.</MightsText>
        ) : null}
      </View>
    </MightsBand>
  );
}
