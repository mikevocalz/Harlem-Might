import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { HeadingSample, LocationFix } from '../model/location.ts';
import type { RouteRequest } from '../model/route.ts';
import type { RouteProvider } from '../providers/routeProvider.ts';
import { navigationFixStore, resetNavigationStores, useNavigationStore } from '../session/navigationStore.ts';
import { fixtureDestination, fixtureRoute, loadFixture, lngLatToCoordinate } from '../testing/fixtures.ts';
import { flush } from '../testing/manualClock.ts';
import { createNavigationHostLifecycle } from './hostLifecycle.ts';
import type { LocationSource, LocationWatchHandlers } from './locationSource.ts';
import { useNavigationUi } from './navigationUi.store.ts';
import {
  closeDirections,
  configureNavigationRuntime,
  createUnconfiguredProvider,
  devicePositionForPlanning,
  endNavigation,
  isLocationRunning,
  navigationController,
  openDirections,
  requestDirections,
  resetNavigationRuntimeForTests,
  resumeGuidance,
  stopLocation,
  startGuidance,
  startLocation,
} from './runtime.ts';

const NAME = 'apollo-theater--sylvias-restaurant';
const ORIGIN = lngLatToCoordinate(loadFixture(NAME).origin.lngLat);
const DESTINATION = fixtureDestination(NAME, false);

function recordingProvider() {
  const requests: RouteRequest[] = [];
  const provider: RouteProvider = {
    id: 'mapbox',
    supportedModes: ['walking'],
    async getRoutes(request) {
      requests.push(request);
      return { kind: 'routes', provider: 'mapbox', routes: [fixtureRoute(NAME)] };
    },
  };
  return { provider, requests };
}

function fakeSource() {
  let handlers: LocationWatchHandlers | undefined;
  let stopped = 0;
  let started = 0;
  const source: LocationSource = {
    kind: 'browser',
    check: async () => 'granted',
    watch(h) {
      started++;
      handlers = h;
      return () => (stopped += 1);
    },
  };
  return {
    source,
    emit: (fix: LocationFix) => handlers?.onFix(fix),
    emitHeading: (heading: HeadingSample) => handlers?.onHeading?.(heading),
    report: (a: Parameters<LocationWatchHandlers['onAvailability']>[0]) => handlers?.onAvailability(a),
    stopped: () => stopped,
    started: () => started,
  };
}

afterEach(() => {
  resetNavigationRuntimeForTests();
  resetNavigationStores();
  useNavigationUi.getState().resetTrip();
  useNavigationUi.getState().setLocation('unknown');
});

