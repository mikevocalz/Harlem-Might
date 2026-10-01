import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { paneVisibility, WINDOW_SIZE_CLASSES_BY_WIDTH } from './constants.ts';
import {
  clearPaneOverrides,
  resolvePaneVisibility,
  togglePaneOverride,
  type PaneOverrides,
  type TogglablePane,
} from './pane-overrides.ts';
import { TRANSITIONS } from './transitions.ts';
import { PANE_WIDTH_DP, REM } from './pane-widths.ts';
import { DEFAULT_PRIMARY_WIDTH } from './resize.ts';

const CLASSES = WINDOW_SIZE_CLASSES_BY_WIDTH;
const PANES: readonly TogglablePane[] = ['primary', 'supplementary', 'inspector'];
const SHAPES: readonly (1 | 2)[] = [1, 2];

/** Classes with room for a pane the user can toggle on. */
const CAN_SHOW: Record<string, readonly TogglablePane[]> = {
  compact: [],
  medium: ['primary'],
  expanded: PANES,
  extraLarge: PANES,
};

describe('resolvePaneVisibility — no overrides', () => {
  it('matches the automatic policy for every size class and shape', () => {
    for (const sizeClass of CLASSES) {
      for (const columnCount of SHAPES) {
        assert.deepEqual(
          resolvePaneVisibility(sizeClass, columnCount),
          paneVisibility(sizeClass, columnCount),
          `${sizeClass}/${columnCount} should be untouched`,
        );
      }
    }
  });

  it('treats an empty map the same as an absent one', () => {
    for (const sizeClass of CLASSES) {
      assert.deepEqual(
        resolvePaneVisibility(sizeClass, 2, {}),
        resolvePaneVisibility(sizeClass, 2),
      );
    }
  });
});

describe('resolvePaneVisibility — hiding', () => {
  it('honours a hide override in every size class and shape', () => {
    for (const sizeClass of CLASSES) {
      for (const columnCount of SHAPES) {
        for (const pane of PANES) {
          const overrides: PaneOverrides = { [sizeClass]: { [pane]: false } };
          const resolved = resolvePaneVisibility(sizeClass, columnCount, overrides);
          assert.equal(resolved[pane], false, `${sizeClass}/${columnCount}/${pane}`);
        }
      }
    }
  });

  it('does not report the rail step for a hidden primary', () => {
    for (const sizeClass of CLASSES) {
      const resolved = resolvePaneVisibility(sizeClass, 2, {
        [sizeClass]: { primary: false },
      });
      assert.equal(resolved.primaryNarrow, false, sizeClass);
    }
  });
});

describe('resolvePaneVisibility — showing is gated by what fits', () => {
  it('only reveals a pane in a class that can physically show it', () => {
    for (const sizeClass of CLASSES) {
      for (const columnCount of SHAPES) {
        for (const pane of PANES) {
          const resolved = resolvePaneVisibility(sizeClass, columnCount, {
            [sizeClass]: { [pane]: true },
          });
          const auto = paneVisibility(sizeClass, columnCount);
          const expected = CAN_SHOW[sizeClass].includes(pane) ? true : auto[pane];
          assert.equal(resolved[pane], expected, `${sizeClass}/${columnCount}/${pane}`);
        }
      }
    }
  });

  it('never makes any pane visible on compact, whatever the override says', () => {
    for (const columnCount of SHAPES) {
      const allOn = { compact: { primary: true, supplementary: true, inspector: true } };
      assert.deepEqual(
        resolvePaneVisibility('compact', columnCount, allOn),
        paneVisibility('compact', columnCount),
      );
    }
  });

  it('does not open a third column on medium', () => {
    const resolved = resolvePaneVisibility('medium', 2, {
      medium: { supplementary: true, inspector: true },
    });
    assert.equal(resolved.supplementary, paneVisibility('medium', 2).supplementary);
    assert.equal(resolved.inspector, paneVisibility('medium', 2).inspector);
  });
});

