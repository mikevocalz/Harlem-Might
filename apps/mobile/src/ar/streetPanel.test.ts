import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { manualOriginLabel, mapLine, panelLines } from './streetPanel.ts';
import type { StreetNavigationView } from './streetNavigationPort.ts';

const base = {
  view: { status: 'idle' } as StreetNavigationView,
  step: { title: '', detail: '' },
  routeSummary: '',
  placeName: 'Apollo Theater',
  placeDetail: 'Music · 125th Street',
  hasOrigin: true,
  mapStatus: 'ready' as const,
  estimatedHeights: 0,
};

const origin = {
  kind: 'manual' as const,
  coordinate: { latitude: 40.81, longitude: -73.95 },
  label: 'Apollo Theater, chosen by hand',
};

describe('panelLines', () => {
  it('shows the place when not navigating', () => {
    const lines = panelLines(base);
    assert.equal(lines.title, 'Apollo Theater');
    assert.equal(lines.detail, 'Music · 125th Street');
    assert.match(lines.attribution, /© Mapbox © OpenStreetMap/);
  });

  it('shows the current instruction and the labelled manual origin while navigating', () => {
    const lines = panelLines({
      ...base,
      view: { status: 'navigating', destinationId: 'sylvias-restaurant', origin, legs: [], geometry: [], stepIndex: 0 },
      step: { title: 'Head east on West 125th Street', detail: 'Step 1 of 4 · Next turn in 180 m' },
    });
    assert.equal(lines.title, 'Head east on West 125th Street');
    assert.equal(lines.detail, 'Step 1 of 4 · Next turn in 180 m');
    assert.match(lines.status, /^From Apollo Theater, chosen by hand/);
  });

  it('summarises a ready route and names its manual origin', () => {
    const lines = panelLines({
      ...base,
      placeName: 'Sylvia’s',
      routeSummary: '6 steps · 640 m',
      view: { status: 'routeReady', destinationId: 'sylvias-restaurant', origin, legs: [], geometry: [], stepIndex: 0 },
    });
    assert.equal(lines.title, 'Walking route to Sylvia’s');
    assert.match(lines.detail, /^6 steps · 640 m/);
    assert.equal(lines.status, 'From Apollo Theater, chosen by hand');
  });

  it('says why guidance is not available or failed', () => {
    assert.match(
      panelLines({ ...base, view: { status: 'unavailable', reason: 'Not wired' } }).status,
      /^Not wired · /,
    );
    assert.equal(panelLines({ ...base, view: { status: 'error', message: 'No walking route found' } }).detail, 'No walking route found');
  });

  it('drops the building and imagery credit when they are off', () => {
    assert.equal(panelLines({ ...base, mapStatus: 'no-token' }).attribution, 'Route © Mapbox © OpenStreetMap');
  });
});

describe('manualOriginLabel', () => {
  const places = [
    { name: 'Apollo Theater', eastM: 0, northM: 0 },
    { name: 'Red Rooster', eastM: 429, northM: -236 },
  ];

  it('names a place the wearer stands at', () => {
    assert.equal(manualOriginLabel({ eastM: 0, northM: -4 }, places), 'Apollo Theater, chosen by hand');
  });

  it('falls back to the chosen spot elsewhere', () => {
    assert.equal(manualOriginLabel({ eastM: 200, northM: 0 }, places), 'The spot you chose by hand');
  });
});

describe('mapLine', () => {
  it('labels the no-token fallback plainly', () => {
    assert.match(mapLine('no-token', 0), /No Mapbox token .* real buildings and satellite ground are off/);
    assert.match(mapLine('not-public', 0), /not a public pk\. token/);
  });

  it('counts estimated heights only when there are some', () => {
    assert.equal(mapLine('ready', 0), 'Click the ground to move');
    assert.match(mapLine('ready', 3), /^3 building heights estimated/);
  });
});
