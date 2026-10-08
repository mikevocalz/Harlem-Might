'use client';

import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import { Slot } from 'expo-router';
import { useRouter } from 'solito/navigation';
import { routes } from '@acme/ui/mights';
import {
  ExploreMapPane,
  ExploreMasterPane,
  ExplorePlaceDetail,
  ExploreTypeContext,
  markerFocusId,
  moveFocusTo,
  rowFocusId,
  useExplore,
} from '@acme/app';
import { SafeArea } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { useWindowSizeClass } from '@/src/navigation/split-view/use-window-size-class';
import { siteUrl } from '@/src/site/site-url';
import { EXPLORE_SURFACE, resolveExploreWorkspace } from '@/src/spatial/exploreWorkspace';
import {
  EXPLORE_PANE_DP,
  exploreBackAction,
  resolveExploreLayout,
  type ExploreLayout,
} from '@/src/spatial/exploreLayout';
import { useExploreLayoutStore } from '@/src/spatial/exploreLayout.store';
import { ExplorePane } from '@/src/spatial/ExplorePane';
import { ExploreWorkspaceContext, ExploreWorkspaceWindow } from '@/src/spatial/ExploreWorkspaceWindow';
import { isHorizonBuild } from '@/src/spatial/horizonBuild';
import { metaWindows } from '@/src/spatial/metaWindows';


/**
 * Explore: the map is the permanent centre (design handoff §0, §4).
 *
 * The map always takes the flex region. Discover is a leading pane, drawer or
 * compact screen, and always stays in this window (DECISIONS S12). Place
 * Detail is a trailing pane, overlay or compact screen that exists only while
 * a place is selected (S5). On a quest build Detail asks for its own Horizon
 * window (src/spatial/exploreWorkspace.ts); once promoted, its pane collapses
 * here and the map takes its width.
 *
 * Selection is one store write (`openPlace`). The `[placeId]` route only
 * syncs a deep link into the store, so Detail lives at a fixed tree position
 * here and its window never re-registers.
 */
