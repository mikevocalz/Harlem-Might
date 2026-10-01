import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  paneVisibility,
  windowSizeClassForWidth,
  WINDOW_SIZE_CLASS_MIN_WIDTH_DP,
} from './constants.ts';
import { previousColumn, resolveBack } from './back-navigation.ts';
import {
  clampPrimaryWidth,
  widthAfterDrag,
  DEFAULT_PRIMARY_WIDTH,
  PRIMARY_WIDTH_MAX,
  PRIMARY_WIDTH_MIN,
} from './resize.ts';
import { useSplitViewStore } from './store.ts';

describe('windowSizeClassForWidth', () => {
  it('resolves each Material 3 band at its exact lower bound', () => {
    assert.equal(windowSizeClassForWidth(WINDOW_SIZE_CLASS_MIN_WIDTH_DP.compact), 'compact');
    assert.equal(windowSizeClassForWidth(WINDOW_SIZE_CLASS_MIN_WIDTH_DP.medium), 'medium');
    assert.equal(windowSizeClassForWidth(WINDOW_SIZE_CLASS_MIN_WIDTH_DP.expanded), 'expanded');
    assert.equal(windowSizeClassForWidth(WINDOW_SIZE_CLASS_MIN_WIDTH_DP.extraLarge), 'extraLarge');
  });

  it('treats each boundary as inclusive-lower, so 1dp below belongs to the band under it', () => {
    assert.equal(windowSizeClassForWidth(599), 'compact');
    assert.equal(windowSizeClassForWidth(600), 'medium');
    assert.equal(windowSizeClassForWidth(839), 'medium');
    assert.equal(windowSizeClassForWidth(840), 'expanded');
    assert.equal(windowSizeClassForWidth(1199), 'expanded');
    assert.equal(windowSizeClassForWidth(1200), 'extraLarge');
  });
});

describe('paneVisibility', () => {
  it('shows exactly zero leading panes at compact in both shapes', () => {
    for (const columnCount of [1, 2] as const) {
      const visible = paneVisibility('compact', columnCount);
      assert.equal(visible.primary, false);
      assert.equal(visible.supplementary, false);
      assert.equal(visible.inspector, false);
    }
  });

  it('gives the three-pane shape sidebar + supplementary + inspector only at extraLarge', () => {
    const xl = paneVisibility('extraLarge', 2);
    assert.deepEqual(xl, {
      primary: true,
      supplementary: true,
      inspector: true,
      primaryNarrow: false,
    });
  });

  it('narrows the sidebar to a rail at expanded before dropping it at medium', () => {
    assert.equal(paneVisibility('expanded', 2).primaryNarrow, true);
    assert.equal(paneVisibility('expanded', 2).primary, true);
    assert.equal(paneVisibility('medium', 2).primary, false);
    assert.equal(paneVisibility('medium', 2).supplementary, true);
  });

  it('never shows the inspector below expanded', () => {
    for (const columnCount of [1, 2] as const) {
      assert.equal(paneVisibility('medium', columnCount).inspector, false);
      assert.equal(paneVisibility('compact', columnCount).inspector, false);
    }
  });
});

describe('previousColumn', () => {
  it('skips supplementary in the two-pane shape', () => {
    assert.equal(previousColumn('secondary', 1), 'primary');
  });

  it('steps through supplementary in the three-pane shape', () => {
    assert.equal(previousColumn('secondary', 2), 'supplementary');
    assert.equal(previousColumn('supplementary', 2), 'primary');
  });

  it('returns null at the leading column so Back can fall through', () => {
    assert.equal(previousColumn('primary', 1), null);
    assert.equal(previousColumn('primary', 2), null);
  });
});

