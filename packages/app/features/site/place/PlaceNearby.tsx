import type { ExplorePlace } from '@acme/app/features/explore/explore.store.ts';
import { View } from '@acme/ui/tw';
import { MightsBand, MightsHeading, MightsNotchCard, MightsPlaceBento, MightsText, routes } from '@acme/ui/mights';
import { formatDistance, nearbyLayout, type NearbyPlace } from './nearby.ts';

// Bento B5, lower-page context. Only the nearby module has data today: the
// related-story module waits for the first story attached to a place
// (listStories exists, but nothing is published and this route prerenders
// without a database), and the current-event module waits for a per-venue
// events reader. Until then B5 is nearby places alone, in the `default`
// variant with the closest place dominant.

export function PlaceNearby({ place, nearby }: { place: ExplorePlace; nearby: NearbyPlace<ExplorePlace>[] }) {
  const layout = nearbyLayout(nearby.length);
  if (layout === 'none') return null;

  return (
    <MightsBand title="Nearby">
      <MightsText size="small">Straight-line distance from the {place.name} map point.</MightsText>
      {layout === 'bento' ? (
        <MightsPlaceBento
          places={nearby.map(({ place: p, meters }) => ({
            id: p.id,
            name: p.name,
            area: p.area,
            street: p.street,
            lngLat: p.lngLat,
            shortDescription: `${formatDistance(meters)} away`,
          }))}
        />
      ) : (
        // One place is not a bento (pack prompt 05): a single card instead.
        <MightsNotchCard href={routes.place(nearby[0]!.place.id)} className="md:max-w-content-detail">
          <View className="gap-1 p-5">
            <MightsHeading level={3} size="card">
              {nearby[0]!.place.name}
            </MightsHeading>
            <MightsText size="small">{formatDistance(nearby[0]!.meters)} away</MightsText>
          </View>
        </MightsNotchCard>
      )}
    </MightsBand>
  );
}
