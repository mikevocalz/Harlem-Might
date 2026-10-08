import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_NAVIGATION_CONFIG } from '../config.ts';
import { angleBetweenDegrees } from '../geo/angles.ts';
import { createLocalFrame, distanceM } from '../geo/localFrame.ts';
import type { HeadingSample, LocationFix } from '../model/location.ts';
import { gaussian, seededRandom } from '../testing/traces.ts';
import { HeadingSmoother } from './heading.ts';
import { ConstantVelocityKalman } from './kalman.ts';
import { createLocationPipeline } from './locationPipeline.ts';

const APOLLO = { latitude: 40.8100895, longitude: -73.9499948 };
const frame = createLocalFrame(APOLLO);
const T0 = 1_760_000_000_000;

const fixAt = (eastM: number, northM: number, t: number, accuracyM = 5, extra: Partial<LocationFix> = {}): LocationFix => ({
  coordinate: frame.toGeographic({ eastM, northM }),
  accuracy: { horizontalM: accuracyM },
  timestampMs: t,
  source: 'device-gps',
  ...extra,
});

describe('ConstantVelocityKalman', () => {
  const make = () => new ConstantVelocityKalman({ accelerationDensity: 1, initialSpeedSigmaMps: 2 });

  it('averages noise down when standing still', () => {
    const k = make();
    const random = seededRandom(7);
    k.initialize({ eastM: gaussian(random) * 4, northM: gaussian(random) * 4 }, 4, T0);
    for (let i = 1; i <= 60; i += 1) {
      k.update({ eastM: gaussian(random) * 4, northM: gaussian(random) * 4 }, 4, T0 + i * 1000);
    }
    assert.ok(Math.hypot(k.position.eastM, k.position.northM) < 2.5, `error ${Math.hypot(k.position.eastM, k.position.northM)}`);
    assert.ok(k.positionSigmaM < 4, `sigma ${k.positionSigmaM}`);
  });

  it('learns a constant walking velocity', () => {
    const k = make();
    const random = seededRandom(11);
    k.initialize({ eastM: 0, northM: 0 }, 3, T0);
    let sumE = 0;
    let sumN = 0;
    for (let i = 1; i <= 60; i += 1) {
      k.update({ eastM: 1.4 * i + gaussian(random) * 3, northM: gaussian(random) * 3 }, 3, T0 + i * 1000);
      if (i > 20) {
        sumE += k.velocity.eastMps;
        sumN += k.velocity.northMps;
      }
    }
    // One velocity sample wanders by about ±1 m/s at q = 1, σ = 3 m; the mean must not.
    assert.ok(Math.abs(sumE / 40 - 1.4) < 0.3, `mean vE ${sumE / 40}`);
    assert.ok(Math.abs(sumN / 40) < 0.3, `mean vN ${sumN / 40}`);
    assert.ok(Math.abs(k.position.eastM - 1.4 * 60) < 9, `position ${k.position.eastM}`);
  });

  it('scores a 100 m jump far beyond the chi-square gate', () => {
    const k = make();
    k.initialize({ eastM: 0, northM: 0 }, 3, T0);
    for (let i = 1; i <= 10; i += 1) k.update({ eastM: 0, northM: 0 }, 3, T0 + i * 1000);
    assert.ok(k.innovationDistanceSq({ eastM: 100, northM: 0 }, 3, T0 + 11_000) > 13.82);
    assert.ok(k.innovationDistanceSq({ eastM: 2, northM: 0 }, 3, T0 + 11_000) < 13.82);
  });

  it('refuses to predict before initialisation and rejects bad tuning', () => {
    assert.throws(() => make().predicted(T0));
    assert.throws(() => new ConstantVelocityKalman({ accelerationDensity: 0, initialSpeedSigmaMps: 1 }), RangeError);
  });
});

