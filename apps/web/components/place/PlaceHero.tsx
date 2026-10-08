import type { HarlemPlacePreview } from '@acme/app/features/explore/explore.store.ts';
import { View } from '@acme/ui/tw';
import {
  MapAttribution,
  MightsButton,
  MightsHeading,
  MightsLocationStamp,
  MightsMapImage,
  MightsNotchCard,
  MightsText,
  routes,
} from '@acme/ui/mights';

// Hero and visit layer of /places/[slug] (docs/design/handoff/PLACE.md).
// Facts on the left, map on the right, the pattern store-locator pages use
// (Mobbin refs in the handoff). One notch card holds every sourced visit fact.

// The hero map's md+ column is 7 of 12; below md it is full width.
const HERO_MAP_SIZES = '(min-width: 768px) 58vw, 100vw';

export function PlaceHero({ place }: { place: HarlemPlacePreview }) {
  const { lngLat } = place;
  const where = place.street ?? place.area;

  return (
    <View className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-6">
      {/* Facts first in source and on screen: "how do I get there" outranks the picture. */}
      <View className="gap-6 md:col-span-5">
        <MightsNotchCard>
          <View className="gap-4 p-6">
            <MightsHeading level={2} size="title">
              Getting there
            </MightsHeading>
            <MightsText size="body" tone="default">
              {where}
            </MightsText>
            {lngLat ? (
              <>
                <View className="flex-row">
                  <MightsButton
                    external
                    href={`https://www.google.com/maps/dir/?api=1&destination=${lngLat[1]},${lngLat[0]}`}
                  >
                    Get directions
                  </MightsButton>
                </View>
                {/* The point is a geocode, not a surveyed door (audit §7, locationAccuracy "approx"). */}
                <MightsText size="small">
                  Directions go to the map point, not to a checked entrance.
                </MightsText>
              </>
            ) : (
              <MightsText size="small">
                Directions open once the location is verified.
              </MightsText>
            )}
            {/* Hours, status, accessibility and tickets have no field in the
                catalogue yet (audit §7 gaps 1 and 3), and no fixture carries a
                venue website to point at, so the line names the gap and stops. */}
            <MightsText size="small" className="border-t border-rule-hairline pt-4">
              We haven&apos;t verified hours, accessibility or entry details for this place, so this page doesn&apos;t
              list them.
            </MightsText>
          </View>
        </MightsNotchCard>
        <View className="flex-row flex-wrap gap-3">
          {/* A place without coordinates has no pin to open on the map. */}
          {lngLat ? (
            <MightsButton href={routes.explore({ place: place.id })} variant="secondary" size="sm">
              See it on the map
            </MightsButton>
          ) : null}
          <MightsButton href={routes.explore({ category: place.category })} variant="secondary" size="sm">
            {`${place.category} on the map`}
          </MightsButton>
        </View>
      </View>
      <View className="gap-2 md:col-span-7">
        <MightsNotchCard className={lngLat ? 'aspect-video' : undefined}>
          <View className="relative h-full">
            {lngLat ? (
              <MightsMapImage
                center={lngLat}
                zoom={16.8}
                // ADR-04 route map: place hero pitch stays at or under 30.
                pitch={30}
                width={1120}
                height={630}
                sizes={HERO_MAP_SIZES}
                pins={[{ lngLat }]}
                alt={`Map of ${place.name}, ${where}`}
                priority
              />
            ) : (
              <View className="items-start bg-surface-sunken p-5 pb-20">
                <MightsText size="small">Location pending verification</MightsText>
              </View>
            )}
            <MightsLocationStamp name={place.name} street={where} className="absolute bottom-4 left-4" />
          </View>
        </MightsNotchCard>
        {lngLat ? <MapAttribution /> : null}
      </View>
    </View>
  );
}
