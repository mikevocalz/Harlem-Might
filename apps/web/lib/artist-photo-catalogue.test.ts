import assert from 'node:assert/strict';
import { test } from 'node:test';
import { artistPhotoCatalogueStatus } from './artist-photo-catalogue.ts';

test('catalogue outages are retryable even for a reviewed artist', () => {
  assert.equal(artistPhotoCatalogueStatus({ status: 'unavailable', reason: 'query-failed', error: new Error('private database detail') }, 'Big L'), 503);
  assert.equal(artistPhotoCatalogueStatus({ status: 'unavailable', reason: 'not-configured' }, 'Big L'), 503);
});

test('only an answered catalogue can establish that an artist is absent', () => {
  assert.equal(artistPhotoCatalogueStatus({ status: 'ok', data: [] }, 'Big L'), 404);
  assert.equal(artistPhotoCatalogueStatus({ status: 'ok', data: [{ name: 'Big L' }] }, 'Unknown'), 404);
  assert.equal(artistPhotoCatalogueStatus({ status: 'ok', data: [{ name: 'Big L' }] }, 'Big L'), null);
});