describe('HeadingSmoother', () => {
  const sample = (headingDeg: number, i: number, extra: Partial<HeadingSample> = {}): HeadingSample => ({
    headingDeg,
    timestampMs: T0 + i * 100,
    source: 'compass',
    ...extra,
  });

  it('averages across north to 0°, never 180°', () => {
    const h = new HeadingSmoother(DEFAULT_NAVIGATION_CONFIG.heading);
    let last;
    for (let i = 0; i < 20; i += 1) last = h.add(sample(i % 2 === 0 ? 359 : 1, i));
    assert.ok(last);
    assert.ok(angleBetweenDegrees(last.headingDeg, 0) < 1, `got ${last.headingDeg}`);
    assert.equal(last.confidence, 'high');
  });

  it('follows a slow drift through the wraparound without a jump', () => {
    const h = new HeadingSmoother(DEFAULT_NAVIGATION_CONFIG.heading);
    let previous: number | undefined;
    for (let i = 0; i < 100; i += 1) {
      const truth = (340 + i * 0.4) % 360; // 340° → 20°, crossing north
      const e = h.add(sample(truth, i))!;
      if (previous !== undefined) assert.ok(angleBetweenDegrees(previous, e.headingDeg) < 1, `jump at ${i}`);
      previous = e.headingDeg;
      if (i > 20) assert.ok(angleBetweenDegrees(e.headingDeg, truth) < 3, `lag ${angleBetweenDegrees(e.headingDeg, truth)} at ${i}`);
    }
  });

  it('reports low confidence when samples scatter', () => {
    const h = new HeadingSmoother(DEFAULT_NAVIGATION_CONFIG.heading);
    const random = seededRandom(3);
    let last;
    for (let i = 0; i < 20; i += 1) last = h.add(sample(random() * 360, i));
    assert.equal(last!.confidence, 'low');
  });

  it('ignores out-of-order, non-finite and very inaccurate samples', () => {
    const h = new HeadingSmoother(DEFAULT_NAVIGATION_CONFIG.heading);
    assert.ok(h.add(sample(90, 5)));
    assert.equal(h.add(sample(180, 4)), undefined);
    assert.equal(h.add(sample(Number.NaN, 6)), undefined);
    assert.equal(h.add(sample(180, 7, { accuracyDeg: 90 })), undefined);
    assert.ok(angleBetweenDegrees(h.current()!.headingDeg, 90) < 1e-9);
  });

  it('caps confidence at medium when the platform accuracy is poor', () => {
    const h = new HeadingSmoother(DEFAULT_NAVIGATION_CONFIG.heading);
    let last;
    for (let i = 0; i < 10; i += 1) last = h.add(sample(45, i, { accuracyDeg: 40 }));
    assert.equal(last!.confidence, 'medium');
  });

  it('restarts when the source changes so compass bias never blends into AR heading', () => {
    const h = new HeadingSmoother(DEFAULT_NAVIGATION_CONFIG.heading);
    for (let i = 0; i < 10; i += 1) h.add(sample(10, i));
    const ar = h.add(sample(100, 10, { source: 'ar-session' }))!;
    assert.equal(ar.source, 'ar-session');
    assert.ok(angleBetweenDegrees(ar.headingDeg, 100) < 1e-9);
  });
});

