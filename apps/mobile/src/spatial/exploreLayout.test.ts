import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MetaWindowPlacement } from '@viro-external/meta-layout';
import { WINDOW_SIZE_CLASS_MIN_WIDTH_DP, type WindowSizeClass } from '../navigation/split-view/constants.ts';
import {
  exploreBackAction,
  paneRowWidth,
  resolveExploreLayout,
  type ExploreLayout,
  type ExploreLayoutInput,
} from './exploreLayout.ts';

const BASE: ExploreLayoutInput = {
  windowWidth: WINDOW_SIZE_CLASS_MIN_WIDTH_DP.large,
  hasSelection: false,
  detailPlacement: 'inline',
  isHorizon: false,
  compactPane: 'map',
  discoverDrawerOpen: false,
};

const layout = (patch: Partial<ExploreLayoutInput>) => resolveExploreLayout({ ...BASE, ...patch });
/** A flat window at the narrowest width of a Material size class. */
const flat = (sizeClass: WindowSizeClass, patch: Partial<ExploreLayoutInput> = {}) =>
  layout({ windowWidth: Math.max(WINDOW_SIZE_CLASS_MIN_WIDTH_DP[sizeClass], 360), ...patch });
/** A quest build at `windowWidth` dp. */
const horizon = (windowWidth: number, patch: Partial<ExploreLayoutInput> = {}) =>
  layout({ isHorizon: true, windowWidth, ...patch });
const mapWidth = (windowWidth: number, resolved: ExploreLayout) =>
  windowWidth - paneRowWidth(resolved.discover) - paneRowWidth(resolved.detail);

const SIZE_CLASSES = Object.keys(WINDOW_SIZE_CLASS_MIN_WIDTH_DP) as WindowSizeClass[];
const PLACEMENTS: MetaWindowPlacement[] = ['inline', 'pending', 'spatial', 'dropped'];
/** Every Horizon width that matters: the 384dp minimum, each breakpoint and its neighbour, the 1440 default. */
const HORIZON_WIDTHS = [384, 839, 840, 1000, 1199, 1200, 1359, 1360, 1440, 1600];

describe('Horizon Explore keeps the list and map visible on resize', () => {
  it('uses 40/60 within the unchanged 1440dp window', () => {
    assert.deepEqual(horizon(1440).discover, { kind: 'tiled', width: 576 });
    assert.equal(mapWidth(1440, horizon(1440)), 864);
    assert.deepEqual(horizon(1440, { hasSelection: true }).detail, { kind: 'overlay', width: 432 });
    assert.equal(mapWidth(1440, horizon(1440, { hasSelection: true })), 864);
  });
  it('never collapses Discover or hides the map through resizing, selection and panel promotion', () => {
    for (const windowWidth of HORIZON_WIDTHS) {
      for (const hasSelection of [false, true]) {
        for (const detailPlacement of PLACEMENTS) {
          for (const compactPane of ['map', 'discover', 'detail'] as const) {
            const resolved = horizon(windowWidth, { hasSelection, detailPlacement, compactPane });
            const label = `${windowWidth}/${hasSelection}/${detailPlacement}/${compactPane}`;
            assert.equal(resolved.arrangement, 'columns', label);
            assert.equal(resolved.discover.kind, 'tiled', label);
            assert.equal(resolved.showMap, true, label);
            assert.equal(resolved.showPlacesToggle, false, label);
            assert.equal(resolved.discoverDismiss, null, label);
            assert.ok(paneRowWidth(resolved.discover) > 0, label);
            assert.ok(mapWidth(windowWidth, resolved) > paneRowWidth(resolved.discover), label);
            assert.ok(mapWidth(windowWidth, resolved) > paneRowWidth(resolved.detail), label);
            assert.deepEqual(resolved.mapInsets, { left: 0, right: 0 }, label);
          }
        }
      }
    }
  });
  it('ignores stale phone drawer state on Quest', () => {
    for (const width of HORIZON_WIDTHS) {
      assert.deepEqual(horizon(width), horizon(width, { discoverDrawerOpen: true }));
    }
  });
});

