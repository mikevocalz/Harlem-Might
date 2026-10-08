import { useEffect } from 'react';
import { useParams } from 'solito/navigation';
import { useExplore } from '@acme/app';

/**
 * Deep link `/explore/[placeId]`: selects the place, and the Explore layout
 * shows it. Detail itself renders in the layout, so its Horizon window keeps
 * one tree position. An unknown id still selects, and Detail shows its
 * not-found state with "Back to Explore".
 */
export default function ExplorePlaceRoute() {
  const params = useParams<{ placeId?: string | string[] }>();
  const placeId = Array.isArray(params?.placeId) ? params.placeId[0] : params?.placeId;
  const openPlace = useExplore((state) => state.openPlace);

  useEffect(() => {
    if (placeId) openPlace(placeId, null);
  }, [placeId, openPlace]);

  return null;
}
