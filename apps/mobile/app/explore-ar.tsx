import { useRouter } from 'solito/navigation';
import { ViroXRSceneNavigator } from '@reactvision/react-viro';
import { getHarlemPlacePreview, useExplore } from '@acme/app';
import { MightsButton, MightsHeading, MightsText, routes } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';
import { HarlemTabletopScene } from '../src/ar/HarlemTabletopScene';
import { useArSession } from '../src/ar/arSession.store';
import { useTabletopRoute } from '../src/ar/useTabletopRoute';

const SCENE = { scene: HarlemTabletopScene };

/**
 * Harlem on a table, in passthrough (spec §6A.4 `tabletop`). Entered from
 * Place Detail's "View on a table" (ViewInArButton). On Quest the scene runs
 * in the headset view; this panel shows while it is closed.
 */
export default function ExploreArRoute() {
  const router = useRouter();
  // The root layout is a Slot, not a Stack, so this route replaced the tabs
  // and back() has no history ("GO_BACK was not handled"). Return to Explore
  // by replacing; the selected place lives in useExplore and stays open.
  const exit = () => router.replace(routes.explore());
  const placeId = useArSession((s) => s.requested?.placeId);
  const selectedPlaceId = useExplore((s) => s.selectedPlaceId);
  useTabletopRoute(placeId ?? selectedPlaceId ?? undefined);

  return (
    <ViroXRSceneNavigator
      vrInitialScene={SCENE}
      arInitialScene={SCENE}
      passthroughEnabled
      handTrackingEnabled
      trackingOrigin="floor"
      onExitViro={exit}
      renderQuestPanel={(enter) => (
        <TabletopPanel
          placeName={getHarlemPlacePreview(selectedPlaceId ?? placeId)?.name}
          onEnter={enter}
          onBack={exit}
        />
      )}
      style={{ flex: 1 }}
    />
  );
}

function TabletopPanel({
  placeName,
  onEnter,
  onBack,
}: {
  placeName: string | undefined;
  onEnter: () => void;
  onBack: () => void;
}) {
  const route = useArSession((s) => s.route);
  const routeLine =
    route.status === 'loading'
      ? 'Finding a walking route to nearby places.'
      : route.status === 'ready' && route.route.kind === 'walking'
        ? 'Walking route to the two nearest places.'
        : route.status === 'ready'
          ? 'No walking route available. The table shows straight lines, not a walking route.'
          : '';
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-surface p-8">
      <MightsHeading level={1} size="title">
        {placeName ?? 'Harlem'} on a table
      </MightsHeading>
      <MightsText>Harlem as a model on your table, with nearby places and the walk between them.</MightsText>
      {routeLine ? <MightsText>{routeLine}</MightsText> : null}
      <View className="flex-row gap-3">
        <MightsButton variant="primary" onPress={onEnter}>
          Enter table view
        </MightsButton>
        <MightsButton variant="ghost" onPress={onBack}>
          Back to Explore
        </MightsButton>
      </View>
    </View>
  );
}
