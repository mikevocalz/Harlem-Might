import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cameraYawDeg, solveCompassPlacement } from '@mapbox/react-native-mapbox-ar-reactvision/src/compassPlacement.ts';
import { layoutRouteChevrons } from '@mapbox/react-native-mapbox-ar-reactvision/src/chevrons.ts';
import type { EnuPlacement } from '@mapbox/react-native-mapbox-ar-reactvision/src/enu.ts';
import type { GeoWorldPosition } from '@mapbox/react-native-mapbox-ar-reactvision/src/types.ts';
import { fixtureRoute } from '@acme/app/features/navigation/testing/fixtures.ts';
import type { ActiveRoute, ActiveTrip, NavigationSession } from '@acme/app/features/navigation/model/session.ts';
import type { RouteMatch } from '@acme/app/features/navigation/model/location.ts';
import type { PositioningState, RouteProgress } from '@acme/app/features/navigation/model/progress.ts';
import { routeSteps } from '@acme/app/features/navigation/model/route.ts';
import {
  CHEVRON_PAST_MANEUVER_M,
  addYawSample,
  alongTrackOnFrame,
  angle68From95,
  arTrackingFromViro,
  canCompleteCalibration,
  chevronStopAlongTrackM,
  compassYawAccuracyDeg,
  guidanceBearingDeg,
  isArNavigationPhase,
  isArNavigationScreen,
  isBetterPlacement,
  isCompassSettled,
  localPointOf,
  maneuverTurnDeg,
  navArPresentation,
  placementConfidence,
  pointOnFrame,
  projectNavRoute,
  rebasePlacement,
  relativeDirection,
  shouldResolvePlacement,
  summarizeYawSamples,
  wrapDeg,
  type NavArPresentationInput,
  type NavPlacement,
  type YawSample,
} from './navAr.ts';

