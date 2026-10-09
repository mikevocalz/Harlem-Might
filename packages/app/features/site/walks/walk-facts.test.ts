import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatDistance,
  formatDuration,
  formatStopCount,
  stopAnchor,
  walkFactModules,
  walkMapView,
  walkSummaryLine,
} from './walk-facts.ts';

const stop = (position: number, slug?: string) => ({
  position,
  place: slug ? { id: position, slug, name: slug } : undefined,
});

describe('formatDistance', () => {
  it('converts meters to miles with one decimal', () => {
    assert.equal(formatDistance(1931), '1.2 miles');
    assert.equal(formatDistance(1609.344), '1 mile');
  });
  it('floors tiny walks at 0.1 miles', () => assert.equal(formatDistance(50), '0.1 miles'));
  it('drops zero, negative and non-finite values', () => {
    assert.equal(formatDistance(0), null);
    assert.equal(formatDistance(-3), null);
    assert.equal(formatDistance(Number.NaN), null);
  });
});

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    assert.equal(formatDuration(45), '45 min');
    assert.equal(formatDuration(60), '1 hr');
    assert.equal(formatDuration(80), '1 hr 20 min');
  });
  it('drops zero', () => assert.equal(formatDuration(0), null));
});

describe('formatStopCount', () => {
  it('pluralises', () => {
    assert.equal(formatStopCount(1), '1 stop');
    assert.equal(formatStopCount(6), '6 stops');
    assert.equal(formatStopCount(0), null);
  });
});

describe('walkFactModules', () => {
  const walk = {
    distanceMeters: 1931,
    durationMinutes: 45,
    stops: [stop(1, 'apollo-theater'), stop(2, 'schomburg-center')],
    startDescription: 'Apollo Theater, 253 W 125th St',
    endDescription: 'Schomburg Center',
  };
  it('emits the four facts in reading order', () => {
    const modules = walkFactModules(walk);
    assert.deepEqual(
      modules.map((m) => [m.id, m.value]),
      [
        ['distance', '1.2 miles'],
        ['time', '45 min'],
        ['stops', '2 stops'],
        ['start', 'Apollo Theater, 253 W 125th St'],
      ],
    );
    assert.equal(modules[3]?.note, 'Ends at Schomburg Center');
  });
  it('leaves out facts the record does not carry', () => {
    const modules = walkFactModules({ ...walk, distanceMeters: 0, startDescription: '  ', endDescription: 'Schomburg Center' });
    assert.deepEqual(
      modules.map((m) => m.id),
      ['time', 'stops', 'end'],
    );
  });
  it('never exceeds the compact variant maximum of four', () => {
    assert.ok(walkFactModules(walk).length <= 4);
  });
});

describe('walkSummaryLine', () => {
  it('joins the known facts', () => {
    assert.equal(walkSummaryLine({ distanceMeters: 1931, durationMinutes: 45, stops: [stop(1)] }), '1.2 miles, 45 min, 1 stop');
  });
  it('is empty when nothing is known', () => {
    assert.equal(walkSummaryLine({ distanceMeters: 0, durationMinutes: 0, stops: [] }), '');
  });
});

describe('stopAnchor', () => {
  it('is a stable in-page id', () => assert.equal(stopAnchor(3), 'stop-3'));
});

describe('walkMapView', () => {
  const points: Record<string, readonly [number, number]> = {
    a: [-73.95, 40.81],
    b: [-73.944, 40.812],
  };
  const locate = (slug: string) => points[slug];

  it('returns null when no stop has a point', () => {
    assert.equal(walkMapView([stop(1, 'zzz'), stop(2)], locate), null);
  });
  it('centres on the stops and marks the first one', () => {
    const view = walkMapView([stop(1, 'a'), stop(2, 'b'), stop(3)], locate);
    assert.ok(view);
    assert.equal(view.located, 2);
    assert.deepEqual(view.center, [-73.947, 40.811]);
    assert.equal(view.zoom, 15);
    assert.equal(view.pins[0]?.tone, 'live');
    assert.equal(view.pins[1]?.tone, 'cobalt');
  });
  it('zooms in for a single stop', () => {
    assert.equal(walkMapView([stop(1, 'a')], locate)?.zoom, 16);
  });
});