export default function ExploreRouteLayout() {
  const router = useRouter();
  const sizeClass = useWindowSizeClass();

  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  const openPlace = useExplore((state) => state.openPlace);
  const closePlace = useExplore((state) => state.closePlace);

  const compactPane = useExploreLayoutStore((state) => state.compactPane);
  const discoverDrawerOpen = useExploreLayoutStore((state) => state.discoverDrawerOpen);
  const setCompactPane = useExploreLayoutStore((state) => state.setCompactPane);
  const showCompactDetail = useExploreLayoutStore((state) => state.showCompactDetail);
  const leaveCompactDetail = useExploreLayoutStore((state) => state.leaveCompactDetail);
  const setDiscoverDrawerOpen = useExploreLayoutStore((state) => state.setDiscoverDrawerOpen);

  const isSpatialAvailable = metaWindows.useSpatialAvailable();
  const workspace = resolveExploreWorkspace({ selectedPlaceId, isSpatialAvailable });
  const detailPlacement = metaWindows.usePlacement(EXPLORE_SURFACE.placeDetail);

  const layout = resolveExploreLayout({
    sizeClass,
    hasSelection: selectedPlaceId != null,
    detailPlacement,
    isHorizon: isHorizonBuild,
    compactPane,
    discoverDrawerOpen,
  });
  const compact = sizeClass === 'compact';

  const open = (placeId: string, origin: 'map' | 'discover', focusId: string | null) => {
    openPlace(placeId, focusId);
    if (compact) showCompactDetail(origin);
    if (sizeClass === 'medium') setDiscoverDrawerOpen(false);
  };

  const dismissDetail = () => {
    closePlace();
    leaveCompactDetail();
    // A deep link may have left /explore/[placeId] as the current route; drop
    // it with the selection. Harmless when the index is already showing.
    router.replace(routes.explore());
  };

  // Return focus to the row or marker that opened Detail once it has gone
  // (a11y.md O5). Runs after the commit that unmounted Detail, so the row's
  // pane is visible to TalkBack again.
  const previousSelection = useRef(selectedPlaceId);
  useEffect(() => {
    if (previousSelection.current != null && selectedPlaceId == null) {
      moveFocusTo(useExplore.getState().sheet.returnFocusId);
    }
    previousSelection.current = selectedPlaceId;
  }, [selectedPlaceId]);

  // Android Back: Detail, then a Discover screen or drawer.
  const latest = useRef<{ layout: ExploreLayout; dismissDetail: () => void }>({ layout, dismissDetail });
  useEffect(() => {
    latest.current = { layout, dismissDetail };
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const action = exploreBackAction({
        assistantOpen: false,
        layout: latest.current.layout,
      });
      switch (action) {
        case 'close-detail':
          latest.current.dismissDetail();
          return true;
        case 'show-map':
          useExploreLayoutStore.getState().setCompactPane('map');
          return true;
        case 'close-drawer':
          useExploreLayoutStore.getState().setDiscoverDrawerOpen(false);
          return true;
        case null:
          return false;
      }
    });
    return () => subscription.remove();
  }, []);

  const showPlaces = () => (compact ? setCompactPane('discover') : setDiscoverDrawerOpen(true));
  const showMap = () => (compact ? setCompactPane('map') : setDiscoverDrawerOpen(false));
  const windowPadding = isHorizonBuild ? 'window' : 'pane';

  return (
    <ExploreTypeContext.Provider value={isHorizonBuild ? 'xr' : 'flat'}>
      <ExploreWorkspaceContext.Provider value={workspace}>
        <SafeArea edges={['left', 'right']} className="flex-1 bg-surface">
          <View className="flex-1 flex-row">
            <ExplorePane mode={layout.discover} side="leading" restingWidth={EXPLORE_PANE_DP.discover}>
              {/* Main-window content on every build: never a SpatialWindow (S12). */}
              <ExploreMasterPane
                padding={windowPadding}
                onSelectPlace={(place) => open(place.id, 'discover', rowFocusId(place.id))}
                onShowMap={layout.showMapToggle ? showMap : undefined}
              />
            </ExplorePane>

            <View
              className="overflow-hidden"
              style={{ flexGrow: layout.showMap ? 1 : 0, width: layout.showMap ? undefined : 0 }}
              aria-hidden={!layout.showMap}
              importantForAccessibility={layout.showMap ? 'auto' : 'no-hide-descendants'}
            >
              <ExploreMapPane
                onSelectPlace={(place) => open(place.id, 'map', markerFocusId(place.id))}
                onShowPlaces={layout.showPlacesToggle ? showPlaces : undefined}
                insets={{
                  top: 0,
                  left: layout.mapInsets.left,
                  right: layout.mapInsets.right,
                  bottom: 0,
                }}
              >
                {/* The assistant is struck until it has a backend: today it would only
                    repeat Discover's search (spatial DECISIONS S16, 2026-10-08). */}
              </ExploreMapPane>
            </View>

            {selectedPlaceId != null && layout.detail ? (
              <ExplorePane mode={layout.detail} side="trailing" restingWidth={EXPLORE_PANE_DP.detail}>
                <ExploreWorkspaceWindow surfaceId={EXPLORE_SURFACE.placeDetail}>
                  <ExplorePlaceDetail
                    placeId={selectedPlaceId}
                    placePageUrl={siteUrl(routes.place(selectedPlaceId))}
                    padding={windowPadding}
                    dismissKind={layout.detailDismiss}
                    onClose={dismissDetail}
                    onShowOnMap={layout.showOnMapInDetail ? () => setCompactPane('map') : undefined}
                    onSelectNearby={(place) =>
                      openPlace(place.id, useExplore.getState().sheet.returnFocusId)
                    }
                  />
                </ExploreWorkspaceWindow>
              </ExplorePane>
            ) : null}
          </View>

          {/* Child routes only sync the URL into the store; nothing to show. */}
          <View className="hidden">
            <Slot />
          </View>
        </SafeArea>
      </ExploreWorkspaceContext.Provider>
    </ExploreTypeContext.Provider>
  );
}
