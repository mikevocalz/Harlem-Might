import { useLocalSearchParams } from 'expo-router';
import { ExplorePlaceDetail } from '@acme/app';
import { EXPLORE_SURFACE } from '@/src/spatial/exploreWorkspace';
import { ExploreWorkspaceWindow } from '@/src/spatial/ExploreWorkspaceWindow';

export default function ExplorePlaceRoute() {
  const params = useLocalSearchParams<{ placeId?: string | string[] }>();
  const placeId = Array.isArray(params.placeId) ? params.placeId[0] : params.placeId;

  return (
    <ExploreWorkspaceWindow surfaceId={EXPLORE_SURFACE.placeDetail}>
      <ExplorePlaceDetail placeId={placeId ?? ''} />
    </ExploreWorkspaceWindow>
  );
}
