import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RouteLeg, RouteStep } from '@mikevocalz/nitro-mapbox-ar/navigation';
import { MAPPED_PLACES } from '@acme/app/features/explore/explore.store.ts';
import { tabletopOrigin } from './arTabletop.ts';
import {
  CHEVRON_SPACING_M,
  STANCE_BEFORE_TURN_M,
  chevronMesh,
  formatDistance,
  headingForBearing,
  navSteps,
  stanceForStep,
  stepLines,
  turnIndicator,
  type NavStep,
} from './streetNavigation.ts';
import { worldRootTransform } from './streetScene.ts';

const apollo = MAPPED_PLACES.find((place) => place.id === 'apollo-theater')!;
const origin = tabletopOrigin(apollo);

const step = (over: Partial<RouteStep['maneuver']>, distanceM = 120, geometry?: RouteStep['geometry']): RouteStep => ({
  distanceM,
  durationS: 90,
  streetName: 'West 125th Street',
  maneuver: {
    location: { latitude: apollo.lngLat![1], longitude: apollo.lngLat![0] },
    bearingBeforeDeg: 0,
    bearingAfterDeg: 90,
    instruction: 'Turn right onto West 125th Street',
    kind: 'turn',
    modifier: 'right',
    ...over,
  },
  ...(geometry ? { geometry } : {}),
});
const legs = (...steps: RouteStep[]): RouteLeg[] => [{ distanceM: 0, durationS: 0, steps }];

/** Where an ENU ground point lands in the scene for a stance. */
function inScene(stance: { user: { eastM: number; northM: number }; headingDeg: number }, p: { eastM: number; northM: number }) {
  const { position, rotation } = worldRootTransform(stance.user, stance.headingDeg);
  const r = (rotation[1] * Math.PI) / 180;
  const x = p.eastM;
  const z = -p.northM;
  return { x: Math.cos(r) * x + Math.sin(r) * z + position[0], z: -Math.sin(r) * x + Math.cos(r) * z + position[2] };
}

describe('navSteps', () => {
  it('projects manoeuvres to ENU and keeps instruction, bearings and distance', () => {
    const [nav] = navSteps(origin, legs(step({ bearingBeforeDeg: 10, bearingAfterDeg: 270 })));
    assert.ok(Math.abs(nav!.at.eastM) < 1e-6 && Math.abs(nav!.at.northM) < 1e-6);
    assert.equal(nav!.bearingBeforeDeg, 10);
    assert.equal(nav!.bearingAfterDeg, 270);
    assert.equal(nav!.distanceToNextM, 120);
    assert.equal(nav!.modifier, 'right');
    assert.equal(nav!.instruction, 'Turn right onto West 125th Street');
  });
});

describe('stanceForStep', () => {
  const turn: NavStep = navSteps(origin, legs(step({ bearingBeforeDeg: 90 })))[0]!;

  it('stands short of a turn, facing the way the wearer arrives', () => {
    const stance = stanceForStep(turn);
    assert.equal(stance.headingDeg, 90);
    assert.ok(Math.abs(stance.user.eastM - -STANCE_BEFORE_TURN_M) < 1e-9);
    assert.ok(Math.abs(stance.user.northM) < 1e-9);
    // The turn is straight ahead in the scene: x = 0, z = -6.
    const ahead = inScene(stance, turn.at);
    assert.ok(Math.abs(ahead.x) < 1e-9, `x ${ahead.x}`);
    assert.ok(Math.abs(ahead.z - -STANCE_BEFORE_TURN_M) < 1e-9, `z ${ahead.z}`);
  });

  it('stands on the start of the route at the departure, facing the first street', () => {
    const depart = navSteps(origin, legs(step({ kind: 'depart', bearingBeforeDeg: 0, bearingAfterDeg: 225 })))[0]!;
    const stance = stanceForStep(depart);
    assert.deepEqual(stance.user, depart.at);
    assert.equal(stance.headingDeg, 225);
    // A point 10 m along bearing 225 is straight ahead.
    const along = { eastM: depart.at.eastM + 10 * Math.sin((225 * Math.PI) / 180), northM: depart.at.northM + 10 * Math.cos((225 * Math.PI) / 180) };
    const ahead = inScene(stance, along);
    assert.ok(Math.abs(ahead.x) < 1e-9 && Math.abs(ahead.z + 10) < 1e-9);
  });

  it('rejects a non-finite bearing', () => {
    assert.throws(() => headingForBearing(Number.NaN), RangeError);
  });
});

