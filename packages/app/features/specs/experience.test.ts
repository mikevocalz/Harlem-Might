import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ExplorePlace } from '../explore/explore.store.ts';
import type { NavigationState } from '../navigation/session/navigationStore.ts';
import { projectHarlemSpecs } from './experience.ts';

const apollo: ExplorePlace = {
  id: 'apollo-theater', name: 'Apollo Theater', category: 'Culture',
  area: '125th Street', tags: ['music'], shortDescription: 'A Harlem cultural landmark.',
  lngLat: [-73.9499948, 40.8100895],
};
const unmapped: ExplorePlace = {
  id: 'strivers-row', name: "Strivers' Row", category: 'History',
  area: 'Harlem', tags: [], shortDescription: 'Historic homes.',
};

const idle = (): NavigationState => ({
  session: { phase: 'idle' },
  routeLoading: { kind: 'idle' },
  positioning: { kind: 'acquiring' },
  arTracking: { kind: 'off' },
  progress: { kind: 'none' },
});

function titleOf(frame: ReturnType<typeof projectHarlemSpecs>): string | undefined {
  return frame.scene.nodes.find(node => node.id === 'hm-title')?.text;
}

describe('Harlem Might Specs scene projections', () => {
  it('renders real catalogue identifiers without claiming a live location or hours', () => {
    const frame = projectHarlemSpecs({ places: [apollo, unmapped], navigation: idle() });
    assert.equal(frame.view, 'discover');
    assert.equal(frame.targets[0]?.action, 'place:apollo-theater');
    assert.equal(frame.targets[1]?.action, 'place:strivers-row');
    assert.equal(frame.navigation, undefined);
    assert.equal(frame.scene.nodes.some(node => /hours|minutes away/i.test(node.text ?? '')), false);
    assert.deepEqual(JSON.parse(JSON.stringify(frame)), frame);
  });

  it('shows a routable place and offers only available actions', () => {
    const frame = projectHarlemSpecs({
      places: [apollo, unmapped], selectedPlaceId: apollo.id, navigation: idle(),
    });
    assert.equal(titleOf(frame), 'Apollo Theater');
    assert.deepEqual(frame.targets.map(target => target.action), [
      'directions:apollo-theater', 'close-place',
    ]);
    const noCoordinates = projectHarlemSpecs({
      places: [apollo, unmapped], selectedPlaceId: unmapped.id, navigation: idle(),
    });
    assert.deepEqual(noCoordinates.targets.map(target => target.action), ['close-place']);
  });

  it('does not fabricate a selected place and limits discovery interactions', () => {
    const lost = projectHarlemSpecs({ places: [], selectedPlaceId: 'missing', navigation: idle() });
    assert.equal(lost.view, 'error');
    const many = projectHarlemSpecs({
      places: Array.from({ length: 12 }, (_, i) => ({ ...apollo, id: 'p' + i })),
      navigation: idle(),
    });
    assert.equal(many.targets.length, 4);
  });

  it('uses the canonical route session; world overlays require trusted current positioning', () => {
    const maneuver = {
      type: 'turn', modifier: 'right',
      location: { latitude: 40.81, longitude: -73.95 },
      bearingBeforeDeg: 0, bearingAfterDeg: 90,
      instruction: 'Turn right onto West 125th Street.',
    } as const;
    const route = {
      id: 'walk-a', provider: 'mapbox', mode: 'walking',
      geometry: { kind: 'line-string', coordinates: [
        { latitude: 40.81, longitude: -73.95 },
        { latitude: 40.82, longitude: -73.94 },
      ] },
      distanceM: 200, durationS: 300,
      legs: [{ distanceM: 200, durationS: 300, steps: [{
        index: 0, maneuver, name: 'West 125th Street',
        distanceM: 200, durationS: 300,
        geometry: { kind: 'line-string', coordinates: [
          { latitude: 40.81, longitude: -73.95 },
          { latitude: 40.82, longitude: -73.94 },
        ] },
      }] }],
    } as const;
    const navigation: NavigationState = {
      ...idle(),
      session: {
        phase: 'navigatingAR',
        origin: { kind: 'device-location' }, mode: 'walking',
        destination: { name: 'Apollo Theater', placeId: 'apollo-theater', coordinate: {
          latitude: 40.8100895, longitude: -73.9499948,
        } },
        activeRoute: { route, alternatives: [], generation: 2, receivedAtMs: 500 },
        deviation: { kind: 'on-route' },
        arrival: { kind: 'en-route', distanceM: 150 },
        reroute: { kind: 'idle' },
      },
      arTracking: { kind: 'normal' },
      positioning: { kind: 'tracking', confidence: 'high', sigmaM: 3, isMovingTooFast: false },
      progress: { kind: 'tracking', progress: {
        routeId: 'walk-a', distanceTravelledM: 50, distanceRemainingM: 150,
        fractionTravelled: 0.25, durationRemainingS: 220, etaMs: 221_000,
        activeStepIndex: 0, activeStep: route.legs[0].steps[0],
        distanceToNextManeuverM: 60, timestampMs: 1000,
      } },
    };
    const good = projectHarlemSpecs({ places: [apollo], navigation, nowMs: 2000 });
    assert.equal(good.view, 'walking');
    assert.equal(good.navigation?.generation, 2);
    assert.equal(good.navigation?.plan.route.id, 'walk-a#2');
    assert.equal(good.targets.length, 1);
    assert.equal(good.scene.nodes.some(node => node.kind === 'panel'), false);

    assert.equal(projectHarlemSpecs({ places: [], navigation, nowMs: 40000 }).navigation, undefined);
    assert.equal(projectHarlemSpecs({ places: [], navigation }).navigation, undefined);
    assert.equal(projectHarlemSpecs({ places: [], navigation: {
      ...navigation, positioning: { kind: 'tracking', confidence: 'low', sigmaM: 200, isMovingTooFast: false },
    }, nowMs: 2000 }).navigation, undefined);
    assert.equal(projectHarlemSpecs({ places: [], navigation: {
      ...navigation, session: { ...navigation.session, phase: 'calibratingAR' },
    }, nowMs: 2000 }).navigation, undefined);
    assert.equal(projectHarlemSpecs({ places: [], navigation: {
      ...navigation, session: { ...navigation.session, activeRoute: {
        ...navigation.session.activeRoute, generation: 3,
      } },
    }, nowMs: 2000 }).navigation?.plan.route.id, 'walk-a#3');
  });

  it('distinguishes estimated arrival from confirmed arrival', () => {
    const arriving: NavigationState = {
      ...idle(),
      session: {
        phase: 'arrived',
        origin: { kind: 'device-location' }, mode: 'walking',
        destination: { name: 'Apollo Theater', placeId: 'apollo-theater',
          coordinate: { latitude: 40.81, longitude: -73.95 } },
        activeRoute: { route: {
          id: 'r', provider: 'mapbox', mode: 'walking',
          geometry: { kind: 'line-string', coordinates: [] }, distanceM: 1,
          durationS: 1, legs: [],
        }, alternatives: [], generation: 1, receivedAtMs: 0 },
        deviation: { kind: 'on-route' },
        arrival: { kind: 'arrived', confidence: 'estimated',
          target: { latitude: 40.81, longitude: -73.95 }, distanceM: 15, arrivedAtMs: 1 },
        reroute: { kind: 'idle' },
      },
    };
    const frame = projectHarlemSpecs({ places: [], navigation: arriving });
    assert.equal(frame.view, 'arrival');
    assert.match(frame.scene.nodes.find(node => node.id === 'hm-subtitle')?.text ?? '', /may be near/);
    assert.deepEqual(frame.targets.map(target => target.action), ['place:apollo-theater', 'end-navigation']);
    const confirmed = projectHarlemSpecs({ places: [], navigation: {
      ...arriving, session: { ...arriving.session, arrival: {
        ...arriving.session.arrival, confidence: 'confirmed',
      } },
    } });
    assert.match(confirmed.scene.nodes.find(node => node.id === 'hm-subtitle')?.text ?? '', /arrived/);
  });
});