const near = (actual: number, expected: number, tol: number, label: string) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: expected ${expected} ±${tol}, got ${actual}`);

const APOLLO_SYLVIAS = 'apollo-theater--sylvias-restaurant';
const U_ROUTE = 'studio-museum-harlem--via-sylvias--west-126th';

const active = (name: string, generation = 1): ActiveRoute => ({
  route: fixtureRoute(name),
  alternatives: [],
  generation,
  receivedAtMs: 0,
});

function toWorld(placement: EnuPlacement, local: GeoWorldPosition): GeoWorldPosition {
  const yaw = (placement.rotation[1] * Math.PI) / 180;
  return [
    placement.position[0] + Math.cos(yaw) * local[0] + Math.sin(yaw) * local[2],
    placement.position[1] + local[1],
    placement.position[2] - Math.sin(yaw) * local[0] + Math.cos(yaw) * local[2],
  ];
}

describe('projectNavRoute', () => {
  it('projects every geometry vertex once, from the route start, keyed by generation', () => {
    const frame = projectNavRoute(active(APOLLO_SYLVIAS, 3));
    const route = fixtureRoute(APOLLO_SYLVIAS);
    assert.equal(frame.points.length, route.geometry.coordinates.length);
    assert.deepEqual(frame.points[0], [0, 0, -0]);
    assert.equal(frame.generation, 3);
    assert.equal(frame.origin.frame.kind, 'route-start');
    // Horizontal ENU length matches the provider's distance to within 2%.
    near(frame.cumulativeM[frame.cumulativeM.length - 1]!, route.distanceM, route.distanceM * 0.02, 'length');
  });
});

describe('alongTrackOnFrame', () => {
  const frame = projectNavRoute(active(U_ROUTE));
  const matchAt = (alongM: number, segmentIndex: number): RouteMatch => {
    const { point } = pointOnFrame(frame, alongM);
    // Back to WGS84 through the inverse of localPointOf, via a tiny search.
    const coords = fixtureRoute(U_ROUTE).geometry.coordinates;
    const a = coords[segmentIndex]!;
    const b = coords[segmentIndex + 1]!;
    const la = localPointOf(frame.origin, a);
    const lb = localPointOf(frame.origin, b);
    const t = Math.hypot(point[0] - la[0], point[2] - la[2]) / Math.hypot(lb[0] - la[0], lb[2] - la[2]);
    return {
      kind: 'matched',
      coordinate: { latitude: a.latitude + (b.latitude - a.latitude) * t, longitude: a.longitude + (b.longitude - a.longitude) * t },
      segmentIndex,
      alongTrackM: alongM,
      crossTrackM: 0,
      segmentBearingDeg: 0,
      travelDirection: 'forward',
      timestampMs: 0,
    };
  };

  it('stays on the pass of the doubled-back stretch the matcher chose', () => {
    // Segments 10–13 run up Malcolm X Boulevard and 13–17 come back down the
    // same pavement: the same point is on both passes.
    const up = alongTrackOnFrame(frame, matchAt(frame.cumulativeM[11]! + 3, 11));
    const down = alongTrackOnFrame(frame, matchAt(frame.cumulativeM[15]! - 3, 15));
    assert.ok(up !== undefined && down !== undefined);
    assert.ok(down - up > 20, `the return pass is further along (${up} vs ${down})`);
    near(up, frame.cumulativeM[11]! + 3, 0.5, 'up pass');
  });

  it('is undefined while unmatched', () => {
    assert.equal(alongTrackOnFrame(frame, undefined), undefined);
    assert.equal(
      alongTrackOnFrame(frame, { kind: 'unmatched', reason: 'too-far', nearestDistanceM: 60, timestampMs: 0 }),
      undefined,
    );
  });
});

describe('chevron window', () => {
  it('ends 5 m past the next manoeuvre, at most 10 chevrons 2.5 m apart, on the route', () => {
    const frame = projectNavRoute(active(APOLLO_SYLVIAS));
    const progress = { distanceToNextManeuverM: 18, nextManeuver: routeSteps(fixtureRoute(APOLLO_SYLVIAS))[1]!.maneuver } as RouteProgress;
    const along = 40;
    const stop = chevronStopAlongTrackM(along, progress);
    assert.equal(stop, along + 18 + CHEVRON_PAST_MANEUVER_M);
    const chevrons = layoutRouteChevrons(frame.points, { fromAlongTrackM: along, stopAlongTrackM: stop });
    assert.ok(chevrons.length <= 10);
    assert.ok(chevrons.every((c) => c.alongTrackM <= stop! && c.alongTrackM > along));
    for (let i = 1; i < chevrons.length; i += 1) near(chevrons[i]!.alongTrackM - chevrons[i - 1]!.alongTrackM, 2.5, 1e-9, 'spacing');
  });

  it('runs to the route end on the final step', () => {
    assert.equal(chevronStopAlongTrackM(10, { distanceToNextManeuverM: 30 } as RouteProgress), undefined);
    assert.equal(chevronStopAlongTrackM(10, undefined), undefined);
  });
});

describe('rebasePlacement', () => {
  it('keeps every coordinate where it was when a reroute changes the origin', () => {
    const before = projectNavRoute(active(APOLLO_SYLVIAS, 1));
    const after = projectNavRoute(active(U_ROUTE, 2));
    const placement: EnuPlacement = { position: [4, -1.3, -9], rotation: [0, 37, 0] };
    const rebased = rebasePlacement(placement, before.origin, after.origin);
    assert.equal(rebased.rotation[1], 37);
    const somewhere = { latitude: 40.8095, longitude: -73.9465 };
    const w1 = toWorld(placement, localPointOf(before.origin, somewhere));
    const w2 = toWorld(rebased, localPointOf(after.origin, somewhere));
    near(w1[0], w2[0], 0.02, 'x');
    near(w1[1], w2[1], 1e-9, 'y');
    near(w1[2], w2[2], 0.02, 'z');
  });
});

describe('compass calibration', () => {
  const samples = (values: number[], stepMs = 200): YawSample[] =>
    values.reduce<YawSample[]>((acc, yawDeg, i) => addYawSample(acc, { yawDeg, timestampMs: i * stepMs }), []);

  it('averages across ±180 instead of to 0', () => {
    const summary = summarizeYawSamples(samples([179, -179, 178, -178]))!;
    near(Math.abs(summary.meanDeg), 180, 1e-9, 'mean');
    assert.ok(summary.resultant > 0.99);
  });

  it('settles after 10 agreeing samples over 1.5 s, not before', () => {
    assert.equal(isCompassSettled(summarizeYawSamples(samples([10, 11, 9, 10, 12]))), false, 'too few');
    const steady = summarizeYawSamples(samples([10, 11, 9, 10, 12, 8, 10, 11, 9, 10]))!;
    assert.equal(isCompassSettled(steady), true);
    const scattered = summarizeYawSamples(samples([10, 70, -40, 100, 0, 50, -60, 20, 80, -20]))!;
    assert.equal(isCompassSettled(scattered), false, 'a disturbed compass does not settle');
  });

  it('keeps the newest 30 samples', () => {
    assert.equal(samples(Array.from({ length: 50 }, () => 5)).length, 30);
  });

  it('never claims better yaw accuracy than the heading confidence floor', () => {
    const steady = summarizeYawSamples(samples(Array.from({ length: 30 }, () => 42)))!;
    assert.equal(compassYawAccuracyDeg(steady, undefined), 30);
    assert.equal(
      compassYawAccuracyDeg(steady, { headingDeg: 0, source: 'compass', confidence: 'high', consistency: 1, timestampMs: 0 }),
      6,
    );
  });

  it('feeds solveCompassPlacement with the library sign convention', () => {
    // Camera turned 90° left of −z, compass says it faces north.
    const forward: GeoWorldPosition = [-1, 0, 0];
    const yaw = cameraYawDeg(forward) + 0;
    const placement = solveCompassPlacement({
      cameraWorldPosition: [0, 1.4, 0],
      cameraForward: forward,
      trueHeadingDeg: 0,
      cameraEnuOffset: { eastM: 0, northM: 0, upM: 0 },
    });
    near(placement.yawDeg, yaw, 1e-9, 'yaw');
    // A chevron for bearing 0 (north) must point where the camera looks.
    const tip = toWorld(placement, [0, 0, -1]);
    near(tip[0], -1, 1e-9, 'x');
    near(tip[2], 0, 1e-9, 'z');
  });
});

describe('placement quality', () => {
  it('converts 95% accuracies and grades them', () => {
    near(angle68From95(19.6), 10, 0.001, '1D 95 → 68');
    assert.equal(placementConfidence(5, 5), 'high');
    assert.equal(placementConfidence(15, 5), 'medium');
    assert.equal(placementConfidence(5, 30), 'low');
    assert.equal(placementConfidence(Number.NaN, 5), 'low');
  });

  const placement = (source: NavPlacement['source'], yawAccuracyDeg: number, solvedAtAlongM = 0, solvedAtMs = 0): NavPlacement => ({
    placement: { position: [0, 0, 0], rotation: [0, 0, 0] },
    source,
    confidence: 'medium',
    yawAccuracyDeg,
    solvedAtAlongM,
    solvedAtMs,
  });

  it('re-solves compass placements every 15 m and geospatial ones every 10 s', () => {
    assert.equal(shouldResolvePlacement({ current: placement('compass', 10, 100), alongM: 110, nowMs: 0 }), false);
    assert.equal(shouldResolvePlacement({ current: placement('compass', 10, 100), alongM: 115, nowMs: 0 }), true);
    assert.equal(shouldResolvePlacement({ current: placement('geospatial', 5, 0, 0), alongM: 0, nowMs: 9_999 }), false);
    assert.equal(shouldResolvePlacement({ current: placement('geospatial', 5, 0, 0), alongM: 0, nowMs: 10_000 }), true);
  });

  it('prefers geospatial, and needs a 2° gain to replace one', () => {
    assert.equal(isBetterPlacement(placement('compass', 6), placement('geospatial', 20)), true);
    assert.equal(isBetterPlacement(placement('geospatial', 20), placement('compass', 6)), false);
    assert.equal(isBetterPlacement(placement('geospatial', 8), placement('geospatial', 7)), false);
    assert.equal(isBetterPlacement(placement('geospatial', 8), placement('geospatial', 6)), true);
  });
});

describe('navArPresentation', () => {
  const route = fixtureRoute(APOLLO_SYLVIAS);
  const trip: ActiveTrip = {
    origin: { kind: 'device-location' },
    destination: { name: "Sylvia's", coordinate: route.geometry.coordinates.at(-1)! },
    mode: 'walking',
    activeRoute: active(APOLLO_SYLVIAS),
    deviation: { kind: 'on-route' },
    arrival: { kind: 'en-route', distanceM: 300 },
    reroute: { kind: 'idle' },
  };
  const tracking = (confidence: 'high' | 'medium' | 'low', isMovingTooFast = false): PositioningState => ({
    kind: 'tracking',
    confidence,
    sigmaM: 4,
    isMovingTooFast,
  });
  const solved = (confidence: NavPlacement['confidence']): NavPlacement => ({
    placement: { position: [0, 0, 0], rotation: [0, 0, 0] },
    source: 'compass',
    confidence,
    yawAccuracyDeg: 8,
    solvedAtAlongM: 0,
    solvedAtMs: 0,
  });
  const input = (over: Partial<NavArPresentationInput>): NavArPresentationInput => ({
    session: { phase: 'navigatingAR', ...trip },
    positioning: tracking('high'),
    arTracking: { kind: 'normal' },
    placement: solved('high'),
    isMatched: true,
    headingConfidence: 'high',
    ...over,
  });

  it('draws 3D content only when tracking, matching and placement all hold', () => {
    assert.deepEqual(navArPresentation(input({})), { kind: 'guidance', render: '3d', showDestination: true, confidence: 'high' });
    const medium = navArPresentation(input({ placement: solved('medium') }));
    assert.equal(medium.kind === 'guidance' && medium.render, '3d');
    assert.equal(medium.kind === 'guidance' && medium.showDestination, false, 'no destination marker below high');
  });

  it('falls back to a 2D arrow when anything is uncertain', () => {
    for (const over of [
      { placement: solved('low') },
      { placement: undefined },
      { arTracking: { kind: 'limited', reason: 'excessive-motion' } } as const,
      { isMatched: false },
      { positioning: tracking('low') },
      { positioning: { kind: 'lost', sinceMs: 0 } } as const,
    ] satisfies Partial<NavArPresentationInput>[]) {
      const p = navArPresentation(input(over));
      assert.equal(p.kind === 'guidance' && p.render, 'arrow-2d', JSON.stringify(over));
    }
  });

  it('pauses on the driving-speed guard whatever the phase', () => {
    assert.equal(navArPresentation(input({ positioning: tracking('high', true) })).kind, 'speed-paused');
    assert.equal(
      navArPresentation(input({ session: { phase: 'calibratingAR', ...trip }, positioning: tracking('high', true) })).kind,
      'speed-paused',
    );
  });

  it('reports a calibration checklist', () => {
    const p = navArPresentation(
      input({
        session: { phase: 'calibratingAR', ...trip },
        positioning: { kind: 'acquiring' },
        arTracking: { kind: 'initializing' },
        placement: undefined,
        headingConfidence: undefined,
      }),
    );
    assert.deepEqual(p, { kind: 'calibrating', checklist: { gps: 'acquiring', camera: 'starting', heading: 'waiting' } });
  });

  it('shows rerouting, paused and arrival states', () => {
    assert.equal(navArPresentation(input({ session: { phase: 'rerouting', resumePhase: 'navigatingAR', ...trip } })).kind, 'rerouting');
    assert.equal(navArPresentation(input({ session: { phase: 'paused', resumePhase: 'navigatingAR', ...trip } })).kind, 'paused');
    const arrived = navArPresentation(
      input({
        session: {
          phase: 'arrived',
          ...trip,
          arrival: { kind: 'arrived', confidence: 'estimated', target: trip.destination.coordinate, distanceM: 9, arrivedAtMs: 0 },
        },
        placement: solved('medium'),
      }),
    );
    assert.deepEqual(arrived, { kind: 'arrived', showDestination: false, confidence: 'estimated' });
  });

  it('completes calibration only with tracking, a match and a placement', () => {
    const calibrating = { session: { phase: 'calibratingAR', ...trip } as NavigationSession };
    assert.equal(canCompleteCalibration(input(calibrating)), true);
    assert.equal(canCompleteCalibration(input({ ...calibrating, placement: undefined })), false);
    assert.equal(canCompleteCalibration(input({ ...calibrating, isMatched: false })), false);
    assert.equal(canCompleteCalibration(input({ ...calibrating, arTracking: { kind: 'initializing' } })), false);
    assert.equal(canCompleteCalibration(input({})), false, 'already navigating');
  });

  it('knows which phases belong to the AR screen', () => {
    assert.equal(isArNavigationPhase({ phase: 'navigatingAR', ...trip }), true);
    assert.equal(isArNavigationPhase({ phase: 'rerouting', resumePhase: 'navigatingAR', ...trip }), true);
    assert.equal(isArNavigationPhase({ phase: 'rerouting', resumePhase: 'navigating', ...trip }), false);
    assert.equal(isArNavigationPhase({ phase: 'navigating', ...trip }), false);
    assert.equal(isArNavigationPhase({ phase: 'idle' }), false);
  });

  it('keeps the AR screen for an arrival reached in AR, not one reached on the map', () => {
    const arrived: NavigationSession = { phase: 'arrived', ...trip };
    assert.equal(isArNavigationScreen(arrived, { kind: 'normal' }), true);
    assert.equal(isArNavigationScreen(arrived, { kind: 'off' }), false);
    assert.equal(isArNavigationScreen({ phase: 'navigating', ...trip }, { kind: 'normal' }), false);
  });
});

describe('2D guidance', () => {
  it('buckets relative directions with wraparound', () => {
    assert.equal(relativeDirection(10), 'ahead');
    assert.equal(relativeDirection(-44), 'ahead');
    assert.equal(relativeDirection(-90), 'left');
    assert.equal(relativeDirection(90), 'right');
    assert.equal(relativeDirection(170), 'behind');
    assert.equal(relativeDirection(350), 'ahead');
    assert.equal(wrapDeg(540), 180);
  });

  it('points along the path, capped at the next manoeuvre', () => {
    const frame = projectNavRoute(active(U_ROUTE));
    // Just before the turn from West 125th onto Malcolm X Boulevard
    // (vertex 2), the arrow follows 125th up to the corner.
    const before = frame.cumulativeM[2]! - 8;
    const along125th = pointOnFrame(frame, before).bearingDeg;
    near(guidanceBearingDeg(frame, before, frame.cumulativeM[2]!), along125th, 1, 'capped at the corner');
  });

  it('turns manoeuvre modifiers into glyph rotations', () => {
    const m = (modifier: string, type = 'turn') => ({ type, modifier }) as never;
    assert.equal(maneuverTurnDeg(m('left')), -90);
    assert.equal(maneuverTurnDeg(m('slight-right')), 45);
    assert.equal(maneuverTurnDeg(m('uturn')), 180);
    assert.equal(maneuverTurnDeg(m('straight', 'arrive')), undefined);
  });

  it('maps Viro tracking callbacks', () => {
    assert.deepEqual(arTrackingFromViro(3, 1), { kind: 'normal' });
    assert.deepEqual(arTrackingFromViro(2, 2), { kind: 'limited', reason: 'excessive-motion' });
    assert.deepEqual(arTrackingFromViro(2, 3), { kind: 'limited', reason: 'insufficient-features' });
    assert.deepEqual(arTrackingFromViro(1, 1), { kind: 'initializing' });
  });
});