describe('turnIndicator', () => {
  it('runs in along the arrival bearing, through the turn, out along the departure bearing', () => {
    const nav = navSteps(origin, legs(step({ bearingBeforeDeg: 0, bearingAfterDeg: 90 })))[0]!;
    const points = turnIndicator(nav, 0.05);
    assert.equal(points.length, 6);
    const [tail, corner, tip] = points;
    // Arrives heading north: the tail is south of the corner (z greater).
    assert.ok(tail![2] > corner![2]);
    // Leaves heading east: the tip is east of the corner.
    assert.ok(tip![0] > corner![0] + 5);
    assert.ok(points.every((p) => p[1] === 0.05));
  });
});

describe('panel copy', () => {
  it('formats distances in 5 m steps and kilometres', () => {
    assert.equal(formatDistance(183), '185 m');
    assert.equal(formatDistance(2), '5 m');
    assert.equal(formatDistance(1240), '1.2 km');
  });

  it('names the step, the count and the distance to the next turn', () => {
    const steps = navSteps(origin, legs(step({ kind: 'depart', instruction: 'Head east' }, 180), step({ kind: 'arrive', instruction: 'You have arrived at Sylvia’s' }, 0)));
    assert.deepEqual(stepLines(steps, 0), { title: 'Head east', detail: 'Step 1 of 2 · Next turn in 180 m' });
    assert.deepEqual(stepLines(steps, 1), { title: 'You have arrived at Sylvia’s', detail: 'Step 2 of 2 · You have arrived' });
    assert.deepEqual(stepLines(steps, 5), { title: '', detail: '' });
  });
});

describe('navSteps paths', () => {
  it('uses step geometry when present and a straight line to the next manoeuvre otherwise', () => {
    const east = { latitude: apollo.lngLat![1], longitude: apollo.lngLat![0] + 0.001 };
    const north = { latitude: apollo.lngLat![1] + 0.001, longitude: apollo.lngLat![0] + 0.001 };
    const steps = navSteps(
      origin,
      legs(
        step({ kind: 'depart' }, 84, [{ latitude: apollo.lngLat![1], longitude: apollo.lngLat![0] }, east]),
        step({ location: east }),
        step({ kind: 'arrive', location: north }),
      ),
    );
    assert.equal(steps[0]!.path.length, 2);
    assert.ok(steps[0]!.path[1]!.eastM > 80);
    assert.equal(steps[1]!.path.length, 2);
    assert.ok(steps[1]!.path[1]!.northM > 100);
    assert.equal(steps[2]!.path.length, 1);
  });
});

describe('chevronMesh', () => {
  const path = [
    { eastM: 0, northM: 0 },
    { eastM: 0, northM: 20 },
    { eastM: 20, northM: 20 },
  ];
  const mesh = chevronMesh(path, 0.05);

  it('places a chevron every few metres, clear of both ends', () => {
    const chevrons = mesh.indices.length / 12;
    assert.equal(chevrons, Math.floor((40 - 4) / CHEVRON_SPACING_M) + 1);
    assert.equal(mesh.vertices.length, mesh.normals.length);
    assert.equal(mesh.vertices.length, mesh.texcoords.length);
    assert.ok(mesh.vertices.every((v) => v[1] === 0.05));
  });

  it('winds every triangle counter-clockwise seen from above', () => {
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = [mesh.vertices[mesh.indices[i]!]!, mesh.vertices[mesh.indices[i + 1]!]!, mesh.vertices[mesh.indices[i + 2]!]!];
      const ux = b[0] - a[0];
      const uz = b[2] - a[2];
      const vx = c[0] - a[0];
      const vz = c[2] - a[2];
      // y of (b - a) x (c - a)
      assert.ok(uz * vx - ux * vz > 0, `triangle ${i / 3} faces down`);
    }
  });

  it('points each chevron the way the path runs', () => {
    // First chevron, on the northbound leg: its tip is the most northern vertex (lowest z).
    const first = mesh.vertices.slice(0, 8);
    const tipZ = Math.min(...first.map((v) => v[2]));
    const tailZ = Math.max(...first.map((v) => v[2]));
    assert.ok(tailZ - tipZ > 0.5);
    // Last chevron, on the eastbound leg: its tip is the most eastern vertex.
    const last = mesh.vertices.slice(-8);
    const tipX = Math.max(...last.map((v) => v[0]));
    const tailX = Math.min(...last.map((v) => v[0]));
    assert.ok(tipX - tailX > 0.5);
    assert.ok(Math.min(...last.map((v) => -v[2])) > 19);
  });

  it('is empty for a path too short to hold one', () => {
    assert.equal(chevronMesh([{ eastM: 0, northM: 0 }, { eastM: 0, northM: 3 }], 0).indices.length, 0);
    assert.equal(chevronMesh([{ eastM: 0, northM: 0 }], 0).indices.length, 0);
  });
});
