'use client';

import {
  ExploreEmptyDetail,
  ExploreMapPane,
  ExploreMasterPane,
  ExplorePlaceDetail,
  MightsPanel,
  getHarlemPlacePreview,
  useExplore,
} from '@acme/app';
import { View } from '@acme/ui/tw';

/**
 * Next-web compatibility surface for the same Explore workspace used by the
 * Expo SplitView route. Master and Map are tiled; Detail owns canonical Place
 * content; the Mights Panel overlays the trailing edge as transient context.
 */
export default function ExplorePage() {
  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  const selectPlace = useExplore((state) => state.selectPlace);
  const selectedPlace = getHarlemPlacePreview(selectedPlaceId);

  return (
    <View className="relative min-h-[calc(100vh-5rem)] flex-1 flex-row overflow-hidden bg-surface">
      <View className="hidden w-[19rem] shrink-0 border-r border-border lg:flex">
        <ExploreMasterPane onSelectPlace={(place) => selectPlace(place.id)} />
      </View>

      <View className="min-w-0 flex-1 border-r border-border">
        <ExploreMapPane onSelectPlace={(place) => selectPlace(place.id)} />
      </View>

      <View className="hidden min-w-[22rem] flex-[1.1] xl:flex">
        {selectedPlace ? (
          <ExplorePlaceDetail placeId={selectedPlace.id} />
        ) : (
          <ExploreEmptyDetail />
        )}
      </View>

      {selectedPlace ? (
        <View className="absolute bottom-4 right-4 top-4 hidden w-[20rem] overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-overlay 2xl:flex">
          <MightsPanel />
        </View>
      ) : null}
    </View>
  );
}
