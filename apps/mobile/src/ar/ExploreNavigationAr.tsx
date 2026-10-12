import { useEffect } from 'react';
import { View } from '@acme/ui/tw';
import { HarlemNavigationAr } from './HarlemNavigationAr';
import { createArVisit, finishArNavigation, prepareArMapReturn, prepareArPlaceReturn } from './navigationArVisit';

/** One walking-AR visit inside Explore's existing map pane and navigation shell. */
export function ExploreNavigationAr({ visit, cameraAllowed, contentInsets, onClose }: {
  readonly visit: ReturnType<typeof createArVisit>;
  readonly cameraAllowed: boolean;
  readonly contentInsets: { top: number; bottom: number; left: number; right: number };
  readonly onClose: () => void;
}) {
  useEffect(() => visit.attach(), [visit]);
  return (
    <View className="absolute inset-0">
      <HarlemNavigationAr
        cameraAllowed={cameraAllowed}
        contentInsets={contentInsets}
        onBackToMap={() => { prepareArMapReturn(); onClose(); }}
        onExplorePlace={(placeId) => {
          finishArNavigation();
          prepareArPlaceReturn(placeId);
          onClose();
        }}
      />
    </View>
  );
}
