import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { radius68From95 } from '../model/geo.ts';
import { angleBetweenDegrees, bearingOfVector, normalizeDegrees, signedDeltaDegrees } from './angles.ts';
import { createLocalFrame, distanceM } from './localFrame.ts';
import {
  createProjectedPolyline,
  pointAtDistance,
  projectOntoPolyline,
  projectOntoSegment,
  segmentBearingDeg,
} from './polyline.ts';

const APOLLO = { latitude: 40.8100895, longitude: -73.9499948 };

describe('angles', () => {
  it('wraps into 0..360', () => {
    assert.equal(normalizeDegrees(360), 0);
    assert.equal(normalizeDegrees(-1), 359);
    assert.equal(normalizeDegrees(725), 5);
    assert.equal(normalizeDegrees(-0), 0);
    assert.ok(Object.is(normalizeDegrees(-0), 0));
  });

  it('takes the short way across north', () => {
    assert.equal(signedDeltaDegrees(350, 10), 20);
    assert.equal(signedDeltaDegrees(10, 350), -20);
    assert.equal(signedDeltaDegrees(0, 180), 180);
    assert.equal(angleBetweenDegrees(359, 1), 2);
  });

  it('reads compass bearings from east/north vectors', () => {
    assert.equal(bearingOfVector(0, 1), 0);
    assert.equal(bearingOfVector(1, 0), 90);
    assert.equal(bearingOfVector(0, -1), 180);
    assert.equal(bearingOfVector(-1, 0), 270);
  });

  it('rejects non-finite angles', () => {
    assert.throws(() => normalizeDegrees(Number.NaN), RangeError);
  });
});

describe('createLocalFrame', () => {
  // Values produced by projectToEnu in @mapbox/react-native-mapbox-ar-reactvision
  // (nitro-mapbox-ar master b29503b) with the same origin and altitude 0.
  const GOLDEN = [
    { latitude: 40.8086285, longitude: -73.9445189, eastM: 462.0458351973791, northM: -162.22994823523845 },
    { latitude: 40.8146476, longitude: -73.9409874, eastM: 759.9582838724806, northM: 506.21733450312377 },
    { latitude: 40.8044856, longitude: -73.943669, eastM: 533.7919452307186, northM: -622.2948710823325 },
    { latitude: 40.82, longitude: -73.96, eastM: -844.075261351514, northM: 1100.6125004155356 },
    { latitude: 40.79, longitude: -73.93, eastM: 1687.5941753965985, northM: -2230.7473829952314 },
  ];

  it('matches nitro-mapbox-ar projectToEnu to a millimetre', () => {
    const frame = createLocalFrame(APOLLO);
    for (const g of GOLDEN) {
      const p = frame.toLocal(g);
      assert.ok(Math.abs(p.eastM - g.eastM) < 1e-3, `east ${p.eastM} vs ${g.eastM}`);
      assert.ok(Math.abs(p.northM - g.northM) < 1e-3, `north ${p.northM} vs ${g.northM}`);
    }
  });

  it('puts the origin at 0,0', () => {
    const p = createLocalFrame(APOLLO).toLocal(APOLLO);
    assert.ok(Math.abs(p.eastM) < 1e-9 && Math.abs(p.northM) < 1e-9);
  });

  it('round-trips local metres back to WGS84 within a millimetre at 3 km', () => {
    const frame = createLocalFrame(APOLLO);
    for (const g of GOLDEN) {
      const back = frame.toGeographic({ eastM: g.eastM, northM: g.northM });
      assert.ok(distanceM(back, g) < 1e-3, `round trip error ${distanceM(back, g)} m`);
    }
  });

  it('is not Web Mercator: a degree of longitude in Harlem is about 84.4 km, not 111 km', () => {
    const east = createLocalFrame(APOLLO).toLocal({ latitude: APOLLO.latitude, longitude: APOLLO.longitude + 0.01 });
    assert.ok(Math.abs(east.eastM - 843.6) < 1, `0.01° east = ${east.eastM} m`);
  });

  it('measures symmetric distances', () => {
    const b = { latitude: 40.8146476, longitude: -73.9409874 };
    assert.ok(Math.abs(distanceM(APOLLO, b) - distanceM(b, APOLLO)) < 1e-3);
  });

  it('rejects invalid origins and points', () => {
    assert.throws(() => createLocalFrame({ latitude: 91, longitude: 0 }), RangeError);
    assert.throws(() => createLocalFrame(APOLLO).toLocal({ latitude: 0, longitude: Number.NaN }), RangeError);
    assert.throws(() => createLocalFrame(APOLLO).toGeographic({ eastM: Infinity, northM: 0 }), RangeError);
  });
});