describe('resolvePaneVisibility — overrides are scoped to one size class', () => {
  it("ignores another class's override", () => {
    for (const owner of CLASSES) {
      const overrides: PaneOverrides = { [owner]: { primary: false } };
      for (const sizeClass of CLASSES) {
        if (sizeClass === owner) continue;
        assert.deepEqual(
          resolvePaneVisibility(sizeClass, 2, overrides),
          paneVisibility(sizeClass, 2),
          `${owner}'s override leaked into ${sizeClass}`,
        );
      }
    }
  });

  it("applies each class's own override when several are recorded", () => {
    const overrides: PaneOverrides = {
      expanded: { supplementary: false },
      extraLarge: { inspector: false },
    };
    assert.equal(resolvePaneVisibility('expanded', 2, overrides).supplementary, false);
    assert.equal(
      resolvePaneVisibility('expanded', 2, overrides).inspector,
      paneVisibility('expanded', 2).inspector,
    );
    assert.equal(resolvePaneVisibility('extraLarge', 2, overrides).inspector, false);
    assert.equal(
      resolvePaneVisibility('extraLarge', 2, overrides).supplementary,
      paneVisibility('extraLarge', 2).supplementary,
    );
  });

  it("returns to the new class's default when crossing a breakpoint", () => {
    const hidden = togglePaneOverride({}, 'extraLarge', 'supplementary', true);
    assert.equal(resolvePaneVisibility('extraLarge', 2, hidden).supplementary, false);
    assert.equal(
      resolvePaneVisibility('expanded', 2, hidden).supplementary,
      paneVisibility('expanded', 2).supplementary,
    );
  });
});

describe('togglePaneOverride', () => {
  it('flips away from what is currently on screen, with no prior override', () => {
    const visible = resolvePaneVisibility('extraLarge', 2).supplementary;
    const next = togglePaneOverride({}, 'extraLarge', 'supplementary', visible);
    assert.equal(resolvePaneVisibility('extraLarge', 2, next).supplementary, !visible);
  });

  it('round-trips back to the automatic value', () => {
    const auto = resolvePaneVisibility('extraLarge', 2).inspector;
    const off = togglePaneOverride({}, 'extraLarge', 'inspector', auto);
    const on = togglePaneOverride(off, 'extraLarge', 'inspector', !auto);
    assert.equal(resolvePaneVisibility('extraLarge', 2, on).inspector, auto);
  });

  it('does not mutate the map it is given', () => {
    const before: PaneOverrides = { expanded: { primary: false } };
    const snapshot = JSON.stringify(before);
    togglePaneOverride(before, 'expanded', 'inspector', true);
    assert.equal(JSON.stringify(before), snapshot);
  });

  it('leaves other size classes untouched', () => {
    const next = togglePaneOverride({ medium: { primary: false } }, 'expanded', 'primary', true);
    assert.equal(next.medium?.primary, false);
    assert.equal(next.expanded?.primary, false);
  });
});

describe('clearPaneOverrides', () => {
  it('returns the class to automatic behaviour', () => {
    const overrides = togglePaneOverride({}, 'expanded', 'supplementary', true);
    const cleared = clearPaneOverrides(overrides, 'expanded');
    assert.deepEqual(
      resolvePaneVisibility('expanded', 2, cleared),
      paneVisibility('expanded', 2),
    );
  });

  it("keeps other classes' overrides", () => {
    const overrides: PaneOverrides = {
      expanded: { primary: false },
      extraLarge: { inspector: false },
    };
    const cleared = clearPaneOverrides(overrides, 'expanded');
    assert.equal(cleared.expanded, undefined);
    assert.equal(cleared.extraLarge?.inspector, false);
  });

  it('does not mutate the map it is given', () => {
    const before: PaneOverrides = { expanded: { primary: false } };
    clearPaneOverrides(before, 'expanded');
    assert.equal(before.expanded?.primary, false);
  });
});

describe('TRANSITIONS', () => {
  it('keeps width on a tween — a spring reflows neighbours on every overshoot frame', () => {
    assert.equal(TRANSITIONS.paneWidth.type, 'timing');
  });

  it('uses a spring only for the native-driven pane slide', () => {
    const springs = Object.entries(TRANSITIONS)
      .filter(([, t]) => t.type === 'spring')
      .map(([name]) => name);
    assert.deepEqual(springs, ['paneSlide']);
  });
});

describe('PANE_WIDTH_DP', () => {
  it('matches the rem basis the resizable primary pane already uses', () => {
    // Both derive from theme tokens at the app's rem polyfill of 14. If the
    // polyfill changes and only one is updated, drags and collapses would
    // disagree about how wide the pane is.
    assert.equal(PANE_WIDTH_DP.primary, DEFAULT_PRIMARY_WIDTH);
    assert.equal(REM, 14);
  });

  it('keeps the rail step narrower than the full sidebar', () => {
    assert.ok(PANE_WIDTH_DP.primaryNarrow < PANE_WIDTH_DP.primary);
  });
});
