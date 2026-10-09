'use client';

import { useMemo } from 'react';
import { useExplore } from '@acme/app/features/explore/explore.store.ts';
import { NavigationHud } from '@acme/app/features/navigation/ui/NavigationHud.tsx';
import { useNavigationUi } from '@acme/app/features/navigation/view/navigationUi.store.ts';
import { useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { endNavigation } from '@acme/app/features/navigation/view/runtime.ts';
import { MightsButton, MightsText } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';
import { ExploreMap, type MapPlace } from './ExploreMap';
import { focusId } from './explore-url';
import { DOCKED, sheetElementRef, useExploreActions } from './explore-actions';
import { useMapStatus } from './map-status';
import { useMediaQuery } from './use-media-query';

/**
 * The map pane. Filter visibility arrives through `visibleIds` in the store,
 * published by the master region; until then every point shows.
 */
export function MapRegion({ points: mapped }: { points: readonly MapPlace[] }) {
  const { params, replace, select } = useExploreActions();
  const placeId = params.get('place');
  const detent = useExplore((s) => s.sheet.detent);
  const storeVisibleIds = useExplore((s) => s.visibleIds);
  const mapStatus = useMapStatus((s) => s.status);
  const docked = useMediaQuery(DOCKED);
  const destinationId = useNavigationStore((s) =>
    'activeRoute' in s.session ? (s.session.destination.placeId ?? null) : null,
  );

  const mappedIds = useMemo(() => mapped.map((p) => p.id), [mapped]);
  const visibleIds = storeVisibleIds ?? mappedIds;
  const selected = placeId ? (mapped.find((p) => p.id === placeId) ?? null) : null;
  // The HUD offers to select the guidance destination; only meaningful while
  // a different place (or none) is selected.
  const showStepsDestination = destinationId && destinationId !== placeId ? destinationId : null;

  return (
    <>
      <ExploreMap
        places={mapped}
        visibleIds={visibleIds}
        selectedId={selected?.id ?? null}
        onSelect={(id) => select(id, focusId.marker(id))}
        occluderRef={sheetElementRef}
        layoutKey={detent}
      />
      <NavigationHud
        onShowSteps={
          docked
            ? undefined
            : () => {
                if (showStepsDestination) select(showStepsDestination, focusId.marker(showStepsDestination));
                useNavigationUi.getState().setStepsOpen(true);
                useExplore.getState().setSheetDetent('full');
              }
        }
        onRecenter={() => useNavigationUi.getState().setFollowUser(true)}
        onShowPlace={(id) => {
          endNavigation();
          if (placeId !== id) select(id, focusId.marker(id));
        }}
      />
      {mapStatus === 'unavailable' ? (
        <View className="absolute inset-0 items-start justify-end gap-3 bg-surface-sunken p-6">
          <MightsText tone="default">The map didn’t load. Every place is in the list.</MightsText>
          <MightsButton size="sm" variant="secondary" className="me:hidden" onPress={() => replace({ view: 'list' })}>
            Show the list
          </MightsButton>
        </View>
      ) : null}
    </>
  );
}
