import { useRouter } from 'solito/navigation';
import { isMetaHorizonXR } from '@reactvision/react-viro';
import { getHarlemPlacePreview, useExplore } from '@acme/app';
import type { ArModeRequest } from '@viro-external/xr-contract';
import { MightsButton } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';
import { isHorizonBuild } from '../spatial/horizonBuild';
import { canViewInAr } from './arEntry';
import { useArSession } from './arSession.store';

/**
 * The two headset entries for Place Detail: "View on a table" (tabletop, in
 * passthrough) and "Stand on the street" (1:1 VR, decision S19). Renders
 * nothing unless this is the quest build on Meta Horizon and the place has
 * coordinates. Each selects the place, starts a session in its mode and opens
 * the AR route. Place Detail renders it in its action row through `actions`.
 */
export function ViewInArButton({ placeId }: { placeId: string }) {
  const router = useRouter();
  const place = getHarlemPlacePreview(placeId) ?? undefined;
  if (!canViewInAr({ isHorizonBuild, isMetaHorizonXR, place })) return null;

  const open = (mode: Extract<ArModeRequest, 'tabletop' | 'street'>) => {
    useExplore.getState().selectPlace(placeId);
    useArSession.getState().request({ mode, placeId });
    router.push('/explore-ar');
  };

  // Quest-only, so always the 60dp Horizon primary-action size (S17).
  // Secondary: Get directions stays the one filled action in Detail.
  return (
    <View className="flex-row flex-wrap gap-3">
      <MightsButton size="xr-primary" variant="secondary" onPress={() => open('tabletop')}>
        View on a table
      </MightsButton>
      <MightsButton size="xr-primary" variant="secondary" onPress={() => open('street')}>
        Stand on the street
      </MightsButton>
    </View>
  );
}
