import { useLocalSearchParams } from 'expo-router';
import { ExplorePlaceDetail } from '@acme/app';

export default function ExplorePlaceRoute() {
  const params = useLocalSearchParams<{ placeId?: string | string[] }>();
  const placeId = Array.isArray(params.placeId) ? params.placeId[0] : params.placeId;

  return <ExplorePlaceDetail placeId={placeId ?? ''} />;
}