describe('radius68From95', () => {
  it('converts ARCore 95% radii to 68% radii', () => {
    // 95% radius = 2.448σ, 68% radius = 1.510σ.
    assert.ok(Math.abs(radius68From95(10) - 6.168) < 0.01);
    assert.throws(() => radius68From95(0), RangeError);
  });
});

describe('projected polyline', () => {
  const frame = createLocalFrame(APOLLO);
  const at = (eastM: number, northM: number) => frame.toGeographic({ eastM, northM });

  it('drops repeated vertices so every segment has a direction', () => {
    const line = createProjectedPolyline(frame, [at(0, 0), at(0, 0), at(100, 0), at(100, 0), at(100, 50)]);
    assert.equal(line.segmentCount, 2);
    assert.ok(Math.abs(line.lengthM - 150) < 1e-6);
  });

  it('refuses a line with one distinct position', () => {
    assert.throws(() => createProjectedPolyline(frame, [at(0, 0), at(0, 0)]), RangeError);
  });

  it('signs cross-track distance: positive is left of travel', () => {
    const line = createProjectedPolyline(frame, [at(0, 0), at(100, 0)]); // heading east
    const north = projectOntoSegment(line, 0, { eastM: 50, northM: 5 });
    const south = projectOntoSegment(line, 0, { eastM: 50, northM: -5 });
    assert.ok(Math.abs(north.crossTrackM - 5) < 1e-6);
    assert.ok(Math.abs(south.crossTrackM + 5) < 1e-6);
    assert.ok(Math.abs(north.alongTrackM - 50) < 1e-6);
  });

  it('clamps projections to segment ends', () => {
    const line = createProjectedPolyline(frame, [at(0, 0), at(100, 0)]);
    const before = projectOntoSegment(line, 0, { eastM: -20, northM: 0 });
    assert.equal(before.t, 0);
    assert.ok(Math.abs(before.distanceM - 20) < 1e-6);
  });

  it('projects a diagonal Harlem segment correctly where a degree-space projection would not', () => {
    // A NE-SW avenue-like segment. Projecting in raw degrees treats a degree
    // of longitude as long as a degree of latitude, which at 40.8° N is 32%
    // wrong, so the foot point slides along the segment.
    const a = at(0, 0);
    const b = at(300, 400);
    const line = createProjectedPolyline(frame, [a, b]);
    const query = { eastM: 300, northM: 0 };
    const ours = projectOntoSegment(line, 0, query);
    // Exact answer in metres: t = (300·300) / 500² = 0.36.
    assert.ok(Math.abs(ours.t - 0.36) < 1e-6);
    const q = frame.toGeographic(query);
    const de = b.longitude - a.longitude;
    const dn = b.latitude - a.latitude;
    const degreeT = ((q.longitude - a.longitude) * de + (q.latitude - a.latitude) * dn) / (de * de + dn * dn);
    assert.ok(Math.abs(degreeT - 0.36) > 0.05, `degree-space t ${degreeT} should be visibly biased`);
  });

  it('finds the closest segment and bearings', () => {
    const line = createProjectedPolyline(frame, [at(0, 0), at(100, 0), at(100, 100)]);
    assert.equal(projectOntoPolyline(line, { eastM: 104, northM: 60 }).segmentIndex, 1);
    assert.ok(angleBetweenDegrees(segmentBearingDeg(line, 0), 90) < 1e-6);
    assert.ok(angleBetweenDegrees(segmentBearingDeg(line, 1), 0) < 1e-6);
  });

  it('walks along the line by distance and clamps at both ends', () => {
    const line = createProjectedPolyline(frame, [at(0, 0), at(100, 0), at(100, 100)]);
    const mid = pointAtDistance(line, 150);
    assert.equal(mid.segmentIndex, 1);
    assert.ok(Math.abs(mid.point.eastM - 100) < 1e-6 && Math.abs(mid.point.northM - 50) < 1e-6);
    assert.deepEqual(pointAtDistance(line, -5).point, line.points[0]);
    assert.deepEqual(pointAtDistance(line, 1e6).point, line.points[2]);
    assert.throws(() => pointAtDistance(line, Number.NaN), RangeError);
  });
});
