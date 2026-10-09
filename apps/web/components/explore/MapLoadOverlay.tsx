'use client';

import { Text, View } from '@acme/ui/tw';
import { useMapStatus } from './map-status';

/**
 * Covers the map region while `mapStatus` is `loading` — the span that
 * really takes time here is the GL style/tile load, not data. The
 * `hm-suspense-in` delay keeps the overlay off entirely when the map comes
 * up fast; `unavailable` is owned by the map region's error plate.
 */
export function MapLoadOverlay() {
  const mapStatus = useMapStatus((s) => s.status);
  if (mapStatus !== 'loading') return null;

  return (
    <View role="status" aria-live="polite" className="hm-suspense-in absolute inset-0 items-center justify-center">
      <View className="items-center gap-3 bg-surface px-6 py-5">
        {/* The map-marker diamond, pulsing. The Rive orbital loader replaces
            this chip once the .riv ships. */}
        <View className="size-3 rotate-45 animate-pulse bg-primary motion-reduce:animate-none" />
        <Text className="text-label text-text-muted">Loading map</Text>
      </View>
    </View>
  );
}
