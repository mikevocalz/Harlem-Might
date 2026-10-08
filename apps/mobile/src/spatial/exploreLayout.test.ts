import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MetaWindowPlacement } from '@viro-external/meta-layout';
import { WINDOW_SIZE_CLASS_MIN_WIDTH_DP, type WindowSizeClass } from '../navigation/split-view/constants.ts';
import {
  EXPLORE_PANE_DP,
  exploreBackAction,
  paneRowWidth,
  resolveExploreLayout,
  type ExploreLayoutInput,
} from './exploreLayout.ts';

const BASE: ExploreLayoutInput = {
  sizeClass: 'large',
  hasSelection: false,
  discoverPlacement: 'inline',
  detailPlacement: 'inline',
  isHorizon: false,
  compactPane: 'map',
  discoverDrawerOpen: false,
};

const layout = (patch: Partial<ExploreLayoutInput>) => resolveExploreLayout({ ...BASE, ...patch });

const SIZE_CLASSES = Object.keys(WINDOW_SIZE_CLASS_MIN_WIDTH_DP) as WindowSizeClass[];
const PLACEMENTS: MetaWindowPlacement[] = ['inline', 'pending', 'spatial', 'dropped'];

describe('resolveExploreLayout: the map is the centre', () => {
  it('M1: at the narrowest width of every tiled class, the map is the widest pane', () => {
    for (const sizeClass of ['expanded', 'large', 'extraLarge'] as const) {
      for (const isHorizon of [false, true]) {
        const resolved = layout({ sizeClass, hasSelection: true, isHorizon });
        const windowWidth = WINDOW_SIZE_CLASS_MIN_WIDTH_DP[sizeClass];
        const mapWidth = windowWidth - paneRowWidth(resolved.discover) - paneRowWidth(resolved.detail);
        assert.ok(
          mapWidth >= paneRowWidth(resolved.discover) && mapWidth >= paneRowWidth(resolved.detail),
          `${sizeClass} horizon=${isHorizon}: map ${mapWidth}dp`,
        );
      }
    }
  });

  it('Horizon flat at 1280dp keeps the map at 520dp with Detail at 440dp', () => {
    const resolved = layout({ sizeClass: 'large', hasSelection: true, isHorizon: true });
    assert.deepEqual(resolved.detail, { kind: 'tiled', width: EXPLORE_PANE_DP.detailXr });
    assert.equal(1280 - paneRowWidth(resolved.discover) - paneRowWidth(resolved.detail), 520);
  });

  it('overlays Detail instead of tiling it where tiling would squeeze the map', () => {
    for (const sizeClass of ['medium', 'expanded'] as const) {
      const resolved = layout({ sizeClass, hasSelection: true });
      assert.equal(resolved.detail?.kind, 'overlay', sizeClass);
      assert.equal(resolved.mapInsets.right, EXPLORE_PANE_DP.detail, sizeClass);
    }
  });
});

describe('resolveExploreLayout: Detail exists only with a selection (S5, M3)', () => {
  it('has no Detail pane anywhere without a selection', () => {
    for (const sizeClass of SIZE_CLASSES) {
      for (const detailPlacement of PLACEMENTS) {
        assert.equal(layout({ sizeClass, detailPlacement }).detail, null, `${sizeClass}/${detailPlacement}`);
      }
    }
  });

  it('collapses a promoted pane so the map takes its width', () => {
    const resolved = layout({ hasSelection: true, discoverPlacement: 'spatial', detailPlacement: 'spatial' });
    assert.deepEqual(resolved.discover, { kind: 'promoted' });
    assert.deepEqual(resolved.detail, { kind: 'promoted' });
    assert.equal(paneRowWidth(resolved.discover) + paneRowWidth(resolved.detail), 0);
    assert.equal(resolved.showMap, true);
  });

  it('renders a pending window inline so a slow promotion never blanks it', () => {
    const resolved = layout({ hasSelection: true, discoverPlacement: 'pending', detailPlacement: 'pending' });
    assert.equal(resolved.discover.kind, 'tiled');
    assert.equal(resolved.detail?.kind, 'tiled');
  });
});

describe('resolveExploreLayout: compact', () => {
  it('opens on the map with Discover mounted but collapsed', () => {
    const resolved = layout({ sizeClass: 'compact' });
    assert.equal(resolved.showMap, true);
    assert.deepEqual(resolved.discover, { kind: 'collapsed' });
    assert.equal(resolved.showPlacesToggle, true);
    assert.equal(resolved.assistant, 'sheet');
  });

  it('never drops Discover when the window shrinks, so its Horizon window stays registered', () => {
    for (const compactPane of ['map', 'discover', 'detail'] as const) {
      for (const hasSelection of [false, true]) {
        const resolved = layout({ sizeClass: 'compact', compactPane, hasSelection, discoverPlacement: 'spatial' });
        assert.deepEqual(resolved.discover, { kind: 'promoted' }, `${compactPane}/${hasSelection}`);
      }
    }
  });

  it('shows Detail full screen with Back and "Show on map"', () => {
    const resolved = layout({ sizeClass: 'compact', hasSelection: true, compactPane: 'detail' });
    assert.deepEqual(resolved.detail, { kind: 'screen' });
    assert.equal(resolved.showMap, false);
    assert.equal(resolved.detailDismiss, 'back');
    assert.equal(resolved.showOnMapInDetail, true);
  });

  it('keeps the selection on the map after "Show on map"', () => {
    const resolved = layout({ sizeClass: 'compact', hasSelection: true, compactPane: 'map' });
    assert.deepEqual(resolved.detail, { kind: 'collapsed' });
    assert.equal(resolved.showMap, true);
  });

  it('falls back to the map when the detail pane is asked for with nothing selected', () => {
    const resolved = layout({ sizeClass: 'compact', compactPane: 'detail' });
    assert.equal(resolved.detail, null);
    assert.equal(resolved.showMap, true);
  });
});

describe('resolveExploreLayout: medium drawer', () => {
  it('keeps Discover closed until "Places" opens the drawer over the map', () => {
    assert.deepEqual(layout({ sizeClass: 'medium' }).discover, { kind: 'collapsed' });
    const open = layout({ sizeClass: 'medium', discoverDrawerOpen: true });
    assert.deepEqual(open.discover, { kind: 'overlay', width: EXPLORE_PANE_DP.discover });
    assert.equal(open.mapInsets.left, EXPLORE_PANE_DP.discover);
    assert.equal(open.showPlacesToggle, false);
    assert.equal(open.showMapToggle, true);
  });
});

describe('exploreBackAction', () => {
  it('closes the assistant, then Detail, then a covering Discover, then yields', () => {
    const withDetail = layout({ hasSelection: true });
    assert.equal(exploreBackAction({ assistantOpen: true, layout: withDetail }), 'close-assistant');
    assert.equal(exploreBackAction({ assistantOpen: false, layout: withDetail }), 'close-detail');
    assert.equal(
      exploreBackAction({ assistantOpen: false, layout: layout({ sizeClass: 'compact', compactPane: 'discover' }) }),
      'show-map',
    );
    assert.equal(
      exploreBackAction({ assistantOpen: false, layout: layout({ sizeClass: 'medium', discoverDrawerOpen: true }) }),
      'close-drawer',
    );
    assert.equal(exploreBackAction({ assistantOpen: false, layout: layout({}) }), null);
  });
});
