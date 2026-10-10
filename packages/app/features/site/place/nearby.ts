import { haversine } from '@acme/app/features/explore/explore.store.ts';

// Lower-page context (bento B5) for /places/[slug]. Pure so the 4/3/2/1/0
// candidate cases are testable without rendering.

type LngLat = readonly [number, number];

export interface NearbyCandidate {
  id: string;
  lngLat?: LngLat;
}

export interface NearbyPlace<T extends NearbyCandidate> {
  place: T;
  /** Straight-line metres between the two map points. */
  meters: number;
}

/** B5 caps at four modules (pack prompt 05, "Max 4 modules"). */
export const NEARBY_MAX = 4;

/**
 * Beyond this a place isn't "nearby" any more. 1.5 km keeps every pair in
 * today's catalogue in range and stops a future Washington Heights record
 * from showing up under a 125th Street place. We don't convert it to a walk
 * time: we have no routing, only straight lines.
 */
export const NEARBY_RADIUS_M = 1500;

/**
 * Mapped places within {@link NEARBY_RADIUS_M} of `origin`, nearest first,
 * at most `max`. Empty when `origin` has no map point: without one there is
 * no real distance to rank by.
 */
export function nearbyPlaces<T extends NearbyCandidate>(
  origin: T,
  candidates: readonly T[],
  max: number = NEARBY_MAX,
  radius: number = NEARBY_RADIUS_M,
): NearbyPlace<T>[] {
  const from = origin.lngLat;
  if (!from) return [];
  return candidates
    .flatMap((place) =>
      place.id !== origin.id && place.lngLat ? [{ place, meters: haversine(from, place.lngLat) }] : [],
    )
    .filter((n) => n.meters <= radius)
    .sort((a, b) => a.meters - b.meters)
    .slice(0, max);
}

/**
 * How the section renders for a given count. A bento needs a lead and at
 * least one support, so one place gets a single card and none gets nothing.
 */
export function nearbyLayout(count: number): 'bento' | 'single' | 'none' {
  if (count >= 2) return 'bento';
  return count === 1 ? 'single' : 'none';
}

/** "350 m" under a kilometre (rounded to 10 m), "1.2 km" from there. */
export function formatDistance(meters: number): string {
  if (meters < 995) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
