'use client';

import { useReducedMotion } from '@acme/ui';
import { Text, View } from '@acme/ui/tw';
import { ExploreLoader } from '@acme/spatial/explore-loader';

/**
 * The page-level Suspense fallback: the same plate and Rive loader as
 * `MapLoadOverlay`, sized to the stage, so the data wait and the GL wait read
 * as one loader. `hm-suspense-in` holds it at opacity 0 for 250 ms, so a warm
 * cache shows nothing here and the overlay takes over directly.
 */
export function ExplorePageLoader() {
  const reducedMotion = useReducedMotion();
  return (
    <View
      role="status"
      className="hm-suspense-in h-[calc(100dvh-var(--spacing)*16-var(--spacing-dock)-env(safe-area-inset-bottom))] items-center justify-center bg-map-canvas me:h-[calc(100dvh-var(--spacing)*16)]"
    >
      <Text className="sr-only">Loading Explore</Text>
      <ExploreLoader
        source="/rive/explore-loader.riv"
        size={168}
        phase={reducedMotion ? 'reduced' : 'loading'}
        label="Loading Explore"
      />
    </View>
  );
}
