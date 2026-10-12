import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PlaceDoc } from '../../../content/docs.ts';
import { mapPlaceRef } from '../../../content/map.ts';
import { linkPlace } from './place-link.ts';

const source: PlaceDoc = {
  id: 301,
  slug: 'new-neighborhood-gallery',
  name: 'New Neighborhood Gallery',
  kind: 'culture',
  lifecycle: 'open',
  locationAccuracy: 'verified',
  primaryArea: 'East Harlem',
  address: { formatted: '123 East 110th Street' },
  summary: 'The catalogue description.',
  location: [-73.94, 40.8],
};

describe('canonical relationship links', () => {
  it('links a non-fixture venue, walk stop or story place using its populated catalogue record', () => {
    const ref = mapPlaceRef(source);
    const link = linkPlace(ref);
    assert.ok(link);
    assert.equal(link.href, '/places/new-neighborhood-gallery');
    assert.equal(link.ref, ref);
    assert.deepEqual(link.ref, {
      id: 301, slug: source.slug, name: source.name,
      area: source.primaryArea, address: source.address?.formatted,
      summary: source.summary, lngLat: source.location,
    });
  });

  it('links a place without optional facts, without substituting fixture metadata', () => {
    const ref = mapPlaceRef({
      ...source, slug: 'apollo-theater', name: 'Current Catalogue Name',
      primaryArea: null, address: null, summary: null, location: null,
    });
    assert.deepEqual(linkPlace(ref), {
      href: '/places/apollo-theater',
      ref: { id: 301, slug: 'apollo-theater', name: 'Current Catalogue Name' },
    });
  });

  it('leaves deleted or unpopulated relationships unlinked', () => {
    for (const relationship of [undefined, null, 301]) {
      assert.equal(linkPlace(mapPlaceRef(relationship)), null);
    }
  });
});