describe('navigation runtime', () => {
  it('feeds native heading samples through the shared controller', () => {
    const fake = fakeSource();
    configureNavigationRuntime({ locationSource: fake.source });
    startLocation();
    const timestampMs = Date.now();
    fake.emitHeading({ headingDeg: 90, accuracyDeg: 5, timestampMs, source: 'compass' });
    assert.equal(navigationFixStore.getState().heading?.headingDeg, 90);
    assert.equal(navigationFixStore.getState().heading?.timestampMs, timestampMs);
  });

  it('hands out one controller, writing the shared store', () => {
    const { provider } = recordingProvider();
    configureNavigationRuntime({ provider });
    assert.equal(navigationController(), navigationController());
    navigationController().beginSelection({ kind: 'device-location' });
    assert.equal(useNavigationStore.getState().session.phase, 'selectingDestination');
  });

  it('feeds device fixes into the controller and plans from the latest one', async () => {
    const { provider, requests } = recordingProvider();
    const fake = fakeSource();
    configureNavigationRuntime({ provider, locationSource: fake.source });
    startLocation();
    startLocation(); // idempotent
    assert.ok(isLocationRunning());
    fake.report('granted');
    assert.equal(useNavigationUi.getState().location, 'granted');
    fake.emit({ coordinate: ORIGIN, accuracy: { horizontalM: 6 }, timestampMs: Date.now(), source: 'device-gps' });
    assert.ok(devicePositionForPlanning(navigationFixStore.getState()));

    assert.ok(requestDirections({ destination: DESTINATION, mode: 'walking', originChoice: { kind: 'device' } }));
    await flush();
    assert.equal(useNavigationStore.getState().session.phase, 'routeReady');
    assert.equal(requests.length, 1);
    // The filtered position starts the route: within a metre of the fix.
    assert.ok(Math.abs(requests[0]!.origin.latitude - ORIGIN.latitude) < 1e-5);
  });

  it('a chosen place starts a manual origin, labelled as such', async () => {
    const { provider, requests } = recordingProvider();
    configureNavigationRuntime({ provider });
    assert.equal(requestDirections({ destination: DESTINATION, mode: 'walking', originChoice: { kind: 'place', placeId: 'x' } }), false);
    assert.ok(
      requestDirections({
        destination: DESTINATION,
        mode: 'walking',
        originChoice: { kind: 'place', placeId: 'apollo-theater' },
        originPlace: { id: 'apollo-theater', name: 'Apollo Theater', coordinate: ORIGIN },
      }),
    );
    await flush();
    const session = useNavigationStore.getState().session;
    assert.equal(session.phase, 'routeReady');
    if (session.phase === 'routeReady') assert.deepEqual(session.origin, { kind: 'manual', coordinate: ORIGIN, label: 'Apollo Theater' });
    assert.deepEqual(requests[0]!.origin, ORIGIN);
  });

  it('refuses to plan from no position rather than inventing one', () => {
    configureNavigationRuntime({ provider: recordingProvider().provider });
    assert.equal(requestDirections({ destination: DESTINATION, mode: 'walking', originChoice: { kind: 'device' } }), false);
    assert.equal(useNavigationStore.getState().session.phase, 'idle');
  });

  it('plans from a coarse fix but never from a stale one', () => {
    const fix: LocationFix = { coordinate: ORIGIN, accuracy: { horizontalM: 400 }, timestampMs: 1, source: 'device-gps' };
    assert.deepEqual(devicePositionForPlanning({ lastFix: { kind: 'rejected', fix, reason: 'inaccurate' } }, 1), ORIGIN);
    assert.equal(devicePositionForPlanning({ lastFix: { kind: 'rejected', fix, reason: 'stale' } }), undefined);
  });

  it('rechecks age before planning after the GPS feed goes quiet', () => {
    const now = 1_000_000;
    const fix: LocationFix = { coordinate: ORIGIN, accuracy: { horizontalM: 6 }, timestampMs: now, source: 'device-gps' };
    const lastFix = {
      kind: 'accepted' as const, fix, didReset: false,
      filtered: {
        coordinate: ORIGIN, sigmaM: 4, velocityEastMps: 0, velocityNorthMps: 0,
        speedMps: 0, timestampMs: now, confidence: 'high' as const,
      },
    };
    assert.deepEqual(devicePositionForPlanning({ lastFix }, now), ORIGIN);
    assert.equal(devicePositionForPlanning({ lastFix }, now + 10_001), undefined);
    assert.equal(devicePositionForPlanning({ lastFix }, now - 60_000), undefined);
    assert.equal(devicePositionForPlanning({ lastFix: { kind: 'rejected', fix, reason: 'inaccurate' } }, now + 10_001), undefined);
  });

  it('End stops the feed, resets the session and the trip choices', async () => {
    const { provider } = recordingProvider();
    const fake = fakeSource();
    configureNavigationRuntime({ provider, locationSource: fake.source });
    startLocation();
    useNavigationUi.getState().setMode('cycling');
    useNavigationUi.getState().acknowledgeAwareness();
    endNavigation();
    assert.equal(fake.stopped(), 1);
    assert.equal(isLocationRunning(), false);
    assert.equal(useNavigationStore.getState().session.phase, 'idle');
    assert.equal(useNavigationUi.getState().mode, 'walking');
    assert.equal(useNavigationUi.getState().awarenessAcknowledged, false);
  });

  it('without a token, walking fails as missing-token and transit still hands off', async () => {
    const provider = createUnconfiguredProvider('missing-token');
    await assert.rejects(provider.getRoutes({ origin: ORIGIN, destination: DESTINATION, mode: 'walking' }), { kind: 'missing-token' });
    const transit = await provider.getRoutes({ origin: ORIGIN, destination: DESTINATION, mode: 'transit' });
    assert.equal(transit.kind, 'unsupported');
  });
});

describe('directions panel lifecycle', () => {
  it('open selects, close abandons planning, a running trip survives close', async () => {
    const { provider } = recordingProvider();
    configureNavigationRuntime({ provider });
    openDirections('sylvias-restaurant');
    assert.equal(useNavigationUi.getState().directionsPlaceId, 'sylvias-restaurant');
    assert.equal(useNavigationStore.getState().session.phase, 'selectingDestination');
    closeDirections();
    assert.equal(useNavigationStore.getState().session.phase, 'idle');
    assert.equal(useNavigationUi.getState().directionsPlaceId, null);

    openDirections('sylvias-restaurant');
    requestDirections({
      destination: DESTINATION,
      mode: 'walking',
      originChoice: { kind: 'place', placeId: 'apollo-theater' },
      originPlace: { id: 'apollo-theater', name: 'Apollo Theater', coordinate: ORIGIN },
    });
    await flush();
    assert.ok(startGuidance());
    assert.equal(isLocationRunning(), false, 'a manual origin does not start the feed');
    closeDirections();
    assert.equal(useNavigationStore.getState().session.phase, 'navigating');
    // Opening another place while guiding leaves the trip alone.
    openDirections('apollo-theater');
    assert.equal(useNavigationStore.getState().session.phase, 'navigating');
  });
});


