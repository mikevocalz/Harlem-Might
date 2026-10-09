import assert from 'node:assert/strict';
import test from 'node:test';
import { createEditorialImageStore, editorialImageStateKey } from '@acme/assets';

test('keeps image-load state isolated by screen and asset', () => {
  const store = createEditorialImageStore();
  const homeKey = editorialImageStateKey('home', 'nypl-harlem-newspaper-stand-1939');
  const exploreKey = editorialImageStateKey('explore', 'nypl-harlem-newspaper-stand-1939');

  store.getState().setStatus('home', 'nypl-harlem-newspaper-stand-1939', 'loaded');

  assert.equal(store.getState().statuses[homeKey], 'loaded');
  assert.equal(store.getState().statuses[exploreKey], undefined);
});

test('failed images have an explicit state instead of remaining loading', () => {
  const store = createEditorialImageStore();
  const assetId = 'nypl-harlem-newspaper-stand-1939';

  store.getState().setStatus('explore', assetId, 'error');

  assert.equal(store.getState().statuses[editorialImageStateKey('explore', assetId)], 'error');
});
