'use client';

import { useEffect, useRef } from 'react';
import { BackHandler, useWindowDimensions } from 'react-native';
import { Slot } from 'expo-router';
import { useRouter } from 'solito/navigation';
import { routes } from '@acme/ui/mights';
import {
  DirectionsPanel,
  ExploreMapPane,
  ExploreMasterPane,
  ExplorePlaceDetail,
  ExploreTypeContext,
  HARLEM_PLACE_PREVIEWS,
  NO_LOCATION_SOURCE,
  NavigationHud,
  closeDirections,
  endNavigation,
  getHarlemPlacePreview,
  markerFocusId,
  moveFocusTo,
  openDirections,
  rowFocusId,
  useDirectionsPlaceId,
  useExplore,
  useIsGuiding,
  useNavigationHost,
  useNavigationStore,
} from '@acme/app';
import { SafeArea } from '@acme/ui';
import { View } from '@acme/ui/tw';
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
import { ViewInArButton } from '@/src/ar/ViewInArButton';
import { metaWindows } from '@/src/spatial/metaWindows';
import { usePlaceDetailPanel } from '@/src/spatial/usePlaceDetailPanel';

// This build has no location module (expo-location is not a dependency yet),
// so directions start from a chosen place and guidance says it can't follow
// the person. See docs/NAVIGATION_PLATFORM_MATRIX.md.
const noLocationSource = () => NO_LOCATION_SOURCE;


/**
 * Explore: the map is the permanent centre (design handoff §0, §4).
 *
 * The map always takes the flex region. Discover is a leading column, drawer
 * or single-column screen, and always stays in this window (DECISIONS S12).
 * Place Detail exists only while a place is selected (S5). On a quest build it
 * opens as its own Horizon OS panel to the right of this window (S20,
 * `usePlaceDetailPanel`); if the panel cannot open, Discover 360 | map |
 * Detail 400 share this 1440x900dp window and Detail pushes the map narrower
 * instead of covering it (S17). Elsewhere it is a trailing column, overlay or
 * screen. Breakpoints come from the window's width,
 * which the user can resize (src/spatial/exploreLayout.ts).
 *
 * Selection is one store write (`openPlace`). The `[placeId]` route only
 * syncs a deep link into the store, so Detail lives at a fixed tree position
 * here and its window never re-registers.
 */
