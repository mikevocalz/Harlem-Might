'use client';
import type { ReactNode } from 'react';
import { MotionView, transitionFor, useReducedMotion } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { TRANSITIONS } from '../navigation/split-view/transitions.ts';
import type { ExplorePaneMode } from './exploreLayout.ts';

/**
 * One Explore side pane. The mode changes the element's style, never its tree
 * position, so a `<SpatialWindow>` inside stays registered across every size
 * class and promotion change (the compact-size unmount bug in the old
 * SplitView's collapsed branch).
 *
 * Width animates (JS-driven, like `CollapsiblePane`) so the map reflows with
 * it; under reduced motion it snaps. Collapsed and promoted panes are hidden
 * from touch and from TalkBack.
 */
export function ExplorePane({
  mode,
  side,
  restingWidth,
  children,
}: {
  mode: ExplorePaneMode;
  side: 'leading' | 'trailing';
  /** Inner width while collapsed, so content doesn't re-wrap as the pane opens. */
  restingWidth: number;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const visible = mode.kind === 'tiled' || mode.kind === 'overlay' || mode.kind === 'screen';
  const width = mode.kind === 'tiled' || mode.kind === 'overlay' ? mode.width : 0;
  const overlay = mode.kind === 'overlay';
  const edge = side === 'leading' ? 'left-0 border-r' : 'right-0 border-l';

  return (
    <MotionView
      animate={{ width }}
      transition={transitionFor(reduceMotion, TRANSITIONS.paneWidth)}
      style={{ flexGrow: mode.kind === 'screen' ? 1 : 0 }}
      className={
        'overflow-hidden bg-surface-raised ' +
        (visible && mode.kind !== 'screen' ? `${edge} border-border-strong ` : '') +
        (overlay ? `absolute bottom-0 top-0 z-20 ${edge}` : '')
      }
    >
      <View
        style={mode.kind === 'screen' ? undefined : { width: width || restingWidth }}
        className="flex-1"
        aria-hidden={!visible}
        importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        {children}
      </View>
    </MotionView>
  );
}
