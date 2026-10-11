import { useEffect } from 'react';
import { getCataloguePlace, catalogueNearbyPlaces, usePlaceCatalogue } from '@acme/app';
import { useArSession } from './arSession.store';
import { mapboxToken } from './mapboxToken';
import { fetchWalkingRoute } from './walkingRoute';

/** How many nearby places the walking route visits after the selected one. */
const NEARBY_STOPS = 2;

/**
 * The map layer's half of the tabletop: requests a walking route from the
 * session's place to its nearest places and puts it in `useArSession`. The AR
 * scene only draws what lands there (spec §6A: AR never calls Directions).
 */
export function useTabletopRoute(placeId: string | undefined) {
  const catalogue = usePlaceCatalogue((s) => s.places);
  useEffect(() => {
    const from = getCataloguePlace(placeId);
    if (!from?.lngLat) return;
    const controller = new AbortController();
    const token = mapboxToken();
    useArSession.getState().setRouteLoading();
    fetchWalkingRoute({
      from,
      to: catalogueNearbyPlaces(from, catalogue, NEARBY_STOPS).map((entry) => entry.place),
      accessToken: token.kind === 'public' ? token.token : undefined,
      signal: controller.signal,
    }).then(
      (route) => useArSession.getState().setRoute(route),
      (error: unknown) => {
        if (!controller.signal.aborted) throw error;
      },
    );
    return () => controller.abort();
  }, [placeId, catalogue]);
}