export default function ExploreRouteLayout() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  const openPlace = useExplore((state) => state.openPlace);
  const closePlace = useExplore((state) => state.closePlace);
  const savedPreviewIds = useExplore((state) => state.savedPreviewIds);

  // One navigation session for every pane: Detail's directions, the map's
  // route line and the HUD all read useNavigationStore.
  useNavigationHost(noLocationSource);
  const directionsPlaceId = useDirectionsPlaceId();
  const guiding = useIsGuiding();
  const destinationId = useNavigationStore((s) =>
    'activeRoute' in s.session ? (s.session.destination.placeId ?? null) : null,
  );

  const compactPane = useExploreLayoutStore((state) => state.compactPane);
  const discoverDrawerOpen = useExploreLayoutStore((state) => state.discoverDrawerOpen);
  const setCompactPane = useExploreLayoutStore((state) => state.setCompactPane);
  const showCompactDetail = useExploreLayoutStore((state) => state.showCompactDetail);
  const leaveCompactDetail = useExploreLayoutStore((state) => state.leaveCompactDetail);
  const setDiscoverDrawerOpen = useExploreLayoutStore((state) => state.setDiscoverDrawerOpen);

  const isSpatialAvailable = metaWindows.useSpatialAvailable();
  const workspace = resolveExploreWorkspace({ selectedPlaceId, isSpatialAvailable });

  // Quest: Detail is its own panel right of this window (S20); `inline`
  // falls back to the S17 column. `dismissDetail` is defined below and only
  // runs from the panel's close event, never during render.
  const detailPlacement = usePlaceDetailPanel({
    selectedPlaceId,
    onClosedByUser: () => dismissDetail(),
  });

  const layout = resolveExploreLayout({
    windowWidth,
    hasSelection: selectedPlaceId != null,
    detailPlacement,
    isHorizon: isHorizonBuild,
    compactPane,
    discoverDrawerOpen,
  });
  const single = layout.arrangement === 'single';

  const open = (placeId: string, origin: 'map' | 'discover', focusId: string | null) => {
    openPlace(placeId, focusId);
    if (single) showCompactDetail(origin);
    // A Discover opened from "Places" folds away so Detail can take its place.
    setDiscoverDrawerOpen(false);
  };

  const dismissDetail = () => {
    if (!guiding) closeDirections();
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
  const directionsOpen = directionsPlaceId != null && directionsPlaceId === selectedPlaceId && !guiding;
  const latest = useRef<{ layout: ExploreLayout; dismissDetail: () => void; directionsOpen: boolean }>({
    layout,
    dismissDetail,
    directionsOpen,
  });
  useEffect(() => {
    latest.current = { layout, dismissDetail, directionsOpen };
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // Directions sit on top of Place Detail: Back returns to the place.
      if (latest.current.directionsOpen) {
        closeDirections();
        return true;
      }
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

  const showPlaces = () => (single ? setCompactPane('discover') : setDiscoverDrawerOpen(true));
  // Guidance: phones bring the map forward and reach the step list through
  // the HUD; wider layouts keep the steps in the Detail column beside it.
  const showSteps = () => {
    if (destinationId) openPlace(destinationId, null);
    showCompactDetail('map');
  };
  const showPlaceAfterTrip = (placeId: string) => {
    endNavigation();
    open(placeId, 'map', null);
  };
  const showDirectionsFor = selectedPlaceId != null && directionsPlaceId === selectedPlaceId;
  const directionsPlace = showDirectionsFor ? getHarlemPlacePreview(selectedPlaceId) : null;
  // Before guidance the panel's Back abandons planning and Place Detail comes
  // back (the panel does that itself). During guidance a phone's "Map"
  // uncovers the map; beside the map the steps stay put, so no button.
  const directionsDismiss = !guiding ? () => {} : single ? () => setCompactPane('map') : undefined;
  const showMap = () => (single ? setCompactPane('map') : setDiscoverDrawerOpen(false));
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
                onShowMap={layout.discoverDismiss === 'show-map' ? showMap : undefined}
                onClose={layout.discoverDismiss === 'close' ? showMap : undefined}
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
                <NavigationHud
                  onShowSteps={single ? showSteps : undefined}
                  onShowPlace={showPlaceAfterTrip}
                  onSave={(placeId) => useExplore.getState().toggleSavedPreview(placeId)}
                  isSaved={destinationId != null && savedPreviewIds.includes(destinationId)}
                />
              </ExploreMapPane>
            </View>

            {/* A promoted Detail is the separate panel (PlaceDetailPanel), so the
                main window renders no second copy of it. */}
            {selectedPlaceId != null && layout.detail && layout.detail.kind !== 'promoted' ? (
              <ExplorePane mode={layout.detail} side="trailing" restingWidth={EXPLORE_PANE_DP.detail}>
                <ExploreWorkspaceWindow surfaceId={EXPLORE_SURFACE.placeDetail}>
                  {directionsPlace ? (
                    <DirectionsPanel
                      place={directionsPlace}
                      originPlaces={HARLEM_PLACE_PREVIEWS}
                      padding={windowPadding}
                      frame={layout.detailDismiss === 'back' ? 'rail-top' : 'rail-leading'}
                      onDismiss={directionsDismiss}
                      onStarted={single ? () => setCompactPane('map') : undefined}
                    />
                  ) : (
                  <ExplorePlaceDetail
                    placeId={selectedPlaceId}
                    placePageUrl={siteUrl(routes.place(selectedPlaceId))}
                    padding={windowPadding}
                    actions={<ViewInArButton placeId={selectedPlaceId} />}
                    dismissKind={layout.detailDismiss}
                    onClose={dismissDetail}
                    onShowOnMap={layout.showOnMapInDetail ? () => setCompactPane('map') : undefined}
                    onSelectNearby={(place) =>
                      openPlace(place.id, useExplore.getState().sheet.returnFocusId)
                    }
                    onDirections={() => openDirections(selectedPlaceId)}
                  />
                  )}
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
