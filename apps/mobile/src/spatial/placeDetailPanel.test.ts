import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PLACE_DETAIL_PANEL_DP,
  placeDetailPanelCommand,
  placeDetailPlacement,
  type PlaceDetailPanelStatus,
} from './placeDetailPanel.ts';
import { resolveExploreLayout } from './exploreLayout.ts';

describe('placeDetailPanelCommand (DECISIONS S20)', () => {
  it('opens the panel when a place is selected on a build that has one', () => {
    assert.equal(placeDetailPanelCommand({ selectedPlaceId: 'apollo', status: 'closed', isAvailable: true }), 'open');
  });

  it('never opens where panels are unavailable (phones, web, PICO)', () => {
    assert.equal(placeDetailPanelCommand({ selectedPlaceId: 'apollo', status: 'closed', isAvailable: false }), null);
  });

  it('leaves an opening or open panel alone when the selection changes, so it updates in place', () => {
    for (const status of ['opening', 'open'] as const) {
      assert.equal(placeDetailPanelCommand({ selectedPlaceId: 'schomburg', status, isAvailable: true }), null);
    }
  });

  it('does not retry a failed launch for the same selection', () => {
    assert.equal(placeDetailPanelCommand({ selectedPlaceId: 'apollo', status: 'failed', isAvailable: true }), null);
  });

  it('closes an opening or open panel once nothing is selected', () => {
    for (const status of ['opening', 'open'] as const) {
      assert.equal(placeDetailPanelCommand({ selectedPlaceId: null, status, isAvailable: true }), 'close');
    }
    for (const status of ['closed', 'failed'] as const) {
      assert.equal(placeDetailPanelCommand({ selectedPlaceId: null, status, isAvailable: true }), null);
    }
  });
});

describe('placeDetailPlacement', () => {
  const layoutFor = (status: PlaceDetailPanelStatus) =>
    resolveExploreLayout({
      windowWidth: 1440,
      hasSelection: true,
      detailPlacement: placeDetailPlacement(status),
      isHorizon: true,
      compactPane: 'map',
      discoverDrawerOpen: false,
    });

  it('drops the in-window Detail column while the panel is opening or open', () => {
    assert.deepEqual(layoutFor('opening').detail, { kind: 'promoted' });
    assert.deepEqual(layoutFor('open').detail, { kind: 'promoted' });
  });

  it('falls back to the S17 column when the panel is closed or failed', () => {
    assert.equal(layoutFor('failed').detail?.kind, 'tiled');
    assert.equal(layoutFor('closed').detail?.kind, 'tiled');
  });

  it('is 400x600dp', () => {
    assert.deepEqual(PLACE_DETAIL_PANEL_DP, { width: 400, height: 600 });
  });
});