describe('createLocationPipeline', () => {
  const make = () => createLocationPipeline(DEFAULT_NAVIGATION_CONFIG.location, 'walking');

  it('accepts the first good fix and keeps the raw fix untouched', () => {
    const p = make();
    const fix = fixAt(0, 0, T0);
    const result = p.ingest(fix, T0);
    assert.equal(result.kind, 'accepted');
    assert.equal(result.fix, fix);
    assert.ok(result.kind === 'accepted' && result.didReset);
  });

  it('rejects invalid, inaccurate, stale and future fixes', () => {
    const p = make();
    assert.deepEqual(reason(p.ingest(fixAt(0, 0, T0, 0), T0)), 'invalid');
    assert.deepEqual(
      reason(p.ingest({ ...fixAt(0, 0, T0 + 1), coordinate: { latitude: 95, longitude: 0 } }, T0)),
      'invalid',
    );
    assert.equal(reason(p.ingest(fixAt(0, 0, T0 + 2, 80), T0 + 2)), 'inaccurate');
    assert.equal(reason(p.ingest(fixAt(0, 0, T0 + 3), T0 + 60_000)), 'stale');
    assert.equal(reason(p.ingest(fixAt(0, 0, T0 + 60_000), T0 + 4)), 'future');
  });

  it('tells duplicates from out-of-order fixes', () => {
    const p = make();
    const fix = fixAt(0, 0, T0);
    p.ingest(fix, T0);
    assert.equal(reason(p.ingest({ ...fix }, T0)), 'duplicate');
    assert.equal(reason(p.ingest(fixAt(5, 0, T0), T0)), 'out-of-order');
    assert.equal(reason(p.ingest(fixAt(5, 0, T0 - 1000), T0)), 'out-of-order');
  });

  it('rejects a single urban-canyon jump and keeps the filtered position', () => {
    const p = make();
    for (let i = 0; i < 10; i += 1) p.ingest(fixAt(1.4 * i, 0, T0 + i * 1000, 4), T0 + i * 1000);
    const before = p.latest!.coordinate;
    const jump = p.ingest(fixAt(13 + 80, 60, T0 + 10_000, 4), T0 + 10_000);
    assert.equal(jump.kind, 'rejected');
    assert.equal(p.latest!.coordinate, before);
    const next = p.ingest(fixAt(1.4 * 11, 0, T0 + 11_000, 4), T0 + 11_000);
    assert.equal(next.kind, 'accepted');
  });

  it('re-initialises after three consecutive rejections, because the person really moved', () => {
    const p = make();
    for (let i = 0; i < 5; i += 1) p.ingest(fixAt(0, 0, T0 + i * 1000, 4), T0 + i * 1000);
    const results = [5, 6, 7].map((i) => p.ingest(fixAt(300, 0, T0 + i * 1000, 4), T0 + i * 1000));
    assert.deepEqual(results.map((r) => r.kind), ['rejected', 'rejected', 'accepted']);
    assert.ok(results[2]!.kind === 'accepted' && results[2]!.didReset);
    assert.ok(distanceM(p.latest!.coordinate, frame.toGeographic({ eastM: 300, northM: 0 })) < 1);
  });

  it('rejects implausible speed before the filter even scores the fix', () => {
    const p = make();
    p.ingest(fixAt(0, 0, T0, 3), T0);
    p.ingest(fixAt(1, 0, T0 + 1000, 3), T0 + 1000);
    // 40 m in 1 s with 3 m accuracy each side: 34 m/s unexplained.
    assert.equal(reason(p.ingest(fixAt(41, 0, T0 + 2000, 3), T0 + 2000)), 'implausible-speed');
  });

  it('treats a manual origin as a fresh start', () => {
    const p = make();
    p.ingest(fixAt(0, 0, T0), T0);
    const manual = p.ingest(fixAt(500, 500, T0 + 1000, 5, { source: 'manual' }), T0 + 1000);
    assert.ok(manual.kind === 'accepted' && manual.didReset);
  });

  it('flags sustained driving speed', () => {
    // 10 m/s exceeds the walking speed gate, so use cycling to exercise the guard.
    const c = createLocationPipeline(DEFAULT_NAVIGATION_CONFIG.location, 'cycling');
    for (let i = 0; i < 20; i += 1) c.ingest(fixAt(10 * i, 0, T0 + i * 1000, 3), T0 + i * 1000);
    assert.ok(c.latest!.speedMps > 8);
    assert.ok(c.tooFastSinceMs !== undefined && T0 + 19_000 - c.tooFastSinceMs >= 5000);
  });

  it('reports high confidence for tight fixes and low for coarse ones', () => {
    const tight = make();
    for (let i = 0; i < 5; i += 1) tight.ingest(fixAt(0, 0, T0 + i * 1000, 4), T0 + i * 1000);
    assert.equal(tight.latest!.confidence, 'high');
    const coarse = make();
    coarse.ingest(fixAt(0, 0, T0, 45), T0);
    assert.equal(coarse.latest!.confidence, 'low');
  });
});

function reason(result: ReturnType<ReturnType<typeof createLocationPipeline>['ingest']>) {
  return result.kind === 'rejected' ? result.reason : 'accepted';
}
