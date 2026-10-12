import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { hasActiveTrip } from '@acme/app/features/navigation/model/session.ts';
import { resetNavigationStores, useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { fixtureDestination, fixtureRoute } from '@acme/app/features/navigation/testing/fixtures.ts';
import { useNavigationUi } from '@acme/app/features/navigation/view/navigationUi.store.ts';
import { useExplore } from '@acme/app/features/explore/explore.store.ts';
import {
  configureNavigationRuntime,
  isLocationRunning,
  navigationController,
  resetNavigationRuntimeForTests,
  startGuidance,
} from '@acme/app/features/navigation/view/runtime.ts';
import { createNavigationArHost, navigationArHostPresentation, syncNavigationArHost } from './navigationArHost.ts';
import { handoffArToExplore, prepareArMapReturn } from './navigationArVisit.ts';
import { isArNavigationScreen } from './navAr.ts';
import { useExploreLayoutStore } from '../spatial/exploreLayout.store.ts';
import { resolveExploreLayout } from '../spatial/exploreLayout.ts';

const routeName = 'apollo-theater--sylvias-restaurant';
const route = fixtureRoute(routeName);
const visible = {
  focused: true, foreground: true, showMap: true, visitOpen: true,
  detailOverlayWidth: 0, discoverOverlayWidth: 0,
};

afterEach(() => {
  resetNavigationRuntimeForTests();
  resetNavigationStores();
  useNavigationUi.getState().resetTrip();
  useNavigationUi.getState().setLocation('unknown');
  useExplore.getState().closePlace();
  prepareArMapReturn();
});

async function startWalk() {
  const counts = { routes: 0, watches: 0, stops: 0 };
  configureNavigationRuntime({
    provider: {
      id: 'mapbox', supportedModes: ['walking'],
      async getRoutes() {
        counts.routes++;
        return { kind: 'routes', provider: 'mapbox', routes: [route] };
      },
    },
    locationSource: {
      kind: 'native', check: async () => 'granted',
      watch() { counts.watches++; return () => { counts.stops++; }; },
    },
  });
  const controller = navigationController();
  await controller.planRoute({
    origin: { kind: 'device-location' }, originCoordinate: route.geometry.coordinates[0]!,
    destination: fixtureDestination(routeName), mode: 'walking',
  });
  useNavigationUi.getState().setLocation('granted');
  assert.ok(startGuidance());
  assert.ok(controller.enterAR());
  return { controller, counts };
}

describe('in-pane navigation AR ownership', () => {
  it('opens one visit without creating another trip, route request or position watch', async () => {
    const { controller, counts } = await startWalk();
    const session = useNavigationStore.getState().session;
    const host = createNavigationArHost(controller);
    assert.equal(host.getState().visit, undefined);
    let notifications = 0;
    const unsubscribe = host.subscribe(() => { notifications++; });
    host.getState().open();
    const visit = host.getState().visit;
    assert.equal(visit?.experience, 'navigation');
    host.getState().open();
    assert.equal(host.getState().visit, visit);
    assert.equal(notifications, 1);
    assert.equal(useNavigationStore.getState().session, session);
    assert.deepEqual(counts, { routes: 1, watches: 1, stops: 0 });
    unsubscribe();
    host.getState().close();
  });

  it('closing AR preserves the exact active walk and running position watch', async () => {
    const { controller, counts } = await startWalk();
    controller.setArTracking({ kind: 'normal' });
    const before = useNavigationStore.getState().session;
    assert.ok(hasActiveTrip(before));
    const host = createNavigationArHost(controller, true);
    host.getState().close();
    const after = useNavigationStore.getState().session;
    assert.ok(hasActiveTrip(after));
    assert.equal(after.phase, 'navigating');
    assert.equal(after.activeRoute, before.activeRoute);
    assert.equal(host.getState().visit, undefined);
    assert.deepEqual(useNavigationStore.getState().arTracking, { kind: 'off' });
    assert.ok(isLocationRunning());
    host.getState().close();
    assert.equal(useNavigationStore.getState().session, after);
    assert.deepEqual(counts, { routes: 1, watches: 1, stops: 0 });
  });

  it('adopts a legacy root AR session without restarting or exiting it', async () => {
    const { controller, counts } = await startWalk();
    const transferred = useNavigationStore.getState().session;
    const host = createNavigationArHost(controller, true);
    const visit = host.getState().visit;
    assert.equal(visit?.experience, 'navigation');
    host.getState().open();
    assert.equal(host.getState().visit, visit);
    assert.equal(useNavigationStore.getState().session, transferred);
    assert.equal(transferred.phase, 'calibratingAR');
    assert.deepEqual(counts, { routes: 1, watches: 1, stops: 0 });
    host.getState().close();
  });

  for (const hiddenPane of ['detail', 'discover'] as const) {
    it(`exposes the map before legacy handoff when compact ${hiddenPane} was visible`, async () => {
      const { controller, counts } = await startWalk();
      const session = useNavigationStore.getState().session;
      useExplore.getState().openPlace('sylvias-restaurant');
      if (hiddenPane === 'detail') useExploreLayoutStore.getState().showCompactDetail('map');
      else useExploreLayoutStore.getState().setCompactPane('discover');
      const layout = () => resolveExploreLayout({
        windowWidth: 390, hasSelection: true, detailPlacement: 'inline', isHorizon: false,
        compactPane: useExploreLayoutStore.getState().compactPane,
        discoverDrawerOpen: useExploreLayoutStore.getState().discoverDrawerOpen,
      });
      assert.equal(layout().showMap, false);
      let navigations = 0;
      handoffArToExplore(() => {
        navigations++;
        assert.equal(layout().showMap, true, 'map intent must precede route replacement');
        assert.equal(useNavigationStore.getState().session, session);
        assert.ok(isLocationRunning());
      });
      assert.equal(navigations, 1);
      assert.equal(useNavigationStore.getState().session, session);
      assert.equal(useExplore.getState().selectedPlaceId, 'sylvias-restaurant');
      assert.deepEqual(counts, { routes: 1, watches: 1, stops: 0 });
      const host = createNavigationArHost(controller, true);
      assert.equal(host.getState().visit?.experience, 'navigation');
      assert.equal(useNavigationStore.getState().session, session);
      host.getState().close();
    });
  }

  it('returning to the map from a paused AR visit keeps the walk paused', async () => {
    const { controller, counts } = await startWalk();
    assert.ok(controller.pause());
    const host = createNavigationArHost(controller, true);
    host.getState().close();
    const session = useNavigationStore.getState().session;
    assert.equal(session.phase, 'paused');
    if (session.phase === 'paused') assert.equal(session.resumePhase, 'navigating');
    assert.deepEqual(counts, { routes: 1, watches: 1, stops: 0 });
  });
});

describe('in-pane navigation AR presentation', () => {
  it('preserves its visit during backgrounding while releasing the camera', async () => {
    const { controller } = await startWalk();
    const host = createNavigationArHost(controller, true);
    const visit = host.getState().visit;
    const background = navigationArHostPresentation({ ...visible, foreground: false });
    assert.equal(background.hostVisible, true);
    assert.equal(background.cameraAllowed, false);
    assert.equal(host.getState().visit, visit);
    assert.equal(navigationArHostPresentation(visible).cameraAllowed, true);
    assert.equal(host.getState().visit, visit);
    host.getState().close();
  });

  it('withholds the host and camera when its tab is blurred, map is hidden, or visit is closed', () => {
    for (const state of [{ focused: false }, { showMap: false }, { visitOpen: false }]) {
      const presentation = navigationArHostPresentation({ ...visible, ...state });
      assert.equal(presentation.hostVisible, false);
      assert.equal(presentation.cameraAllowed, false);
    }
  });

  it('uses actual overlay widths as physical content insets without classifying hardware', () => {
    assert.deepEqual(navigationArHostPresentation({
      ...visible, detailOverlayWidth: 360, discoverOverlayWidth: 180,
    }), {
      hostVisible: true, cameraAllowed: true,
      contentInsets: { top: 0, bottom: 0, left: 180, right: 360 },
    });
    assert.deepEqual(navigationArHostPresentation(visible).contentInsets, {
      top: 0, bottom: 0, left: 0, right: 0,
    });
  });

  it('reserves the unconsumed bottom safe area beside a lateral rail', () => {
    assert.equal(navigationArHostPresentation({ ...visible, bottomInset: 34 }).contentInsets.bottom, 34);
    assert.equal(navigationArHostPresentation(visible).contentInsets.bottom, 0, 'bottom tabs already consume their inset');
  });

  it('keeps the visit and trip identities across window and overlay geometry changes', async () => {
    const { controller, counts } = await startWalk();
    const host = createNavigationArHost(controller, true);
    const visit = host.getState().visit;
    const session = useNavigationStore.getState().session;
    for (const width of [375, 600, 840, 1200, 839, 599, 375]) {
      const overlayWidth = width >= 600 ? width * 0.3 : 0;
      const presentation = navigationArHostPresentation({ ...visible, detailOverlayWidth: overlayWidth });
      assert.equal(presentation.contentInsets.right, overlayWidth);
      assert.equal(presentation.cameraAllowed, true);
      assert.equal(host.getState().visit, visit);
      assert.equal(useNavigationStore.getState().session, session);
    }
    assert.deepEqual(counts, { routes: 1, watches: 1, stops: 0 });
    host.getState().close();
  });
});

describe('focused navigation AR host synchronization', () => {
  const navigationInAr = () => {
    const { session, arTracking } = useNavigationStore.getState();
    return isArNavigationScreen(session, arTracking);
  };

  it('lets an already-mounted closed host adopt a later legacy AR session when focused', async () => {
    const { controller, counts } = await startWalk();
    assert.ok(controller.exitAR());
    const host = createNavigationArHost(controller);
    syncNavigationArHost(host, { focused: true, showMap: true, navigationInAr: navigationInAr() });
    assert.equal(host.getState().visit, undefined);
    assert.ok(controller.enterAR());
    const transferred = useNavigationStore.getState().session;
    syncNavigationArHost(host, { focused: true, showMap: true, navigationInAr: navigationInAr() });
    const visit = host.getState().visit;
    assert.equal(visit?.experience, 'navigation');
    syncNavigationArHost(host, { focused: true, showMap: true, navigationInAr: navigationInAr() });
    assert.equal(host.getState().visit, visit, 'repeated synchronization cannot recreate the visit');
    assert.equal(useNavigationStore.getState().session, transferred);
    assert.deepEqual(counts, { routes: 1, watches: 1, stops: 0 });
    host.getState().close();
  });

  for (const hidden of [{ focused: false, showMap: true }, { focused: true, showMap: false }]) {
    it(`does not adopt or exit another AR session while ${hidden.focused ? 'the map is hidden' : 'the tab is blurred'}`, async () => {
      const { controller, counts } = await startWalk();
      const foreignSession = useNavigationStore.getState().session;
      const host = createNavigationArHost(controller);
      syncNavigationArHost(host, { ...hidden, navigationInAr: navigationInAr() });
      assert.equal(host.getState().visit, undefined);
      assert.equal(useNavigationStore.getState().session, foreignSession);
      assert.equal(navigationInAr(), true);
      assert.deepEqual(counts, { routes: 1, watches: 1, stops: 0 });
    });
    it(`releases its own AR visit when ${hidden.focused ? 'the map becomes hidden' : 'the tab blurs'}`, async () => {
      const { controller, counts } = await startWalk();
      const host = createNavigationArHost(controller, true);
      syncNavigationArHost(host, { ...hidden, navigationInAr: navigationInAr() });
      assert.equal(host.getState().visit, undefined);
      assert.equal(useNavigationStore.getState().session.phase, 'navigating');
      assert.equal(navigationInAr(), false);
      assert.ok(isLocationRunning());
      assert.deepEqual(counts, { routes: 1, watches: 1, stops: 0 });
    });
  }

  it('does not reopen after an explicit return to map guidance', async () => {
    const { controller, counts } = await startWalk();
    const host = createNavigationArHost(controller);
    syncNavigationArHost(host, { focused: true, showMap: true, navigationInAr: navigationInAr() });
    host.getState().close();
    const mapSession = useNavigationStore.getState().session;
    assert.equal(mapSession.phase, 'navigating');
    syncNavigationArHost(host, { focused: true, showMap: true, navigationInAr: navigationInAr() });
    assert.equal(host.getState().visit, undefined);
    assert.equal(useNavigationStore.getState().session, mapSession);
    assert.deepEqual(counts, { routes: 1, watches: 1, stops: 0 });
  });
});
