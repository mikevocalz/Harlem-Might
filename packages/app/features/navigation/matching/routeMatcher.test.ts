import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_NAVIGATION_CONFIG } from '../config.ts';
import type { LocalPoint } from '../geo/localFrame.ts';
import { pointAtDistance, segmentBearingDeg } from '../geo/polyline.ts';
import type { FilteredPosition, HeadingEstimate } from '../model/location.ts';
import { fixtureRoute } from '../testing/fixtures.ts';
import { createRouteMatcher, type RouteMatcher } from './routeMatcher.ts';

const T0 = 1_760_000_000_000;
const U_ROUTE = 'studio-museum-harlem--via-sylvias--west-126th';

function positionAt(matcher: RouteMatcher, point: LocalPoint, t: number, sigmaM = 4, speedMps = 1.4): FilteredPosition {
  return {
    coordinate: matcher.polyline.frame.toGeographic(point),
    sigmaM,
    velocityEastMps: 0,
    velocityNorthMps: speedMps,
    speedMps,
    timestampMs: t,
    confidence: 'high',
  };
}

const heading = (headingDeg: number, t: number): HeadingEstimate => ({
  headingDeg,
  source: 'course-over-ground',
  confidence: 'high',
  consistency: 1,
  timestampMs: t,
});

/** A point `offsetM` to the left of the route at `alongM`. */
function besideRoute(matcher: RouteMatcher, alongM: number, offsetM: number): LocalPoint {
  const { point, segmentIndex } = pointAtDistance(matcher.polyline, alongM);
  const rad = (segmentBearingDeg(matcher.polyline, segmentIndex) * Math.PI) / 180;
  // Left normal of a compass bearing θ is (−cos θ, sin θ) in east/north.
  return { eastM: point.eastM - Math.cos(rad) * offsetM, northM: point.northM + Math.sin(rad) * offsetM };
}

describe('createRouteMatcher on recorded Harlem routes', () => {
  it('snaps fixes on the route with near-zero cross-track and the right along-track', () => {
    const matcher = createRouteMatcher(fixtureRoute('apollo-theater--marcus-garvey-park'), DEFAULT_NAVIGATION_CONFIG.matching);
    for (let along = 0, i = 0; along < matcher.polyline.lengthM; along += 25, i += 1) {
      const m = matcher.match(positionAt(matcher, pointAtDistance(matcher.polyline, along).point, T0 + i * 18_000), undefined, 5);
      assert.equal(m.kind, 'matched');
      if (m.kind === 'matched') {
        assert.ok(Math.abs(m.alongTrackM - along) < 0.5, `along ${m.alongTrackM} vs ${along}`);
        assert.ok(Math.abs(m.crossTrackM) < 0.5);
      }
    }
  });

  it('keeps a fix that lands nearer West 126th on West 125th, where the walker is', () => {
    const matcher = createRouteMatcher(fixtureRoute(U_ROUTE), DEFAULT_NAVIGATION_CONFIG.matching);
    // Walk east on West 125th to 56 m. Then a multipath fix lands 55 m north:
    // 43 m from West 126th (which the route uses ~480 m later) and 55 m from
    // West 125th. No heading, so only continuity can keep the match.
    for (let i = 0; i <= 40; i += 1) {
      matcher.match(positionAt(matcher, pointAtDistance(matcher.polyline, i * 1.4).point, T0 + i * 1000), undefined, 5);
    }
    const wild = besideRoute(matcher, 57.4, 55);
    const m = matcher.match(positionAt(matcher, wild, T0 + 41_000, 20), undefined, 19);
    assert.ok(m.kind === 'matched' && m.alongTrackM < 120, `jumped to along ${m.kind === 'matched' ? m.alongTrackM : m.kind}`);
  });

  it('the same fix with no history snaps to West 126th, which is why continuity exists', () => {
    const matcher = createRouteMatcher(fixtureRoute(U_ROUTE), DEFAULT_NAVIGATION_CONFIG.matching);
    const wild = besideRoute(matcher, 57.4, 55);
    const m = matcher.match(positionAt(matcher, wild, T0, 20), undefined, 19);
    assert.ok(m.kind === 'matched' && m.alongTrackM > 400, `along ${m.kind === 'matched' ? m.alongTrackM : m.kind}`);
  });

  it('heading alone also keeps an eastbound walker off the westbound street', () => {
    const matcher = createRouteMatcher(fixtureRoute(U_ROUTE), DEFAULT_NAVIGATION_CONFIG.matching);
    const wild = besideRoute(matcher, 57.4, 55);
    const m = matcher.match(positionAt(matcher, wild, T0, 20), heading(segmentBearingDeg(matcher.polyline, 1), T0), 19);
    assert.ok(m.kind === 'matched' && m.alongTrackM < 120, `along ${m.kind === 'matched' ? m.alongTrackM : m.kind}`);
  });

  it('on the stretch of Malcolm X Boulevard walked twice, picks the pass the walker is on', () => {
    const matcher = createRouteMatcher(fixtureRoute(U_ROUTE), DEFAULT_NAVIGATION_CONFIG.matching);
    // First pass (northbound) reaches along ≈ 290; the return pass covers the
    // same pavement around along ≈ 380.
    for (let i = 0; i <= 200; i += 1) {
      matcher.match(positionAt(matcher, pointAtDistance(matcher.polyline, i * 1.4).point, T0 + i * 1000), undefined, 5);
    }
    const t = T0 + 201_000;
    const here = pointAtDistance(matcher.polyline, 282).point;
    const m = matcher.match(positionAt(matcher, here, t), undefined, 5);
    assert.ok(m.kind === 'matched' && Math.abs(m.alongTrackM - 282) < 3, `along ${m.kind === 'matched' ? m.alongTrackM : ''}`);
  });

  it('marks travel against the segment direction as backward', () => {
    const matcher = createRouteMatcher(fixtureRoute('apollo-theater--sylvias-restaurant'), DEFAULT_NAVIGATION_CONFIG.matching);
    const { point, segmentIndex } = pointAtDistance(matcher.polyline, 200);
    const reverse = (segmentBearingDeg(matcher.polyline, segmentIndex) + 180) % 360;
    const m = matcher.match(positionAt(matcher, point, T0), heading(reverse, T0), 5);
    assert.ok(m.kind === 'matched' && m.travelDirection === 'backward');
    const f = matcher.match(positionAt(matcher, point, T0 + 1000), heading((reverse + 180) % 360, T0 + 1000), 5);
    assert.ok(f.kind === 'matched' && f.travelDirection === 'forward');
  });

  it('refuses to snap a coarse fix but still measures its distance', () => {
    const matcher = createRouteMatcher(fixtureRoute('apollo-theater--sylvias-restaurant'), DEFAULT_NAVIGATION_CONFIG.matching);
    const m = matcher.match(positionAt(matcher, besideRoute(matcher, 100, 10), T0), undefined, 25);
    assert.equal(m.kind, 'unmatched');
    assert.ok(m.kind === 'unmatched' && m.reason === 'too-coarse' && Math.abs(m.nearestDistanceM - 10) < 1);
  });

  it('reports too-far beyond the candidate radius', () => {
    const matcher = createRouteMatcher(fixtureRoute('apollo-theater--sylvias-restaurant'), DEFAULT_NAVIGATION_CONFIG.matching);
    const m = matcher.match(positionAt(matcher, besideRoute(matcher, 100, 60), T0), undefined, 5);
    assert.ok(m.kind === 'unmatched' && m.reason === 'too-far' && m.nearestDistanceM > 50);
  });
});
