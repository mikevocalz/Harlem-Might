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
import { PanePromotionContext } from '@/src/navigation/split-view/pane-promotion';
import { EXPLORE_SURFACE, resolveExploreWorkspace } from '@/src/spatial/exploreWorkspace';
import { ExploreWorkspaceContext, ExploreWorkspaceWindow } from '@/src/spatial/ExploreWorkspaceWindow';
import { metaWindows } from '@/src/spatial/metaWindows';

export default function ExploreLayout() {
  const router = useRouter();
  const splitRef = useRef<SplitViewCommands>(null);
  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  const selectPlace = useExplore((state) => state.selectPlace);
  const selectedPlace = getHarlemPlacePreview(selectedPlaceId);

  // On a quest build the map stays in the main window, Discover and Place
  // Detail ask for their own windows (src/spatial/exploreWorkspace.ts), and a
  // pane whose content was promoted collapses here instead of showing a
  // blank strip. Everywhere else both placements are 'inline' and this is the
  // plain SplitView.
  const isSpatialAvailable = metaWindows.useSpatialAvailable();
  const workspace = resolveExploreWorkspace({ selectedPlaceId, isSpatialAvailable });
  const discoverPlacement = metaWindows.usePlacement(EXPLORE_SURFACE.discover);
  const detailPlacement = metaWindows.usePlacement(EXPLORE_SURFACE.placeDetail);
  const promotion = {
    primary: discoverPlacement === 'spatial',
    detail: detailPlacement === 'spatial',
  };

  const openPlace = (place: HarlemPlacePreview) => {
    selectPlace(place.id);
    router.push({
      pathname: '/(drawer)/(tabs)/explore/[placeId]',
      params: { placeId: place.id },
    } as never);
    splitRef.current?.show('secondary');
  };

  return (
    <ExploreWorkspaceContext.Provider value={workspace}>
      <PanePromotionContext.Provider value={promotion}>
        <SplitView
          ref={splitRef}
          topColumnForCollapsing="supplementary"
          showInspector={selectedPlace != null}
        >
          <SplitView.Column>
            <ExploreWorkspaceWindow surfaceId={EXPLORE_SURFACE.discover}>
              <ExploreMasterPane
                onSelectPlace={openPlace}
                onShowMap={() => splitRef.current?.show('supplementary')}
              />
            </ExploreWorkspaceWindow>
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
      </PanePromotionContext.Provider>
    </ExploreWorkspaceContext.Provider>
  );
}
