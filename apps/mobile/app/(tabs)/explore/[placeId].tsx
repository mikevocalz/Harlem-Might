import { useEffect } from 'react';
import { useParams } from 'solito/navigation';
import { useRoute } from 'expo-router/react-navigation';
import { selectExplorePlaceRoute } from '../../../src/navigation/explorePlaceRoute';

/**
 * Deep link `/explore/[placeId]`: selects the place, and the Explore layout
 * shows it. Detail itself renders in the layout, so its Horizon window keeps
 * one tree position. An unknown id still selects, and Detail shows its
 * not-found state with "Back to Explore".
 */
export default function ExplorePlaceRoute() {
  const params = useParams<{ placeId?: string | string[] }>();
  const placeId = Array.isArray(params?.placeId) ? params.placeId[0] : params?.placeId;
  const route = useRoute();

  useEffect(() => {
    if (placeId) selectExplorePlaceRoute({ key: route.key, params: route.params, placeId });
  }, [placeId, route.key, route.params]);

  return null;
}
