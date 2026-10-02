import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  foldsFromViewportSegments,
  resolveTrailingInspectorLayout,
  resolveVerticalFoldPanePlan,
  resolveVerticalMultiFoldPanePlan,
} from './fold-layout.ts';

describe('web viewport segment folding', () => {
  it('turns two side-by-side segments into a vertical book fold', () => {
    const folds = foldsFromViewportSegments(
      [
        { x: 0, y: 0, width: 500, height: 800 },
        { x: 520, y: 0, width: 500, height: 800 },
      ],
      'folded',
    );

    assert.deepEqual(folds, [
      {
        orientation: 'vertical',
        posture: 'book',
        separating: true,
        x: 500,
        y: 0,
        width: 20,
        height: 800,
      },
    ]);
  });

  it('preserves both hinges on a three-segment viewport', () => {
    const folds = foldsFromViewportSegments(
      [
        { x: 0, y: 0, width: 380, height: 800 },
        { x: 390, y: 0, width: 380, height: 800 },
        { x: 780, y: 0, width: 380, height: 800 },
      ],
      'folded',
    );

    assert.equal(folds.length, 2);
    assert.equal(folds[0]?.x, 380);
    assert.equal(folds[1]?.x, 770);
  });

  it('recognizes stacked segments as tabletop posture', () => {
    const folds = foldsFromViewportSegments(
      [
        { x: 0, y: 0, width: 800, height: 380 },
        { x: 0, y: 400, width: 800, height: 380 },
      ],
      'folded',
    );

    assert.equal(folds[0]?.orientation, 'horizontal');
    assert.equal(folds[0]?.posture, 'tabletop');
    assert.equal(folds[0]?.height, 20);
  });

  it('snaps the map/detail boundary to a single vertical fold', () => {
    const plan = resolveVerticalFoldPanePlan({
      fold: {
        orientation: 'vertical',
        posture: 'book',
        separating: true,
        x: 620,
        y: 0,
        width: 20,
        height: 800,
      },
      rowWidth: 1240,
      primaryVisible: true,
      supplementaryVisible: true,
      detailVisible: true,
      primaryWidth: 280,
      supplementaryWidth: 294,
      detailMinWidth: 280,
      paneMinWidth: 180,
    });

    assert.equal(plan?.splitAfter, 'supplementary');
    assert.equal(plan?.gapWidth, 20);
  });

  it('maps three authored panes to three physical regions on a trifold', () => {
    const plan = resolveVerticalMultiFoldPanePlan({
      folds: [
        {
          orientation: 'vertical',
          posture: 'book',
          separating: true,
          x: 380,
          y: 0,
          width: 10,
          height: 800,
        },
        {
          orientation: 'vertical',
          posture: 'book',
          separating: true,
          x: 770,
          y: 0,
          width: 10,
          height: 800,
        },
      ],
      rowWidth: 1160,
      primaryVisible: true,
      supplementaryVisible: true,
      detailVisible: true,
      primaryWidth: 280,
      supplementaryWidth: 294,
      detailMinWidth: 280,
      paneMinWidth: 180,
    });

    assert.deepEqual(plan, {
      primaryWidth: 380,
      supplementaryWidth: 380,
      gapAfterPrimary: 10,
      gapAfterSupplementary: 10,
    });
  });

  it('caps the inspector to the trailing physical segment', () => {
    const layout = resolveTrailingInspectorLayout({
      folds: [
        {
          orientation: 'vertical',
          posture: 'book',
          separating: true,
          x: 600,
          y: 0,
          width: 20,
          height: 800,
        },
      ],
      rowWidth: 1000,
      preferredWidth: 420,
      isRTL: false,
    });

    assert.equal(layout.width, 380);
    assert.equal(layout.edge, 'right');
  });
});
