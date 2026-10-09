'use client';

import { useEffect } from 'react';
import { Text, View } from '@acme/ui/tw';
import { useReducedMotion } from '@acme/ui';
import { ExploreLoader } from '@acme/spatial/explore-loader';
import { useMapLoader } from './map-loader.store';
import { useMapStatus } from './map-status';

const LOADER_SRC = '/rive/explore-loader.riv';

/**
 * Covers the whole Explore stage while `mapStatus` is `loading` — the GL
 * style/tile load is the longest wait, and it picks up where the page's
 * Suspense fallback (`ExplorePageLoader`, same plate) leaves off, so there is
 * one loader and no gap between them. It paints on the first frame (no
 * entry delay) so the list never shows ahead of the map. Timing lives in
 * `map-loader.store`; `unavailable` hands the region to the map's error plate.
 */
export function MapLoadOverlay() {
  const mapStatus = useMapStatus((s) => s.status);
  const phase = useMapLoader((s) => s.phase);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const store = useMapLoader.getState();
    if (mapStatus === 'loading') store.enter();
    else if (mapStatus === 'ready') store.complete();
    else store.fail();
  }, [mapStatus]);

  if (phase === 'hidden' && mapStatus !== 'loading') return null;

  return (
    <View role="status" aria-live="polite" className="absolute inset-0 z-10 items-center justify-center bg-map-canvas">
      {/* Two announcements total: "Loading map" on mount, "Map ready" when the
          exit starts — not a stream of progress chatter. */}
      <Text className="sr-only">{phase === 'complete' ? 'Map ready' : 'Loading map'}</Text>
      <ExploreLoader
        source={LOADER_SRC}
        size={168}
        phase={phase === 'complete' ? 'complete' : reducedMotion ? 'reduced' : 'loading'}
        label="Loading map"
      />
    </View>
  );
}
