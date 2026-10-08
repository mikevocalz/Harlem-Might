import { useRouter } from 'solito/navigation';
import { isMetaHorizonXR } from '@reactvision/react-viro';
import { getHarlemPlacePreview, useExplore } from '@acme/app';
import { MightsButton } from '@acme/ui/mights';
import { isHorizonBuild } from '../spatial/horizonBuild';
import { canViewInAr } from './arEntry';
import { useArSession } from './arSession.store';

/**
 * "View on a table" for Place Detail. Renders nothing unless this is the
 * quest build on Meta Horizon and the place has coordinates. Selects the
 * place, starts a tabletop session and opens the AR route.
 */
export function ViewInArButton({ placeId }: { placeId: string }) {
  const router = useRouter();
  const place = getHarlemPlacePreview(placeId) ?? undefined;
  if (!canViewInAr({ isHorizonBuild, isMetaHorizonXR, place })) return null;

  return (
    <MightsButton
      size="sm"
      variant="primary"
      onPress={() => {
        useExplore.getState().selectPlace(placeId);
        useArSession.getState().request({ mode: 'tabletop', placeId });
        router.push('/explore-ar');
      }}
    >
      View on a table
    </MightsButton>
  );
}