describe('Explore 40/60 workspace and selected inspector', () => {
  it('keeps list and map widths unchanged when the selected inspector opens across resizes', () => {
    for (const width of [600, 768, 840, 1000, 1200, 1440, 1920]) {
      for (const hasSelection of [false, true]) {
        for (const detailPlacement of PLACEMENTS) {
          const resolved = layout({ windowWidth: width, hasSelection, detailPlacement });
          const list = paneRowWidth(resolved.discover);
          const unselected = layout({ windowWidth: width });
          assert.deepEqual(resolved.discover, unselected.discover);
          assert.equal(mapWidth(width, resolved), mapWidth(width, unselected));
          assert.equal(paneRowWidth(resolved.detail), 0);
          assert.ok(Math.abs(mapWidth(width, resolved) / list - 1.5) < 0.00001);
          assert.equal(resolved.discover.kind, 'tiled');
          assert.equal(resolved.showPlacesToggle, false);
          assert.equal(resolved.detail?.kind, !hasSelection ? undefined : detailPlacement === 'spatial' ? 'promoted' : 'overlay');
          if (resolved.detail?.kind === 'overlay') {
            assert.equal(resolved.detail.width, width * 0.3);
          }
          assert.ok(mapWidth(width, resolved) >= paneRowWidth(resolved.detail));
        }
      }
    }
  });
});

describe('resolveExploreLayout: Detail exists only with a selection (S5, M3)', () => {
  it('has no Detail pane anywhere without a selection', () => {
    for (const isHorizon of [false, true]) {
      for (const windowWidth of [360, ...HORIZON_WIDTHS]) {
        for (const detailPlacement of PLACEMENTS) {
          assert.equal(
            layout({ isHorizon, windowWidth, detailPlacement }).detail,
            null,
            `${isHorizon}/${windowWidth}/${detailPlacement}`,
          );
        }
      }
    }
  });

  it('would collapse a promoted Detail so the map takes its width (kept for the deferred opt-in)', () => {
    const resolved = horizon(1440, { hasSelection: true, detailPlacement: 'spatial' });
    assert.deepEqual(resolved.detail, { kind: 'promoted' });
    assert.deepEqual(resolved.discover, { kind: 'tiled', width: 576 });
    assert.equal(mapWidth(1440, resolved), 864);
  });

  it('keeps Discover in the main window at every width and placement (S12)', () => {
    for (const isHorizon of [false, true]) {
      for (const sizeClass of SIZE_CLASSES) {
        for (const detailPlacement of PLACEMENTS) {
          for (const hasSelection of [false, true]) {
            const resolved = flat(sizeClass, { isHorizon, detailPlacement, hasSelection });
            assert.notEqual((resolved.discover as { kind: string }).kind, 'promoted');
          }
        }
      }
    }
  });
});

describe('resolveExploreLayout: single column', () => {
  it('opens on the map with Discover mounted but collapsed', () => {
    const resolved = flat('compact');
    assert.equal(resolved.arrangement, 'single');
    assert.equal(resolved.showMap, true);
    assert.deepEqual(resolved.discover, { kind: 'collapsed' });
    assert.equal(resolved.showPlacesToggle, true);
    assert.equal(resolved.assistant, 'sheet');
  });

  it('shows Detail full screen with Back and "Show on map"', () => {
    const resolved = flat('compact', { hasSelection: true, compactPane: 'detail' });
    assert.deepEqual(resolved.detail, { kind: 'screen' });
    assert.equal(resolved.showMap, false);
    assert.equal(resolved.detailDismiss, 'back');
    assert.equal(resolved.showOnMapInDetail, true);
  });

  it('keeps the selection on the map after "Show on map"', () => {
    const resolved = flat('compact', { hasSelection: true, compactPane: 'map' });
    assert.deepEqual(resolved.detail, { kind: 'collapsed' });
    assert.equal(resolved.showMap, true);
  });

  it('falls back to the map when the detail pane is asked for with nothing selected', () => {
    const resolved = flat('compact', { compactPane: 'detail' });
    assert.equal(resolved.detail, null);
    assert.equal(resolved.showMap, true);
  });
});

describe('exploreBackAction', () => {
  it('closes the assistant, then Detail, then a covering Discover, then yields', () => {
    const withDetail = flat('large', { hasSelection: true });
    assert.equal(exploreBackAction({ assistantOpen: true, layout: withDetail }), 'close-assistant');
    assert.equal(exploreBackAction({ assistantOpen: false, layout: withDetail }), 'close-detail');
    assert.equal(
      exploreBackAction({ assistantOpen: false, layout: flat('compact', { compactPane: 'discover' }) }),
      'show-map',
    );
    assert.equal(
      exploreBackAction({ assistantOpen: false, layout: flat('medium', { discoverDrawerOpen: true }) }),
      null,
    );
    assert.equal(exploreBackAction({ assistantOpen: false, layout: flat('large') }), null);
  });

  it('closes a Detail the user moved away from after anything covering it', () => {
    assert.equal(
      exploreBackAction({ assistantOpen: false, layout: flat('compact', { hasSelection: true, compactPane: 'map' }) }),
      'close-detail',
    );
    assert.equal(exploreBackAction({ assistantOpen: false, layout: horizon(1440, { hasSelection: true }) }), 'close-detail');
  });
});
