import { Platform } from 'react-native';
import { useRouter } from 'solito/navigation';
import { ViroXRSceneNavigator, isMetaHorizonXR, isPico, isVisionOS } from '@reactvision/react-viro';
import { selectArTracking, selectSession, useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { getHarlemPlacePreview, useExplore } from '@acme/app';
import { MightsButton, MightsHeading, MightsText, routes } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';
import { HarlemStreetScene } from '../src/ar/HarlemStreetScene';
import { HarlemTabletopScene } from '../src/ar/HarlemTabletopScene';
import { sceneModeFor, useArSession, type ArSceneMode } from '../src/ar/arSession.store';
import { useTabletopRoute } from '../src/ar/useTabletopRoute';
import { HarlemNavigationAr } from '../src/ar/HarlemNavigationAr';
import { canUseArNavigation } from '../src/ar/arNavigationEntry';
import { isArNavigationScreen } from '../src/ar/navAr';
import { getNavigationController } from '../src/ar/navigationRuntime';
import { isHorizonBuild } from '../src/spatial/horizonBuild';

/** Phone AR navigation is a property of the build and device, fixed for the app's lifetime. */
const AR_NAVIGATION_SUPPORTED = canUseArNavigation({
  isHorizonBuild,
  isMetaHorizonXR,
  isPico,
  isVisionOS: isVisionOS(),
  platform: Platform.OS,
});

const TABLETOP_SCENE = { scene: HarlemTabletopScene };
const STREET_SCENE = { scene: HarlemStreetScene };

/**
 * Harlem on a table in passthrough (spec §6A.4 `tabletop`), or at street
 * scale in VR (decision S19). Entered from Place Detail (ViewInArButton),
 * which sets the requested mode before navigating here. On Quest the scene
 * runs in the headset view; this panel shows while it is closed.
 *
 * ViroXRSceneNavigator registers the Quest scene once, on mount, so the mode
 * is read once here; a new request reaches this route through a fresh mount.
 */
export default function ExploreArRoute() {
  const router = useRouter();
  // The root layout is a Slot, not a Stack, so this route replaced the tabs
  // and back() has no history ("GO_BACK was not handled"). Return to Explore
  // by replacing; the selected place lives in useExplore and stays open.
  const exit = () => router.replace(routes.explore());
  const placeId = useArSession((s) => s.requested?.placeId);
  const sceneMode = useArSession((s) => sceneModeFor(s.requested));
  const selectedPlaceId = useExplore((s) => s.selectedPlaceId);
  // A walk in an AR phase opens phone AR navigation on the same session; it
  // never requests a route of its own, so the tabletop route is skipped too.
  const isNavigatingInAr = useNavigationStore(
    (s) => AR_NAVIGATION_SUPPORTED && isArNavigationScreen(selectSession(s), selectArTracking(s)),
  );
  useTabletopRoute(isNavigatingInAr ? undefined : (placeId ?? selectedPlaceId ?? undefined));
  const street = sceneMode === 'street';

  if (isNavigatingInAr) {
    return (
      <HarlemNavigationAr
        onBackToMap={() => {
          // Leaves AR only; the walk keeps going on the map.
          const controller = getNavigationController();
          controller.exitAR();
          controller.setArTracking({ kind: 'off' });
          exit();
        }}
        onExplorePlace={(destinationPlaceId) => {
          getNavigationController().cancel();
          if (destinationPlaceId) useExplore.getState().selectPlace(destinationPlaceId);
          exit();
        }}
      />
    );
  }

  return (
    <ViroXRSceneNavigator
      vrInitialScene={street ? STREET_SCENE : TABLETOP_SCENE}
      arInitialScene={TABLETOP_SCENE}
      // Street scale is fully virtual (a ViroScene root); the tabletop sits
      // on a real table and needs passthrough.
      passthroughEnabled={!street}
      handTrackingEnabled
      trackingOrigin="floor"
      onExitViro={exit}
      renderQuestPanel={(enter) => (
        <ArPanel
          mode={sceneMode}
          placeName={getHarlemPlacePreview(selectedPlaceId ?? placeId)?.name}
          onEnter={enter}
          onBack={exit}
        />
      )}
      style={{ flex: 1 }}
    />
  );
}

const PANEL_COPY: Record<ArSceneMode, { title: (place: string) => string; body: string; enter: string }> = {
  tabletop: {
    title: (place) => `${place} on a table`,
    body: 'Harlem as a model on your table, with nearby places and the walk between them.',
    enter: 'Enter table view',
  },
  street: {
    title: (place) => `Stand at ${place}`,
    body: 'Harlem around you at full size: gold pillars mark places and the walking route runs along the ground. Point at the ground and select to move. Turn with the buttons in front of you.',
    enter: 'Enter Harlem',
  },
};

function ArPanel({
  mode,
  placeName,
  onEnter,
  onBack,
}: {
  mode: ArSceneMode;
  placeName: string | undefined;
  onEnter: () => void;
  onBack: () => void;
}) {
  const copy = PANEL_COPY[mode];
  const route = useArSession((s) => s.route);
  const routeLine =
    route.status === 'loading'
      ? 'Finding a walking route to nearby places.'
      : route.status === 'ready' && route.route.kind === 'walking'
        ? 'Walking route to the two nearest places.'
        : route.status === 'ready'
          ? 'No walking route available. Straight lines are shown instead.'
          : '';
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-surface p-8">
      <MightsHeading level={1} size="title">
        {copy.title(placeName ?? 'Harlem')}
      </MightsHeading>
      <MightsText>{copy.body}</MightsText>
      {routeLine ? <MightsText>{routeLine}</MightsText> : null}
      <View className="flex-row gap-3">
        <MightsButton variant="primary" onPress={onEnter}>
          {copy.enter}
        </MightsButton>
        <MightsButton variant="ghost" onPress={onBack}>
          Back to Explore
        </MightsButton>
      </View>
    </View>
  );
}
