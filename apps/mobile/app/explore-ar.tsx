import { useCallback, useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { Platform } from 'react-native';
import { useRouter } from 'solito/navigation';
import { ViroXRSceneNavigator, isMetaHorizonXR, isPico, isVisionOS } from '@reactvision/react-viro';
import { selectArTracking, selectSession, useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { getCataloguePlace, useExplore } from '@acme/app';
import { MightsButton, MightsHeading, MightsText, routes } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';
import { useReducedMotion } from '@acme/ui';
import { ExploreLoader } from '@acme/spatial/explore-loader';
import { HarlemStreetScene } from '../src/ar/HarlemStreetScene';
import { HarlemTabletopScene } from '../src/ar/HarlemTabletopScene';
import { sceneModeFor, useArSession, type ArSceneMode } from '../src/ar/arSession.store';
import { mapboxToken } from '../src/ar/mapboxToken';
import { useStreetMapLoader } from '../src/ar/useStreetMapLoader';
import { useTabletopRoute } from '../src/ar/useTabletopRoute';
import { canUseArNavigation, chooseArExperience } from '../src/ar/arNavigationEntry';
import { isArNavigationScreen } from '../src/ar/navAr';
import { getNavigationController } from '../src/ar/navigationRuntime';
import { createArVisit, handoffArToExplore } from '../src/ar/navigationArVisit';
import { isHorizonBuild } from '../src/spatial/horizonBuild';

/** Builds using the handheld walking renderer; native support is checked at explicit entry. */
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
  const placeId = useArSession((s) => s.requested?.placeId);
  const sceneMode = useArSession((s) => sceneModeFor(s.requested));
  const selectedPlaceId = useExplore((s) => s.selectedPlaceId);
  // A walk in an AR phase opens phone AR navigation on the same session; it
  // never requests a route of its own, so the tabletop route is skipped too.
  const navigationSessionInAR = useNavigationStore(
    (s) => isArNavigationScreen(selectSession(s), selectArTracking(s)),
  );
  const visitRef = useRef<StoreApi<ReturnType<typeof createArVisit>> | null>(null);
  if (visitRef.current === null) {
    visitRef.current = createStore(() => createArVisit(chooseArExperience({
      requestedScene: sceneMode,
      navigationAvailable: AR_NAVIGATION_SUPPORTED,
      navigationSessionInAR,
    }), getNavigationController()));
  }
  // A per-visit external store keeps renderer identity across session changes.
  // eslint-disable-next-line react-hooks/refs
  const visit = useStore(visitRef.current);
  const experience = visit.experience;
  // This route replaces the tabs under a Slot, so there may be no back stack.
  // A cancelled/unavailable navigation visit stays in its recovery screen;
  // it must never mount the unrelated tabletop renderer or request its route.
  const exit = useCallback(() => {
    visit.leave();
    router.replace(routes.explore());
  }, [router, visit]);
  // Legacy walking-AR URLs hand off to the existing Explore shell. Do not
  // attach a navigation visit here: its cleanup must not exit the pane owner.
  useEffect(() => visit.experience === 'navigation' ? undefined : visit.attach(), [visit]);
  const isNavigatingInAr = experience === 'navigation';
  useEffect(() => {
    if (isNavigatingInAr) handoffArToExplore(() => router.replace(routes.explore()));
  }, [isNavigatingInAr, router]);
  // Only the phone navigation layer reads the shared trip. Existing table
  // and street worlds, their place routes, and their controls stay untouched.
  useTabletopRoute(isNavigatingInAr ? undefined : (placeId ?? selectedPlaceId ?? undefined));
  const street = experience === 'street';
  // The map layer for the street scene: real buildings around the wearer.
  // The scene only draws what this publishes. Routes come from the shared
  // NavigationSession (useStreetNavigation).
  useStreetMapLoader(street, placeId ?? selectedPlaceId ?? undefined);

  if (isNavigatingInAr) return null;

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
      renderQuestPanel={(enter: () => void) => (
        <ArPanel
          mode={sceneMode}
          placeName={getCataloguePlace(selectedPlaceId ?? placeId)?.name}
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
    body: 'Harlem around you at full size: the real buildings on satellite ground, with gold pillars at places. Point at the ground and select to move. Select a pillar to see a place, or Go there to stand at it.',
    enter: 'Enter Harlem',
  },
};

/** Existing headset entry panel for the requested tabletop or street experience. */
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
  const reducedMotion = useReducedMotion();
  const routing = route.status === 'loading';
  const routeLine =
    routing
      ? 'Finding a walking route to nearby places.'
      : route.status === 'ready' && route.route.kind === 'walking'
        ? 'Walking route to the two nearest places.'
        : route.status === 'ready'
          ? 'No walking route available. Straight lines are shown instead.'
          : '';
  const mapLine =
    mode === 'street' && mapboxToken().kind !== 'public'
      ? 'This build has no public Mapbox token, so Harlem shows without real buildings or satellite ground.'
      : '';
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-surface p-8">
      <MightsHeading level={1} size="title">
        {copy.title(placeName ?? 'Harlem')}
      </MightsHeading>
      <MightsText>{copy.body}</MightsText>
      {/* The one real wait in the AR flow: the walking-route read. The
          orbital loader marks it; reduce-motion gets the pulse variant. */}
      {routing ? (
        <ExploreLoader size={120} phase={reducedMotion ? 'reduced' : 'loading'} label="Finding a walking route" />
      ) : null}
      {routeLine ? <MightsText>{routeLine}</MightsText> : null}
      {mapLine ? <MightsText>{mapLine}</MightsText> : null}
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
