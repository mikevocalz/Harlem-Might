import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MetaWindowPlacement } from '@viro-external/meta-layout';
import { WINDOW_SIZE_CLASS_MIN_WIDTH_DP, type WindowSizeClass } from '../navigation/split-view/constants.ts';
import {
  EXPLORE_PANE_DP,
  exploreBackAction,
  HORIZON_BREAKPOINT_DP,
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

describe('Horizon main window (S17): Discover 360 | map | Detail 400', () => {
  it('uses the S17 pane widths', () => {
    assert.equal(EXPLORE_PANE_DP.discoverXr, 360);
    assert.equal(EXPLORE_PANE_DP.detailXr, 400);
    assert.equal(EXPLORE_PANE_DP.mapMinXr, 600);
    assert.deepEqual(HORIZON_BREAKPOINT_DP, { toggle: 840, columns: 1200 });
  });

  it('at 1440dp with nothing selected: Discover 360 and the map 1080, no Detail', () => {
    const resolved = horizon(1440);
    assert.equal(resolved.arrangement, 'columns');
    assert.deepEqual(resolved.discover, { kind: 'tiled', width: 360 });
    assert.equal(resolved.detail, null);
    assert.equal(mapWidth(1440, resolved), 1080);
  });

  it('at 1440dp with a place selected: Detail 400 tiles beside the map, which narrows to 680', () => {
    const resolved = horizon(1440, { hasSelection: true });
    assert.equal(resolved.arrangement, 'columns');
    assert.deepEqual(resolved.detail, { kind: 'tiled', width: 400 });
    assert.equal(mapWidth(1440, resolved), 680);
    assert.equal(resolved.detailDismiss, 'close');
    assert.equal(resolved.showOnMapInDetail, false);
  });

  it('never draws anything over the map at any Horizon width', () => {
    for (const windowWidth of HORIZON_WIDTHS) {
      for (const hasSelection of [false, true]) {
        for (const discoverDrawerOpen of [false, true]) {
          for (const compactPane of ['map', 'discover', 'detail'] as const) {
            const resolved = horizon(windowWidth, { hasSelection, discoverDrawerOpen, compactPane });
            const label = `${windowWidth}/${hasSelection}/${discoverDrawerOpen}/${compactPane}`;
            assert.notEqual(resolved.discover.kind, 'overlay', label);
            assert.notEqual(resolved.detail?.kind, 'overlay', label);
            assert.deepEqual(resolved.mapInsets, { left: 0, right: 0 }, label);
          }
        }
      }
    }
  });

  it('keeps the map at 600dp or more whenever Discover is a permanent column', () => {
    for (const windowWidth of HORIZON_WIDTHS) {
      for (const hasSelection of [false, true]) {
        const resolved = horizon(windowWidth, { hasSelection });
        if (resolved.arrangement === 'columns') {
          assert.ok(mapWidth(windowWidth, resolved) >= EXPLORE_PANE_DP.mapMinXr, `${windowWidth}/${hasSelection}`);
        }
      }
    }
  });

  it('keeps the map the widest pane, at 440dp or more, from 840dp up', () => {
    for (const windowWidth of HORIZON_WIDTHS.filter((width) => width >= 840)) {
      for (const hasSelection of [false, true]) {
        for (const discoverDrawerOpen of [false, true]) {
          const resolved = horizon(windowWidth, { hasSelection, discoverDrawerOpen });
          const map = mapWidth(windowWidth, resolved);
          const label = `${windowWidth}/${hasSelection}/${discoverDrawerOpen}`;
          assert.ok(map >= 440, `${label}: map ${map}dp`);
          assert.ok(map >= paneRowWidth(resolved.discover) && map >= paneRowWidth(resolved.detail), label);
        }
      }
    }
  });

  it('840–1199dp: Discover folds behind "Places" and Detail stays a column', () => {
    for (const windowWidth of [840, 1000, 1199]) {
      const resolved = horizon(windowWidth, { hasSelection: true });
      assert.equal(resolved.arrangement, 'toggle');
      assert.deepEqual(resolved.discover, { kind: 'collapsed' });
      assert.deepEqual(resolved.detail, { kind: 'tiled', width: 400 });
      assert.equal(resolved.showPlacesToggle, true);
    }
  });

  it('opening Discover from "Places" replaces Detail for the moment and keeps the selection', () => {
    const resolved = horizon(1000, { hasSelection: true, discoverDrawerOpen: true });
    assert.deepEqual(resolved.discover, { kind: 'tiled', width: 360 });
    assert.deepEqual(resolved.detail, { kind: 'collapsed' });
    assert.equal(resolved.discoverDismiss, 'close');
    assert.equal(resolved.showPlacesToggle, false);
    assert.equal(exploreBackAction({ assistantOpen: false, layout: resolved }), 'close-drawer');
  });

  it('1200–1359dp: Discover is a column until a selection would push the map under 600dp', () => {
    assert.equal(horizon(1200).arrangement, 'columns');
    assert.equal(horizon(1200, { hasSelection: true }).arrangement, 'toggle');
    assert.equal(horizon(1359, { hasSelection: true }).arrangement, 'toggle');
    assert.equal(horizon(1360, { hasSelection: true }).arrangement, 'columns');
  });

  it('below 840dp: one pane at a time, like a phone', () => {
    const resolved = horizon(839, { hasSelection: true, compactPane: 'detail' });
    assert.equal(resolved.arrangement, 'single');
    assert.deepEqual(resolved.detail, { kind: 'screen' });
    assert.equal(resolved.showMap, false);
    assert.equal(resolved.detailDismiss, 'back');
    assert.equal(resolved.showOnMapInDetail, true);
  });

  it('ignores the drawer flag while Discover is a permanent column', () => {
    const resolved = horizon(1440, { hasSelection: true, discoverDrawerOpen: true });
    assert.deepEqual(resolved.detail, { kind: 'tiled', width: 400 });
    assert.equal(resolved.discoverFromToggle, false);
  });
});

describe('resolveExploreLayout: flat builds keep the Material bands', () => {
  it('M1: at the narrowest width of every tiled class, the map is the widest pane', () => {
    for (const sizeClass of ['expanded', 'large', 'extraLarge'] as const) {
      const resolved = flat(sizeClass, { hasSelection: true });
      const windowWidth = WINDOW_SIZE_CLASS_MIN_WIDTH_DP[sizeClass];
      const map = mapWidth(windowWidth, resolved);
      assert.ok(map >= paneRowWidth(resolved.discover) && map >= paneRowWidth(resolved.detail), `${sizeClass}: ${map}dp`);
    }
  });

  it('overlays Detail instead of tiling it where tiling would squeeze the map', () => {
    for (const sizeClass of ['medium', 'expanded'] as const) {
      const resolved = flat(sizeClass, { hasSelection: true });
      assert.equal(resolved.detail?.kind, 'overlay', sizeClass);
      assert.equal(resolved.mapInsets.right, EXPLORE_PANE_DP.detail, sizeClass);
    }
  });

  it('keeps the medium drawer: "Places" opens Discover over the map, "Map" closes it', () => {
    assert.deepEqual(flat('medium').discover, { kind: 'collapsed' });
    const open = flat('medium', { discoverDrawerOpen: true });
    assert.deepEqual(open.discover, { kind: 'overlay', width: EXPLORE_PANE_DP.discover });
    assert.equal(open.mapInsets.left, EXPLORE_PANE_DP.discover);
    assert.equal(open.showPlacesToggle, false);
    assert.equal(open.discoverDismiss, 'show-map');
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
    assert.deepEqual(resolved.discover, { kind: 'tiled', width: 360 });
    assert.equal(mapWidth(1440, resolved), 1080);
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
      'close-drawer',
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
