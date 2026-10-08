import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  DEFAULT_SHEET_DETENT,
  locationPermissionFromBrowser,
  toggleId,
  useExplore,
} from './explore.store.ts';

beforeEach(() => useExplore.setState(useExplore.getInitialState(), true));

describe('toggleId', () => {
  it('adds an absent id and removes a present one', () => {
    assert.deepEqual(toggleId([], 'apollo'), ['apollo']);
    assert.deepEqual(toggleId(['apollo', 'sylvias'], 'apollo'), ['sylvias']);
  });

  it('never mutates its input', () => {
    const ids = ['apollo'];
    toggleId(ids, 'apollo');
    assert.deepEqual(ids, ['apollo']);
  });
});

describe('locationPermissionFromBrowser', () => {
  it('maps every Permissions API state', () => {
    assert.equal(locationPermissionFromBrowser('granted'), 'granted');
    assert.equal(locationPermissionFromBrowser('denied'), 'denied');
    assert.equal(locationPermissionFromBrowser('prompt'), 'unknown');
    assert.equal(locationPermissionFromBrowser(undefined), 'unavailable');
  });
});

describe('sheet slice', () => {
  it('starts closed at the default detent', () => {
    assert.deepEqual(useExplore.getState().sheet, { open: false, detent: DEFAULT_SHEET_DETENT, returnFocusId: null });
  });

  it('opens at the default detent unless one is named', () => {
    useExplore.getState().openSheet();
    assert.deepEqual(useExplore.getState().sheet, { open: true, detent: 'half', returnFocusId: null });
    useExplore.getState().openSheet('peek');
    assert.deepEqual(useExplore.getState().sheet, { open: true, detent: 'peek', returnFocusId: null });
  });

  it('keeps the detent through a close', () => {
    useExplore.getState().openSheet('full');
    useExplore.getState().closeSheet();
    assert.deepEqual(useExplore.getState().sheet, { open: false, detent: 'full', returnFocusId: null });
  });

  it('remembers the opener through a close so focus can return to it', () => {
    useExplore.getState().openSheet('half', 'marker:apollo-theater');
    useExplore.getState().closeSheet();
    assert.equal(useExplore.getState().sheet.returnFocusId, 'marker:apollo-theater');
    useExplore.getState().openSheet();
    assert.equal(useExplore.getState().sheet.returnFocusId, null);
  });

  it('changes detent without opening a closed sheet', () => {
    useExplore.getState().setSheetDetent('full');
    assert.deepEqual(useExplore.getState().sheet, { open: false, detent: 'full', returnFocusId: null });
  });
});

describe('saved ids and permission', () => {
  it('toggles saved preview ids', () => {
    useExplore.getState().toggleSavedPreview('apollo-theater');
    assert.deepEqual(useExplore.getState().savedPreviewIds, ['apollo-theater']);
    useExplore.getState().toggleSavedPreview('apollo-theater');
    assert.deepEqual(useExplore.getState().savedPreviewIds, []);
  });

  it('records location permission', () => {
    useExplore.getState().setLocationPermission('denied');
    assert.equal(useExplore.getState().locationPermission, 'denied');
  });
});
