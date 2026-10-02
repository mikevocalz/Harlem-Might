'use client';

import { useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  ExploreMapPane,
  ExploreMasterPane,
  MightsPanel,
  getHarlemPlacePreview,
  useExplore,
  type HarlemPlacePreview,
} from '@acme/app';
import { SplitView, type SplitViewCommands } from '@/src/navigation/split-view';

export default function ExploreLayout() {
  const router = useRouter();
  const splitRef = useRef<SplitViewCommands>(null);
  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  const selectPlace = useExplore((state) => state.selectPlace);
  const selectedPlace = getHarlemPlacePreview(selectedPlaceId);

  const openPlace = (place: HarlemPlacePreview) => {
    selectPlace(place.id);
    router.push({
      pathname: '/(drawer)/(tabs)/explore/[placeId]',
      params: { placeId: place.id },
    } as never);
    splitRef.current?.show('secondary');
  };

  return (
    <SplitView
      ref={splitRef}
      topColumnForCollapsing="supplementary"
      showInspector={selectedPlace != null}
    >
      <SplitView.Column>
        <ExploreMasterPane
          onSelectPlace={openPlace}
          onShowMap={() => splitRef.current?.show('supplementary')}
        />
      </SplitView.Column>

      <SplitView.Column>
        <ExploreMapPane
          onSelectPlace={openPlace}
          onShowPlaces={() => splitRef.current?.show('primary')}
        />
      </SplitView.Column>

      <SplitView.Inspector>
        <MightsPanel />
      </SplitView.Inspector>
    </SplitView>
  );
}
