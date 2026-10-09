'use client';

import { useEffect } from 'react';
import { View } from '@acme/ui/tw';
import { useReducedMotion } from '@acme/ui';
import { ExploreLoader } from '@acme/spatial/explore-loader';
import { useMapLoader } from './map-loader.store';
import { useMapStatus } from './map-status';

const LOADER_SRC = '/rive/explore-loader.riv';

/**
 * Covers the map region while `mapStatus` is `loading` — the span that
 * really takes time here is the GL style/tile load, not data. Timing lives
 * in `map-loader.store`: the CSS delay keeps the overlay off entirely when
 * the map comes up fast, the choreographed `complete` exit runs once shown,
 * and `unavailable` hands the region to the map's error plate.
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

  if (phase === 'hidden') return null;

  return (
    <View role="status" aria-live="polite" className="hm-suspense-in absolute inset-0 items-center justify-center bg-map-canvas">
      <ExploreLoader
        source={LOADER_SRC}
        size={168}
        phase={phase === 'complete' ? 'complete' : reducedMotion ? 'reduced' : 'loading'}
        label="Loading map"
      />
    </View>
  );
}
