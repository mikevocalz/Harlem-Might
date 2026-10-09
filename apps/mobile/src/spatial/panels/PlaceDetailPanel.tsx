import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'solito/navigation';
import { ExplorePlaceDetail, ExploreTypeContext, SafeAreaProvider, useExplore } from '@acme/app';
import { routes } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';
import { ViewInArButton } from '../../ar/ViewInArButton';
import { siteUrl } from '../../site/site-url';
import { PanelNavigationProvider } from './PanelNavigationProvider';

const FILL = { flex: 1 } as const;

/**
 * Place Detail as its own Horizon OS panel (DECISIONS S20, ADR 0006). The
 * root of a second React Native surface, registered as `PlaceDetailPanel`
 * in `index.ts` and hosted by `SpatialPanelActivity`.
 *
 * It shares the runtime with the main window, so it reads the selection
 * straight from `useExplore`: choosing another place on the map or in
 * Discover updates this panel in place. solito runs here through
 * `PanelNavigationProvider`, and every in-app route it opens lands in the
 * main window.
 */
export function PlaceDetailPanel() {
  return (
    <GestureHandlerRootView style={FILL}>
      <SafeAreaProvider>
        <PanelNavigationProvider>
          <ExploreTypeContext.Provider value="xr">
            <PlaceDetailPanelContent />
          </ExploreTypeContext.Provider>
        </PanelNavigationProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Close clears the selection, as the main window's Close does, and
 * `usePlaceDetailPanel` in the main window then closes this panel.
 */
function PlaceDetailPanelContent() {
  const router = useRouter();
  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  const openPlace = useExplore((state) => state.openPlace);
  const closePlace = useExplore((state) => state.closePlace);

  const close = () => {
    closePlace();
    // Drop a deep-linked /explore/[placeId] with the selection.
    router.replace(routes.explore());
  };

  return (
    <View className="flex-1 bg-surface">
      {selectedPlaceId != null ? (
        <ExplorePlaceDetail
          placeId={selectedPlaceId}
          placePageUrl={siteUrl(routes.place(selectedPlaceId))}
          padding="window"
          dismissKind="close"
          actions={<ViewInArButton placeId={selectedPlaceId} />}
          onClose={close}
          onSelectNearby={(place) => openPlace(place.id, useExplore.getState().sheet.returnFocusId)}
        />
      ) : null}
    </View>
  );
}
