import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { hasActiveTrip } from '@acme/app/features/navigation/model/session.ts';
import { configureNavigationRuntime, isLocationRunning, navigationController, resetNavigationRuntimeForTests, startLocation } from '@acme/app/features/navigation/view/runtime.ts';
import { resetNavigationStores, useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { fixtureDestination, fixtureRoute } from '@acme/app/features/navigation/testing/fixtures.ts';
import { useExplore } from '@acme/app/features/explore/explore.store.ts';
import { useExploreLayoutStore } from '../spatial/exploreLayout.store.ts';
import { resolveExploreLayout } from '../spatial/exploreLayout.ts';
import { createArVisit, finishArNavigation, prepareArMapReturn, prepareArPlaceReturn } from './navigationArVisit.ts';

const route = fixtureRoute('apollo-theater--sylvias-restaurant');
afterEach(() => {
  resetNavigationRuntimeForTests();
  resetNavigationStores();
  useExplore.getState().closePlace();
  prepareArMapReturn();
});

describe('AR return intent in compact Explore', () => {
  const layout = () => resolveExploreLayout({
    windowWidth: 375, hasSelection: useExplore.getState().selectedPlaceId !== null,
    detailPlacement: 'inline', isHorizon: false,
    compactPane: useExploreLayoutStore.getState().compactPane,
    discoverDrawerOpen: useExploreLayoutStore.getState().discoverDrawerOpen,
  });
  it('Back from a directions-pane entry exposes the map without discarding selection', () => {
    useExplore.getState().openPlace('apollo-theater', 'place-row');
    useExploreLayoutStore.getState().showCompactDetail('discover');
    useExploreLayoutStore.getState().setDiscoverDrawerOpen(true);
    assert.equal(layout().showMap, false);
    prepareArMapReturn();
    assert.equal(layout().showMap, true);
    assert.equal(useExplore.getState().selectedPlaceId, 'apollo-theater');
    assert.equal(useExploreLayoutStore.getState().discoverDrawerOpen, false);
  });
  it('Explore place opens the destination with a return-to-map intent', () => {
    prepareArPlaceReturn('sylvias-restaurant');
    assert.equal(useExplore.getState().selectedPlaceId, 'sylvias-restaurant');
    assert.equal(useExplore.getState().sheet.open, true);
    assert.equal(useExplore.getState().sheet.returnFocusId, null);
    assert.equal(layout().detail?.kind, 'screen');
    assert.equal(layout().showMap, false);
    useExploreLayoutStore.getState().leaveCompactDetail();
    assert.equal(layout().showMap, true);
  });
  it('an arrival without a catalogue place returns to the map', () => {
    useExploreLayoutStore.getState().showCompactDetail('discover');
    prepareArPlaceReturn(undefined);
    assert.equal(useExploreLayoutStore.getState().compactPane, 'map');
  });
});
async function startVisit() {
  let stopped = 0;
  configureNavigationRuntime({
    provider: { id: 'mapbox', supportedModes: ['walking'], async getRoutes() { return { kind: 'routes', provider: 'mapbox', routes: [route] }; } },
    locationSource: { kind: 'native', async check() { return 'granted'; }, watch() { return () => { stopped += 1; }; } },
  });
  const controller = navigationController();
  await controller.planRoute({ origin: { kind: 'device-location' }, originCoordinate: route.geometry.coordinates[0]!, destination: fixtureDestination('apollo-theater--sylvias-restaurant', false), mode: 'walking' });
  assert.ok(controller.start());
  assert.ok(controller.enterAR());
  controller.setArTracking({ kind: 'normal' });
  startLocation();
  return { controller, visit: createArVisit('navigation', controller), stopped: () => stopped };
}

describe('phone AR visit lifetime', () => {
  it('survives effect replay and cleans up a real unmount', async () => {
    const { visit } = await startVisit();
    const replayCleanup = visit.attach();
    replayCleanup();
    const unmount = visit.attach();
    await Promise.resolve();
    assert.equal(useNavigationStore.getState().session.phase, 'calibratingAR');
    unmount();
    await Promise.resolve();
    assert.equal(useNavigationStore.getState().session.phase, 'navigating');
    assert.ok(isLocationRunning());
  });
  it('an old visit cleanup cannot exit a newer attached AR visit', async () => {
    const { controller, visit } = await startVisit();
    const oldUnmount = visit.attach();
    visit.leave();
    oldUnmount();
    assert.ok(controller.enterAR());
    const nextVisit = createArVisit('navigation', controller);
    const nextUnmount = nextVisit.attach();
    await Promise.resolve();
    assert.equal(useNavigationStore.getState().session.phase, 'calibratingAR');
    // A late Back callback from the old screen is equally harmless.
    visit.leave();
    assert.equal(useNavigationStore.getState().session.phase, 'calibratingAR');
    nextUnmount();
    await Promise.resolve();
    assert.equal(useNavigationStore.getState().session.phase, 'navigating');
  });
  it('keeps the chosen renderer after cancellation or unavailable AR', async () => {
    const { controller, visit } = await startVisit();
    controller.setArTracking({ kind: 'unavailable', reason: 'permission-denied' });
    assert.equal(visit.experience, 'navigation');
    controller.cancel();
    assert.equal(visit.experience, 'navigation');
  });
  it('Back and repeated unmount cleanup keep the route and position watch running', async () => {
    const { visit, stopped } = await startVisit();
    const before = useNavigationStore.getState().session;
    assert.ok(hasActiveTrip(before));
    visit.leave();
    visit.leave();
    const after = useNavigationStore.getState().session;
    assert.ok(hasActiveTrip(after));
    assert.equal(after.phase, 'navigating');
    assert.equal(after.activeRoute, before.activeRoute);
    assert.deepEqual(useNavigationStore.getState().arTracking, { kind: 'off' });
    assert.ok(isLocationRunning());
    assert.equal(stopped(), 0);
  });
  it('a paused walk stays paused when returning to the map', async () => {
    const { controller, visit } = await startVisit();
    controller.pause();
    visit.leave();
    const session = useNavigationStore.getState().session;
    assert.equal(session.phase, 'paused');
    if (session.phase === 'paused') assert.equal(session.resumePhase, 'navigating');
  });
  it('returning during a reroute preserves the request and resumes it on the map', async () => {
    const { controller, visit } = await startVisit();
    assert.ok(controller.reroute());
    visit.leave();
    const session = useNavigationStore.getState().session;
    assert.equal(session.phase, 'rerouting');
    if (session.phase === 'rerouting') assert.equal(session.resumePhase, 'navigating');
    assert.ok(isLocationRunning());
  });
  it('End navigation stops the watch once, including repeated exit cleanup', async () => {
    const { visit, stopped } = await startVisit();
    finishArNavigation();
    visit.leave();
    finishArNavigation();
    assert.equal(useNavigationStore.getState().session.phase, 'idle');
    assert.equal(isLocationRunning(), false);
    assert.equal(stopped(), 1);
  });
  it('leaving tabletop does not touch the shared walking session', async () => {
    const { controller } = await startVisit();
    const before = useNavigationStore.getState().session;
    createArVisit('tabletop', controller).leave();
    assert.equal(useNavigationStore.getState().session, before);
  });
  it('arrival remains visible after the camera stops, and exploring ends the position watch', async () => {
    const { visit, stopped } = await startVisit();
    const trip = useNavigationStore.getState().session;
    assert.ok(hasActiveTrip(trip));
    useNavigationStore.setState({ session: {
      ...trip, phase: 'arrived', arrival: { kind: 'arrived', confidence: 'estimated',
        target: trip.destination.coordinate, distanceM: 12, arrivedAtMs: Date.now() },
    } });
    visit.leave();
    assert.equal(visit.experience, 'navigation');
    assert.equal(useNavigationStore.getState().session.phase, 'arrived');
    assert.deepEqual(useNavigationStore.getState().arTracking, { kind: 'off' });
    finishArNavigation();
    assert.equal(stopped(), 1);
  });
});
