import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { filterPlaces, formatDistance, haversine, placeStreetLine, type ExplorePlace } from './place-model.ts';

const places: ExplorePlace[] = [
  {
    id: 'first', name: 'First Cafe', category: 'Food', area: 'Central Harlem',
    street: 'West 125th Street', shortDescription: 'Breakfast and lunch', tags: ['coffee'],
  },
  { id: 'second', name: 'Second', category: 'Imported category', area: 'Uptown', tags: ['art'] },
];

describe('filterPlaces', () => {
  it('searches every display field, ignoring case and surrounding whitespace', () => {
    for (const query of [' FIRST ', 'food', 'central', '125th', 'breakfast', 'coffee']) {
      assert.deepEqual(filterPlaces(places, query, 'All'), [places[0]]);
    }
  });

  it('supports imported categories, missing optional fields and a custom all label', () => {
    assert.deepEqual(filterPlaces(places, 'art', 'Imported category'), [places[1]]);
    assert.deepEqual(filterPlaces(places, 'first', 'Imported category'), []);
    assert.deepEqual(filterPlaces(places, ' ', 'Everything', 'Everything'), places);
    assert.deepEqual(filterPlaces(places, 'missing', 'All'), []);
  });

  it('returns a new array without copying or changing catalogue records', () => {
    const before = structuredClone(places);
    const result = filterPlaces(places, '', 'All');
    assert.notEqual(result, places);
    assert.equal(result[0], places[0]);
    assert.deepEqual(places, before);
  });
});

describe('place display and distance helpers', () => {
  it('uses the street when supplied and otherwise the area', () => {
    assert.equal(placeStreetLine(places[0]!), 'West 125th Street');
    assert.equal(placeStreetLine(places[1]!), 'Uptown');
  });

  it('measures great-circle metres using longitude/latitude order', () => {
    const origin = [-73.95, 40.81] as const;
    assert.equal(haversine(origin, origin), 0);
    const north = haversine(origin, [-73.95, 41.81]);
    const east = haversine(origin, [-72.95, 40.81]);
    assert.ok(Math.abs(north - 111_194.9266) < 0.001);
    assert.ok(east < north);
    assert.equal(east, haversine([-72.95, 40.81], origin));
  });

  it('formats metres under 1 km and kilometres above', () => {
    assert.equal(formatDistance(83, 'en-GB'), '80 m');
    assert.equal(formatDistance(1234, 'en-GB'), '1.2 km');
    assert.equal(formatDistance(1000, 'en-GB'), '1 km');
  });

  it('retains a plain-unit fallback when Intl cannot format the locale', () => {
    assert.equal(formatDistance(83, 'invalid_locale'), '80 m');
    assert.equal(formatDistance(1234, 'invalid_locale'), '1.2 km');
  });
});

it('loads pure place consumers without React, Zustand or UI stores', () => {
  const modules = [
    './place-model.ts',
    './place-previews.ts',
    './catalogue.ts',
    '../site/place/nearby.ts',
  ].map((path) => new URL(path, import.meta.url).href);
  // A fresh process prevents an already-cached UI store from hiding a leak.
  const script = `
    import { registerHooks } from 'node:module';
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (/\\.store(?:\\.[cm]?[jt]sx?)?$/.test(specifier)) {
          throw new Error('Pure places must not import UI stores: ' + specifier);
        }
        if (!/^(?:\\.\\.?\\/|file:|node:)/.test(specifier) &&
            specifier !== '@acme/app/features/explore/place-model.ts') {
          throw new Error('Pure places must not import packages: ' + specifier);
        }
        return nextResolve(specifier, context);
      },
    });
    for (const url of process.argv.slice(1)) await import(url);
  `;
  execFileSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '--eval', script, ...modules]);
});
