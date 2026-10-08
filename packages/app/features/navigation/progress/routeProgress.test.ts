import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_NAVIGATION_CONFIG } from '../config.ts';
import { pointAtDistance } from '../geo/polyline.ts';
import type { RouteMatch } from '../model/location.ts';
import { routeSteps } from '../model/route.ts';
import { createRouteMatcher } from '../matching/routeMatcher.ts';
import { FIXTURE_NAMES, fixtureRoute } from '../testing/fixtures.ts';
import { activeStepIndexAt, computeRouteProgress, createStepIndex } from './routeProgress.ts';

const T0 = 1_760_000_000_000;

function setup(name: string) {
  const route = fixtureRoute(name);
  const matcher = createRouteMatcher(route, DEFAULT_NAVIGATION_CONFIG.matching);
  return { route, matcher, index: createStepIndex(route, matcher.polyline) };
}

const matchedAt = (alongTrackM: number, timestampMs = T0): RouteMatch => ({
  kind: 'matched',
  coordinate: { latitude: 0, longitude: 0 },
  segmentIndex: 0,
  alongTrackM,
  crossTrackM: 0,
  segmentBearingDeg: 0,
  travelDirection: 'forward',
  timestampMs,
});

describe('createStepIndex on every recorded route', () => {
  for (const name of FIXTURE_NAMES) {
    it(`${name}: step starts are ordered and agree with provider step distances`, () => {
      const { route, index } = setup(name);
      const steps = routeSteps(route);
      assert.equal(index.startsM.length, steps.length);
      assert.equal(index.startsM[0], 0);
      for (let i = 1; i < index.startsM.length; i += 1) assert.ok(index.startsM[i]! >= index.startsM[i - 1]!);
      // Each step's start is the sum of the provider distances before it, to within a few metres.
      let sum = 0;
      steps.forEach((step, i) => {
        assert.ok(Math.abs(index.startsM[i]! - sum) < 5, `step ${i} start ${index.startsM[i]} vs sum ${sum}`);
        sum += step.distanceM;
      });
    });
  }
});

describe('computeRouteProgress', () => {
  it('starts with the whole route ahead', () => {
    const { route, index } = setup('apollo-theater--sylvias-restaurant');
    const p = computeRouteProgress(index, matchedAt(0));
    assert.equal(p.activeStepIndex, 0);
    assert.ok(Math.abs(p.distanceRemainingM - route.distanceM) < 1e-6);
    // ETA is built from step durations, which Mapbox rounds independently of the route total.
    const stepSum = routeSteps(route).reduce((sum, step) => sum + step.durationS, 0);
    assert.ok(Math.abs(p.durationRemainingS - stepSum) < 1e-6);
    assert.ok(Math.abs(stepSum - route.durationS) < 2, `step sum ${stepSum} vs route ${route.durationS}`);
    assert.equal(p.etaMs, T0 + stepSum * 1000);
    assert.equal(p.nextManeuver?.type, 'end-of-road');
    assert.equal(p.routeId, route.id);
  });

  it('walks through every maneuver of Apollo → Marcus Garvey Park in order', () => {
    const { route, index, matcher } = setup('apollo-theater--marcus-garvey-park');
    const seen: number[] = [];
    let lastRemaining = Number.POSITIVE_INFINITY;
    let lastToNext = Number.POSITIVE_INFINITY;
    let lastStep = 0;
    const samples: number[] = [];
    for (let along = 0; along < matcher.polyline.lengthM; along += 2) samples.push(along);
    samples.push(matcher.polyline.lengthM);
    for (const along of samples) {
      const p = computeRouteProgress(index, matchedAt(along));
      assert.ok(p.activeStepIndex >= lastStep, 'steps never go backwards when walking forwards');
      if (p.activeStepIndex === lastStep) assert.ok(p.distanceToNextManeuverM <= lastToNext + 1e-6);
      assert.ok(p.distanceRemainingM <= lastRemaining + 1e-6);
      if (seen.at(-1) !== p.activeStepIndex) seen.push(p.activeStepIndex);
      lastStep = p.activeStepIndex;
      lastToNext = p.distanceToNextManeuverM;
      lastRemaining = p.distanceRemainingM;
    }
    const end = computeRouteProgress(index, matchedAt(matcher.polyline.lengthM));
    assert.equal(end.activeStep.maneuver.type, 'arrive');
    assert.equal(end.nextManeuver, undefined);
    assert.ok(end.distanceRemainingM < 1e-6);
    assert.equal(seen.length, routeSteps(route).length, `visited ${seen.join(',')}`);
  });

  it('switches to the turn step at the corner, not before', () => {
    const { index } = setup('apollo-theater--sylvias-restaurant');
    const corner = index.startsM[1]!;
    assert.equal(computeRouteProgress(index, matchedAt(corner - 0.5)).activeStepIndex, 0);
    assert.equal(computeRouteProgress(index, matchedAt(corner + 0.5)).activeStepIndex, 1);
    const before = computeRouteProgress(index, matchedAt(corner - 10));
    assert.ok(Math.abs(before.distanceToNextManeuverM - 10) < 0.5);
    assert.equal(before.nextManeuver?.modifier, 'right');
  });

  it('uses per-step durations for the remaining time', () => {
    const { route, index } = setup('apollo-theater--sylvias-restaurant');
    const steps = routeSteps(route);
    const p = computeRouteProgress(index, matchedAt(index.startsM[2]!));
    const expected = steps.slice(2).reduce((s, step) => s + step.durationS, 0);
    assert.ok(Math.abs(p.durationRemainingS - expected) < 0.5);
  });

  it('clamps along-track outside the route', () => {
    const { route, index } = setup('apollo-theater--sylvias-restaurant');
    assert.equal(computeRouteProgress(index, matchedAt(-30)).distanceTravelledM, 0);
    assert.equal(computeRouteProgress(index, matchedAt(1e6)).distanceRemainingM, 0);
    assert.ok(activeStepIndexAt(index, 1e6) === routeSteps(route).length - 1);
  });

  it('refuses an unmatched position', () => {
    const { index } = setup('apollo-theater--sylvias-restaurant');
    assert.throws(
      () => computeRouteProgress(index, { kind: 'unmatched', reason: 'too-far', nearestDistanceM: 80, timestampMs: T0 }),
      RangeError,
    );
  });

  it('gets the same answer through the matcher as from a raw along-track value', () => {
    const { index, matcher } = setup('red-rooster-harlem--schomburg-center');
    const point = pointAtDistance(matcher.polyline, 400).point;
    const m = matcher.match(
      {
        coordinate: matcher.polyline.frame.toGeographic(point),
        sigmaM: 3,
        velocityEastMps: 0,
        velocityNorthMps: 0,
        speedMps: 0,
        timestampMs: T0,
        confidence: 'high',
      },
      undefined,
      4,
    );
    const viaMatcher = computeRouteProgress(index, m);
    const direct = computeRouteProgress(index, matchedAt(400));
    assert.equal(viaMatcher.activeStepIndex, direct.activeStepIndex);
    assert.ok(Math.abs(viaMatcher.distanceRemainingM - direct.distanceRemainingM) < 0.5);
  });
});
