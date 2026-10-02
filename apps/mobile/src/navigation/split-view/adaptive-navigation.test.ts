import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveAdaptiveNavigationPlacement } from './adaptive-navigation.ts';

describe('adaptive navigation placement', () => {
  it('uses bottom navigation on compact web', () => {
    assert.deepEqual(
      resolveAdaptiveNavigationPlacement({
        platform: 'web',
        sizeClass: 'compact',
        heightDp: 800,
        folds: [],
        isRTL: false,
      }),
      {
        kind: 'bottom-compact',
        position: 'bottom',
        rail: false,
        expanded: false,
      },
    );
  });

  it('uses a start-edge rail for tablet/desktop web', () => {
    const placement = resolveAdaptiveNavigationPlacement({
      platform: 'web',
      sizeClass: 'large',
      heightDp: 900,
      folds: [],
      isRTL: false,
    });
    assert.equal(placement.kind, 'rail-collapsed');
    assert.equal(placement.position, 'left');
  });

  it('moves the rail to logical start in RTL', () => {
    const placement = resolveAdaptiveNavigationPlacement({
      platform: 'web',
      sizeClass: 'expanded',
      heightDp: 900,
      folds: [],
      isRTL: true,
    });
    assert.equal(placement.position, 'right');
  });

  it('uses bottom navigation in tabletop posture', () => {
    const placement = resolveAdaptiveNavigationPlacement({
      platform: 'web',
      sizeClass: 'expanded',
      heightDp: 700,
      folds: [
        {
          orientation: 'horizontal',
          posture: 'tabletop',
          separating: true,
          x: 0,
          y: 340,
          width: 900,
          height: 20,
        },
      ],
      isRTL: false,
    });
    assert.equal(placement.kind, 'bottom-medium');
  });
});
