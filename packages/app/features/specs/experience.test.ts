import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ExplorePlace } from '../explore/explore.store.ts';
import type { NavigationState } from '../navigation/session/navigationStore.ts';
import {
  projectHarlemSpecs, SPECS_BACKPLATE_M, SPECS_BUTTON_SCALE, SPECS_WALK_FRAME_SCALE,
} from './experience.ts';

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

type Frame = ReturnType<typeof projectHarlemSpecs>;

// Half the height a single line of live text needs on the plate.
const TEXT_HALF_HEIGHT_M = 0.02;

/** Every text line and button plate sits inside the backplate, in hm-root space. */
function assertContentInsidePlate(frame: Frame): void {
  const byId = new Map(frame.scene.nodes.map(node => [node.id, node]));
  const plate = byId.get('hm-backplate');
  if (!plate?.scale) throw new Error(`${frame.view}: backplate with a scale`);
  const plateY = plate.position?.[1] ?? 0;
  const halfH = (SPECS_BACKPLATE_M.height * plate.scale[1]) / 2;
  const halfW = (SPECS_BACKPLATE_M.width * plate.scale[0]) / 2;
  const rootY = (node: { id: string; parentId?: string; position?: [number, number, number] }): number => {
    const own = node.position?.[1] ?? 0;
    const parent = node.parentId && node.parentId !== 'hm-root' ? byId.get(node.parentId) : undefined;
    return own + (parent ? rootY(parent) : 0);
  };
  for (const node of frame.scene.nodes) {
    if (node.id === 'hm-root' || node.id === 'hm-backplate' || node.kind === 'group') continue;
    const y = rootY(node);
    const half = node.kind === 'panel' && node.scale
      ? (SPECS_BACKPLATE_M.height * node.scale[1]) / 2 : TEXT_HALF_HEIGHT_M;
    assert.ok(y + half <= plateY + halfH, `${frame.view}: ${node.id} top inside plate`);
    assert.ok(y - half >= plateY - halfH, `${frame.view}: ${node.id} bottom inside plate`);
    if (node.kind === 'panel' && node.scale) {
      assert.ok((SPECS_BACKPLATE_M.width * node.scale[0]) / 2 <= halfW, `${frame.view}: ${node.id} fits plate width`);
    }
  }
}

/** Each action target's first child is the 32 x 7 cm plate, then its label. */
function assertFullSizeTargets(frame: Frame): void {
  assert.ok(frame.targets.length > 0, `${frame.view}: has targets`);
  for (const target of frame.targets) {
    const children = frame.scene.nodes.filter(node => node.parentId === target.targetId);
    assert.equal(children[0]?.kind, 'panel', `${target.targetId}: plate is the first child`);
    assert.deepEqual(children[0]?.scale, SPECS_BUTTON_SCALE);
    assert.equal(children[1]?.kind, 'text', `${target.targetId}: label is the plate's sibling`);
    assert.equal(children.length, 2);
  }
}

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
    const walkPlate = good.scene.nodes.find(node => node.id === 'hm-backplate');
    assert.deepEqual(walkPlate?.scale, SPECS_WALK_FRAME_SCALE);
    assert.equal(good.scene.nodes.find(node => node.id === 'hm-root')?.position?.[1], 0.15);
    assertContentInsidePlate(good);
    assertFullSizeTargets(good);

    assert.equal(projectHarlemSpecs({ places: [], navigation, nowMs: 40000 }).navigation, undefined);
    assert.equal(projectHarlemSpecs({ places: [], navigation }).navigation, undefined);
    assert.equal(projectHarlemSpecs({ places: [], navigation: {
      ...navigation, positioning: { kind: 'tracking', confidence: 'low', sigmaM: 200, isMovingTooFast: false },
    }, nowMs: 2000 }).navigation, undefined);
    const activeSession = navigation.session;
    if (!('activeRoute' in activeSession)) throw new Error('Expected active test session.');
    assert.equal(projectHarlemSpecs({ places: [], navigation: {
      ...navigation, session: { ...activeSession, phase: 'calibratingAR' },
    }, nowMs: 2000 }).navigation, undefined);
    assert.equal(projectHarlemSpecs({ places: [], navigation: {
      ...navigation, session: { ...activeSession, activeRoute: {
        ...activeSession.activeRoute, generation: 3,
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
    const arrivedSession = arriving.session;
    if (arrivedSession.phase !== 'arrived' || arrivedSession.arrival.kind !== 'arrived') {
      throw new Error('Expected an arrived test session with arrival details.');
    }
    const confirmed = projectHarlemSpecs({ places: [], navigation: {
      ...arriving, session: { ...arrivedSession, arrival: {
        ...arrivedSession.arrival, confidence: 'confirmed',
      } },
    } });
    assert.match(confirmed.scene.nodes.find(node => node.id === 'hm-subtitle')?.text ?? '', /arrived/);
    assertContentInsidePlate(confirmed);
    assertFullSizeTargets(confirmed);
  });

  it('sizes every non-walking plate to its layout and gives each action a full plate', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ ...apollo, id: 'p' + i, name: 'Place ' + i }));
    const frames: Frame[] = [
      projectHarlemSpecs({ places: many, navigation: idle() }),
      projectHarlemSpecs({ places: [apollo], navigation: idle() }),
      projectHarlemSpecs({ places: [apollo], selectedPlaceId: apollo.id, navigation: idle() }),
      projectHarlemSpecs({ places: [], selectedPlaceId: 'missing', navigation: idle() }),
      projectHarlemSpecs({ places: [], navigation: { ...idle(), session: {
        phase: 'error', error: { message: 'Route service offline.' },
      } as NavigationState['session'] } }),
    ];
    for (const frame of frames) {
      assertContentInsidePlate(frame);
      assertFullSizeTargets(frame);
    }
    assert.deepEqual(frames.map(frame => frame.view), ['discover', 'discover', 'place', 'error', 'error']);
  });
});
