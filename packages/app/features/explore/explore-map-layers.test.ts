import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAPPED_PLACES } from './explore.store.ts';
import {
  DOTS_LAYER,
  PLACE_LAYERS,
  PLACES_SOURCE,
  ROUTE_LAYERS,
  SELECTED_SOURCE,
  TAPPABLE_LAYERS,
  boundsOf,
  framePadding,
  lineGeoJson,
  linesGeoJson,
  placeIdFromFeature,
  placesGeoJson,
  selectedGeoJson,
  tapBox,
  type MapPlacePoint,
} from './explore-map-layers.ts';

const apollo: MapPlacePoint = { id: 'apollo-theater', name: 'Apollo Theater', lngLat: [-73.9499948, 40.8100895] };

describe('placesGeoJson', () => {
  it('writes one point per place, [lng, lat], with id and name', () => {
    const places = MAPPED_PLACES.map((p) => ({ id: p.id, name: p.name, lngLat: p.lngLat! }));
    const parsed = JSON.parse(placesGeoJson(places));
    assert.equal(parsed.type, 'FeatureCollection');
    assert.equal(parsed.features.length, MAPPED_PLACES.length);
    const first = parsed.features[0];
    assert.deepEqual(first.geometry.coordinates, [places[0]!.lngLat[0], places[0]!.lngLat[1]]);
    assert.equal(first.properties.id, places[0]!.id);
    assert.equal(first.properties.name, places[0]!.name);
  });
});

describe('selectedGeoJson', () => {
  it('is empty with no selection', () => {
    assert.deepEqual(JSON.parse(selectedGeoJson(null)).features, []);
  });
  it('holds the selected place', () => {
    assert.equal(JSON.parse(selectedGeoJson(apollo)).features[0].properties.id, 'apollo-theater');
  });
});

describe('lineGeoJson / linesGeoJson', () => {
  it('draws nothing for fewer than two positions', () => {
    assert.deepEqual(JSON.parse(lineGeoJson([[1, 2]])).features, []);
  });
  it('writes a LineString in input order', () => {
    const parsed = JSON.parse(lineGeoJson([[1, 2], [3, 4]]));
    assert.equal(parsed.geometry.type, 'LineString');
    assert.deepEqual(parsed.geometry.coordinates, [[1, 2], [3, 4]]);
  });
  it('drops degenerate alternatives', () => {
    const parsed = JSON.parse(linesGeoJson([[[1, 2]], [[1, 2], [3, 4]]]));
    assert.equal(parsed.features.length, 1);
  });
});

describe('boundsOf', () => {
  it('is undefined for no points', () => {
    assert.equal(boundsOf([]), undefined);
  });
  it('holds every point, southwest to northeast', () => {
    assert.deepEqual(boundsOf([[-73.95, 40.81], [-73.94, 40.80]]), {
      southwest: { latitude: 40.8, longitude: -73.95 },
      northeast: { latitude: 40.81, longitude: -73.94 },
    });
  });
});

describe('framePadding', () => {
  it('adds the margin to each inset when there is room', () => {
    assert.deepEqual(framePadding({ top: 0, right: 400, bottom: 0, left: 360 }, { width: 2000, height: 900 }, 96), {
      top: 96,
      bottom: 96,
      left: 456,
      right: 496,
    });
  });
  it('scales an axis down so 30% of the view stays free', () => {
    const pad = framePadding({ top: 0, right: 0, bottom: 0, left: 0 }, { width: 200, height: 800 }, 96);
    assert.ok(Math.abs(pad.left + pad.right - 140) < 1e-9);
    assert.equal(pad.left, pad.right);
    assert.equal(pad.top, 96);
  });
  it('leaves padding alone before the view has a size', () => {
    assert.equal(framePadding({ top: 0, right: 0, bottom: 0, left: 0 }, { width: 0, height: 0 }, 96).left, 96);
  });
});

describe('tapBox', () => {
  it('is a 44pt box around the tap, clamped to the view', () => {
    assert.deepEqual(tapBox({ x: 10, y: 100 }, { width: 50, height: 400 }), {
      min: { x: 0, y: 78 },
      max: { x: 32, y: 122 },
    });
    assert.deepEqual(tapBox({ x: 40, y: 390 }, { width: 50, height: 400 }).max, { x: 50, y: 400 });
  });
});

describe('placeIdFromFeature', () => {
  it('reads properties.id', () => {
    assert.equal(placeIdFromFeature(JSON.stringify({ properties: { id: 'apollo-theater' } })), 'apollo-theater');
  });
  it('is undefined for junk or a missing id', () => {
    assert.equal(placeIdFromFeature('not json'), undefined);
    assert.equal(placeIdFromFeature(JSON.stringify({ properties: { id: 3 } })), undefined);
  });
});

describe('layers', () => {
  it('give every layer a unique id', () => {
    const ids = [...ROUTE_LAYERS, ...PLACE_LAYERS].map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length);
  });
  it('draw places from the place sources and accept taps on dots', () => {
    for (const layer of PLACE_LAYERS) assert.ok([PLACES_SOURCE, SELECTED_SOURCE].includes(layer.sourceId!), layer.id);
    assert.ok(TAPPABLE_LAYERS.includes(DOTS_LAYER));
  });
});
