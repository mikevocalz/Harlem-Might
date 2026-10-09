import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createArrivalDetector } from '../arrival/arrivalDetector.ts';
import { DEFAULT_NAVIGATION_CONFIG } from '../config.ts';
import { createLocalFrame, distanceM } from '../geo/localFrame.ts';
import type { FilteredPosition, LocationFix, RouteMatch } from '../model/location.ts';
import type { RouteDestination } from '../model/route.ts';
import { fixtureDestination, loadFixture, lngLatToCoordinate } from '../testing/fixtures.ts';
import { createOffRouteDetector } from './offRouteDetector.ts';

const T0 = 1_760_000_000_000;
const cfg = DEFAULT_NAVIGATION_CONFIG;

const fix = (t: number, accuracyM = 5, coordinate = { latitude: 40.81, longitude: -73.95 }): LocationFix => ({
  coordinate,
  accuracy: { horizontalM: accuracyM },
  timestampMs: t,
  source: 'device-gps',
});
const filtered = (t: number, speedMps = 1.4, coordinate = { latitude: 40.81, longitude: -73.95 }): FilteredPosition => ({
  coordinate,
  sigmaM: 3,
  velocityEastMps: speedMps,
  velocityNorthMps: 0,
  speedMps,
  timestampMs: t,
  confidence: 'high',
});
const matched = (crossTrackM: number, t: number, travelDirection: 'forward' | 'backward' = 'forward'): RouteMatch => ({
  kind: 'matched',
  coordinate: { latitude: 40.81, longitude: -73.95 },
  segmentIndex: 0,
  alongTrackM: 10,
  crossTrackM,
  segmentBearingDeg: 90,
  travelDirection,
  timestampMs: t,
});
const unmatched = (distance: number, t: number): RouteMatch => ({
  kind: 'unmatched',
  reason: 'too-far',
  nearestDistanceM: distance,
  timestampMs: t,
});

describe('createOffRouteDetector', () => {
  it('ignores one multipath jump', () => {
    const d = createOffRouteDetector(cfg.deviation);
    d.observe({ fix: fix(T0), filtered: filtered(T0), match: matched(1, T0) });
    assert.equal(d.observe({ fix: fix(T0 + 1000), filtered: filtered(T0 + 1000), match: unmatched(45, T0 + 1000) }).kind, 'suspected');
    assert.equal(d.observe({ fix: fix(T0 + 2000), filtered: filtered(T0 + 2000), match: matched(2, T0 + 2000) }).kind, 'on-route');
  });

  it('declares off-route after three reliable fixes spanning three seconds', () => {
    const d = createOffRouteDetector(cfg.deviation);
    const kinds = [0, 1000, 2000, 3000].map((dt) =>
      d.observe({ fix: fix(T0 + dt), filtered: filtered(T0 + dt), match: unmatched(40, T0 + dt) }).kind,
    );
    // Three fixes arrive within 2 s, so the duration rule holds the fourth.
    assert.deepEqual(kinds, ['suspected', 'suspected', 'suspected', 'off-route']);
  });

  it('needs three fixes even when they are far apart in time', () => {
    const d = createOffRouteDetector(cfg.deviation);
    const kinds = [0, 5000, 10_000].map((dt) =>
      d.observe({ fix: fix(T0 + dt), filtered: filtered(T0 + dt), match: unmatched(40, T0 + dt) }).kind,
    );
    assert.deepEqual(kinds, ['suspected', 'suspected', 'off-route']);
  });

  it('scales the threshold with fix accuracy', () => {
    const d = createOffRouteDetector(cfg.deviation);
    // 25 m away with a 28 m accuracy radius is within max(20, 28).
    for (let i = 0; i < 6; i += 1) {
      assert.equal(d.observe({ fix: fix(T0 + i * 1000, 28), filtered: filtered(T0 + i * 1000), match: matched(25, T0) }).kind, 'on-route');
    }
  });

  it('holds its state through unreliable fixes', () => {
    const d = createOffRouteDetector(cfg.deviation);
    d.observe({ fix: fix(T0), filtered: filtered(T0), match: unmatched(40, T0) });
    d.observe({ fix: fix(T0 + 1000), filtered: filtered(T0 + 1000), match: unmatched(40, T0 + 1000) });
    const held = d.observe({ fix: fix(T0 + 2000, 45), filtered: filtered(T0 + 2000), match: matched(0, T0 + 2000) });
    assert.ok(held.kind === 'suspected' && held.consecutiveFixes === 2);
    assert.equal(d.observe({ fix: fix(T0 + 4000), filtered: filtered(T0 + 4000), match: unmatched(40, T0 + 4000) }).kind, 'off-route');
  });

  it('flags walking the wrong way after four backward fixes, only when moving', () => {
    const d = createOffRouteDetector(cfg.deviation);
    const kinds = [0, 1, 2, 3].map((i) =>
      d.observe({ fix: fix(T0 + i * 1000), filtered: filtered(T0 + i * 1000), match: matched(1, T0, 'backward') }).kind,
    );
    assert.deepEqual(kinds, ['on-route', 'on-route', 'on-route', 'wrong-direction']);
    const still = createOffRouteDetector(cfg.deviation);
    for (let i = 0; i < 6; i += 1) {
      assert.equal(
        still.observe({ fix: fix(T0 + i * 1000), filtered: filtered(T0 + i * 1000, 0.3), match: matched(1, T0, 'backward') }).kind,
        'on-route',
      );
    }
  });

  it('resets to on-route', () => {
    const d = createOffRouteDetector(cfg.deviation);
    for (let i = 0; i < 4; i += 1) d.observe({ fix: fix(T0 + i * 2000), filtered: filtered(T0), match: unmatched(40, T0) });
    assert.equal(d.state.kind, 'off-route');
    d.reset();
    assert.equal(d.state.kind, 'on-route');
  });
});