describe('foreground guidance resume', () => {
  async function pausedTrip(device = true, ar = true) {
    const fake = fakeSource();
    configureNavigationRuntime({ provider: recordingProvider().provider, locationSource: fake.source });
    const controller = navigationController();
    await controller.planRoute({
      origin: device ? { kind: 'device-location' } : { kind: 'manual', coordinate: ORIGIN, label: 'Apollo' },
      originCoordinate: ORIGIN, destination: DESTINATION, mode: 'walking',
    });
    useNavigationUi.getState().setLocation('granted');
    assert.ok(startGuidance());
    if (ar) assert.ok(controller.enterAR());
    assert.ok(controller.pause());
    return fake;
  }

  for (const ar of [false, true]) {
    it(`Resume restarts a paused ${ar ? 'AR' : 'map'} watch after background and foreground`, async () => {
      const fake = await pausedTrip(true, ar);
      const lifecycle = createNavigationHostLifecycle({
        running: isLocationRunning, start: startLocation, stop: stopLocation,
        mayResume: () => !['idle', 'paused', 'arrived', 'error'].includes(useNavigationStore.getState().session.phase),
      });
      const release = lifecycle.mount(true);
      lifecycle.setActive(false);
      lifecycle.setActive(true);
      assert.equal(isLocationRunning(), false, 'paused trips must not automatically resume');
      assert.equal(fake.stopped(), 1);
      assert.ok(resumeGuidance());
      assert.equal(isLocationRunning(), true);
      assert.equal(fake.started(), 2);
      assert.equal(useNavigationStore.getState().session.phase, ar ? 'calibratingAR' : 'navigating');
      assert.equal(resumeGuidance(), false);
      assert.equal(fake.started(), 2, 'duplicate Resume cannot create another watch');
      release();
    });
  }

  it('does not prompt or restart a watch when location permission was revoked', async () => {
    const fake = await pausedTrip();
    stopLocation();
    useNavigationUi.getState().setLocation('denied');
    assert.ok(resumeGuidance());
    assert.equal(isLocationRunning(), false);
    assert.equal(fake.started(), 1);
  });

  it('does not start location for a manual-origin preview', async () => {
    const fake = await pausedTrip(false, false);
    assert.ok(resumeGuidance());
    assert.equal(isLocationRunning(), false);
    assert.equal(fake.started(), 0);
  });
});


describe('terminal arrival location ownership', () => {
  for (const confirms of [false, true]) {
    it(`keeps ${confirms ? 'confirmed' : 'estimated'} arrival terminal without acquiring location after a host restart`, async (t) => {
      let now = 1_760_000_000_000;
      t.mock.method(Date, 'now', () => now);
      const fake = fakeSource();
      const { provider, requests } = recordingProvider();
      configureNavigationRuntime({ provider, locationSource: fake.source });
      const controller = navigationController();
      await controller.planRoute({ origin: { kind: 'device-location' }, originCoordinate: ORIGIN, destination: DESTINATION, mode: 'walking' });
      useNavigationUi.getState().setLocation('granted');
      assert.ok(startGuidance());
      const lifecycle = createNavigationHostLifecycle({
        running: isLocationRunning, start: startLocation, stop: stopLocation,
        mayResume: () => !['idle', 'paused', 'arrived', 'error'].includes(useNavigationStore.getState().session.phase),
      });
      const release = lifecycle.mount(true);
      const emit = (accuracy: number) => {
        now += 1000;
        fake.emit({ coordinate: DESTINATION.coordinate, accuracy: { horizontalM: accuracy }, timestampMs: now, source: 'device-gps' });
      };
      emit(18);
      emit(18);
      const estimated = useNavigationStore.getState().session;
      assert.ok(estimated.phase === 'arrived' && estimated.arrival.kind === 'arrived' && estimated.arrival.confidence === 'estimated');
      assert.equal(fake.started(), 1);
      if (confirms) emit(5);
      const arrival = useNavigationStore.getState().session;
      assert.ok(arrival.phase === 'arrived' && arrival.arrival.kind === 'arrived');
      assert.equal(arrival.arrival.confidence, confirms ? 'confirmed' : 'estimated');
      assert.equal(arrival.activeRoute, estimated.activeRoute);
      assert.equal(fake.started(), 1, 'an existing foreground feed supplies any confirmation');
      lifecycle.setActive(false);
      lifecycle.setActive(true);
      release();
      const releaseAgain = lifecycle.mount(true);
      assert.equal(fake.stopped(), 1);
      assert.equal(isLocationRunning(), false);
      assert.equal(fake.started(), 1, 'neither foregrounding nor remounting restarts an arrived trip');
      assert.equal(useNavigationStore.getState().session, arrival, 'without another fix the arrival is unchanged');
      assert.equal(requests.length, 1);
      releaseAgain();
    });
  }
});
