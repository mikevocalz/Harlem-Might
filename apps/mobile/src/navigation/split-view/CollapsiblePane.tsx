'use client';
import { MotionView } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { TRANSITIONS } from './transitions.ts';

export interface CollapsiblePaneProps {
  /** Width in dp when open. */
  width: number;
  open: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * A leading pane that collapses to zero width instead of vanishing.
 *
 * WHY WIDTH AND NOT translateX: sliding the pane out with a native-driven
 * transform would leave its width in the layout, so the detail pane would keep
 * its old size and a blank strip would sit where the pane used to be. The
 * neighbours have to reflow, and only an animated width makes them do it
 * continuously — the detail pane is `flex-1`, so it grows frame by frame as
 * this shrinks.
 *
 * Width is not on React Native's native-driver list, so this animation runs on
 * the JS thread. That is the cost of neighbours reflowing, and it is why this
 * node animates WIDTH AND NOTHING ELSE: mixing a JS-driven property with a
 * native-driven one on a single component is unsupported by RN's Animated, and
 * Legend Motion inherits that constraint.
 *
 * The child keeps its full width on a plain inner View, so text inside the pane
 * does not re-wrap on every frame of the collapse — the pane is clipped rather
 * than reflowed internally.
 */
export function CollapsiblePane({ width, open, children, className }: CollapsiblePaneProps) {
  return (
    <MotionView
      animate={{ width: open ? width : 0 }}
      transition={TRANSITIONS.paneWidth}
      className={`overflow-hidden ${className ?? ''}`}
    >
      {/*
        Clipping only hides a collapsed pane from SIGHT. Its children keep their
        layout inside the clip, so a screen reader still walks them and taps
        still land on them at the pane's old bounds — `describe` reported the
        whole hidden sidebar. Hiding it from the a11y tree and dropping pointer
        events makes "collapsed" mean the same thing to every input method,
        while the subtree stays mounted so scroll position and selection
        survive the collapse.
      */}
      <View
        style={{ width }}
        className="flex-1"
        aria-hidden={!open}
        pointerEvents={open ? 'auto' : 'none'}
      >
        {children}
      </View>
    </MotionView>
  );
}