describe('resolveBack', () => {
  it('defers to the detail stack before stepping columns', () => {
    assert.deepEqual(
      resolveBack({ activeColumn: 'secondary', columnCount: 2, canGoBack: true }),
      { kind: 'defer' },
    );
  });

  it('steps a column once the detail stack is exhausted', () => {
    assert.deepEqual(
      resolveBack({ activeColumn: 'secondary', columnCount: 2, canGoBack: false }),
      { kind: 'step', column: 'supplementary' },
    );
  });

  it('does not consume Back to pop a stack the user cannot see', () => {
    // Sidebar is showing and the (hidden) detail stack still has history.
    // Popping it would look like a dead Back press.
    assert.deepEqual(
      resolveBack({ activeColumn: 'supplementary', columnCount: 2, canGoBack: true }),
      { kind: 'step', column: 'primary' },
    );
  });

  it('falls through at the leading column even when the detail stack is deep', () => {
    assert.deepEqual(
      resolveBack({ activeColumn: 'primary', columnCount: 2, canGoBack: true }),
      { kind: 'fallThrough' },
    );
  });

  it('walks the full three-pane chain to fall-through in three presses', () => {
    const steps: string[] = [];
    let column: 'primary' | 'supplementary' | 'secondary' = 'secondary';

    for (let press = 0; press < 3; press += 1) {
      const outcome = resolveBack({ activeColumn: column, columnCount: 2, canGoBack: false });
      steps.push(outcome.kind);
      if (outcome.kind === 'step') {
        column = outcome.column;
      }
    }

    assert.deepEqual(steps, ['step', 'step', 'fallThrough']);
    assert.equal(column, 'primary');
  });
});

describe('pane resize', () => {
  it('clamps to the pane bounds in both directions', () => {
    assert.equal(clampPrimaryWidth(10), PRIMARY_WIDTH_MIN);
    assert.equal(clampPrimaryWidth(9999), PRIMARY_WIDTH_MAX);
    assert.equal(clampPrimaryWidth(300), 300);
  });

  it('rounds to whole dp so the pane never lands on a fractional pixel', () => {
    assert.equal(clampPrimaryWidth(300.4), 300);
    assert.equal(clampPrimaryWidth(300.6), 301);
  });

  it('falls back to the minimum for a non-finite width', () => {
    assert.equal(clampPrimaryWidth(Number.NaN), PRIMARY_WIDTH_MIN);
  });

  it('resolves from the drag ORIGIN so overshoot does not have to be paid back', () => {
    // Drag far past the maximum, then come back 40px. Resolving from the origin
    // gives an immediate response; accumulating deltas would still be unwinding
    // the surplus and the pane would appear stuck.
    const origin = 300;
    assert.equal(widthAfterDrag(origin, 5000), PRIMARY_WIDTH_MAX);
    assert.equal(widthAfterDrag(origin, -40), 260);
  });

  it('keeps the token default inside the resizable range', () => {
    assert.equal(clampPrimaryWidth(DEFAULT_PRIMARY_WIDTH), DEFAULT_PRIMARY_WIDTH);
  });
});

describe('pane transition direction', () => {
  it('reads forward going out and back going in, so Back reverses the motion', () => {
    const store = useSplitViewStore;
    store.setState({ column: 'primary', direction: 'forward' });

    store.getState().setColumn('secondary');
    assert.equal(store.getState().direction, 'forward');

    store.getState().setColumn('supplementary');
    assert.equal(store.getState().direction, 'back');

    store.getState().setColumn('primary');
    assert.equal(store.getState().direction, 'back');
  });

  it('treats re-selecting the same column as forward, not a reversal', () => {
    const store = useSplitViewStore;
    store.setState({ column: 'supplementary', direction: 'back' });
    store.getState().setColumn('supplementary');
    assert.equal(store.getState().direction, 'forward');
  });

  it('clamps a stored width through the store, not just at the call site', () => {
    const store = useSplitViewStore;
    store.getState().setPrimaryWidth(99999);
    assert.equal(store.getState().primaryWidth, PRIMARY_WIDTH_MAX);
    store.getState().resetPrimaryWidth();
    assert.equal(store.getState().primaryWidth, null);
  });
});