describe('createArrivalDetector', () => {
  // Sylvia's: the CMS point is the building, the provider's routable point
  // (the arrive maneuver on Malcolm X Boulevard) is the door side.
  const NAME = 'apollo-theater--sylvias-restaurant';
  const destination = fixtureDestination(NAME);
  const entrance = destination.entrance!.coordinate;
  const centroid = lngLatToCoordinate(loadFixture(NAME).destination.lngLat);
  const frame = createLocalFrame(entrance);

  const at = (eastM: number, northM: number) => frame.toGeographic({ eastM, northM });
  const observe = (d: ReturnType<typeof createArrivalDetector>, c: { latitude: number; longitude: number }, t: number, acc = 5) =>
    d.observe(fix(t, acc, c), filtered(t, 1, c));

  it('uses a real Harlem case where the door is not the centroid', () => {
    const gap = distanceM(entrance, centroid);
    assert.ok(gap > 5, `entrance is ${gap} m from the CMS point`);
  });

  it('needs two fixes inside the radius', () => {
    const d = createArrivalDetector(destination, cfg.arrival);
    assert.equal(observe(d, at(0, 30), T0).kind, 'approaching');
    assert.equal(observe(d, at(0, 5), T0 + 1000).kind, 'approaching');
    const a = observe(d, at(0, 4), T0 + 2000);
    assert.ok(a.kind === 'arrived' && a.confidence === 'confirmed' && a.arrivedAtMs === T0 + 2000);
  });

  it('reports en-route far away', () => {
    const d = createArrivalDetector(destination, cfg.arrival);
    assert.equal(observe(d, at(300, 0), T0).kind, 'en-route');
  });

  it('marks a coarse arrival as estimated and upgrades it on a precise fix', () => {
    const d = createArrivalDetector(destination, cfg.arrival);
    observe(d, at(0, 10), T0, 18);
    const estimated = observe(d, at(0, 10), T0 + 1000, 18);
    assert.ok(estimated.kind === 'arrived' && estimated.confidence === 'estimated');
    const confirmed = observe(d, at(0, 3), T0 + 2000, 4);
    assert.ok(confirmed.kind === 'arrived' && confirmed.confidence === 'confirmed');
  });

  it('holds arrival between the radii and leaves only after three fixes beyond 35 m', () => {
    const d = createArrivalDetector(destination, cfg.arrival);
    observe(d, at(0, 2), T0);
    observe(d, at(0, 2), T0 + 1000);
    assert.equal(observe(d, at(0, 25), T0 + 2000).kind, 'arrived'); // inside the hysteresis band
    assert.equal(observe(d, at(0, 40), T0 + 3000).kind, 'arrived');
    assert.equal(observe(d, at(0, 40), T0 + 4000).kind, 'arrived');
    assert.equal(observe(d, at(0, 40), T0 + 5000).kind, 'approaching');
  });

  it('does not arrive from the wrong side of the building', () => {
    // Stand behind Sylvia's: the CMS point mirrored away from the door. A
    // detector aimed at the building point would call this arrived.
    const c = createLocalFrame(centroid);
    const door = c.toLocal(entrance);
    const behind = c.toGeographic({ eastM: -door.eastM * 1.6, northM: -door.northM * 1.6 });
    const naive: RouteDestination = { name: 'sylvias', coordinate: centroid };
    const toDoor = createArrivalDetector(destination, cfg.arrival);
    const toCentroid = createArrivalDetector(naive, cfg.arrival);
    for (let i = 0; i < 4; i += 1) {
      observe(toDoor, behind, T0 + i * 1000);
      observe(toCentroid, behind, T0 + i * 1000);
    }
    assert.equal(toCentroid.state.kind, 'arrived', 'the centroid detector is fooled');
    assert.notEqual(toDoor.state.kind, 'arrived', `door detector at ${distanceM(behind, entrance)} m`);
  });
});
