import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { LocationFix } from '../model/location.ts';
import type { RouteRequest } from '../model/route.ts';
import type { RouteProvider } from '../providers/routeProvider.ts';
import { navigationFixStore, resetNavigationStores, useNavigationStore } from '../session/navigationStore.ts';
import { fixtureDestination, fixtureRoute, loadFixture, lngLatToCoordinate } from '../testing/fixtures.ts';
import { flush } from '../testing/manualClock.ts';
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
  const source: LocationSource = {
    kind: 'browser',
    check: async () => 'granted',
    watch(h) {
      handlers = h;
      return () => (stopped += 1);
    },
  };
  return {
    source,
    emit: (fix: LocationFix) => handlers?.onFix(fix),
    report: (a: Parameters<LocationWatchHandlers['onAvailability']>[0]) => handlers?.onAvailability(a),
    stopped: () => stopped,
  };
}

afterEach(() => {
  resetNavigationRuntimeForTests();
  resetNavigationStores();
  useNavigationUi.getState().resetTrip();
  useNavigationUi.getState().setLocation('unknown');
});

describe('navigation runtime', () => {
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
    assert.deepEqual(devicePositionForPlanning({ lastFix: { kind: 'rejected', fix, reason: 'inaccurate' } }), ORIGIN);
    assert.equal(devicePositionForPlanning({ lastFix: { kind: 'rejected', fix, reason: 'stale' } }), undefined);
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
