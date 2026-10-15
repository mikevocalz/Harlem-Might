import { useEffect } from 'react';
import { getCataloguePlace, catalogueNearbyPlaces, usePlaceCatalogue } from '@acme/app';
import { useArSession } from './arSession.store';
import { mapboxToken } from './mapboxToken';
import { fetchWalkingRoute } from './walkingRoute';
import { startTabletopRouteRequest } from './tabletopRouteRequest';

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
    const token = mapboxToken();
    return startTabletopRouteRequest({
      placeId,
      from,
      to: from?.lngLat ? catalogueNearbyPlaces(from, catalogue, NEARBY_STOPS).map((entry) => entry.place) : [],
      accessToken: token.kind === 'public' ? token.token : undefined,
    }, { getSession: useArSession.getState, fetchRoute: fetchWalkingRoute });
  }, [placeId, catalogue]);
}
