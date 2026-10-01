'use client';
/**
 * Adaptive split view for Android.
 *
 * react-native-screens ships no Android implementation of Split — both
 * `SplitHost.android.tsx` and `SplitScreen.android.tsx` warn and return null,
 * and there is no `split/` package under
 * android/src/main/java/com/swmansion/rnscreens/. So this is an app-layer
 * adaptive layout, not a native bridge.
 *
 * It only has to lay out the authored column children plus one router-driven
 * detail pane: in the iOS API the columns are ordinary JSX and only the
 * trailing pane comes from the router, so no second concurrent <Slot /> is
 * needed.
 */
import { Children, isValidElement, useImperativeHandle, type ReactNode } from 'react';
import { Slot } from 'expo-router';
import { View } from '@acme/ui/tw';
import { Aside, Main, Section } from '@acme/ui/primitives';
import { SafeArea, MotionView } from '@acme/ui';
import { isCollapsed, PANE_WIDTH_CLASS } from './constants';
import { resolvePaneVisibility } from './pane-overrides';
import { CollapsiblePane } from './CollapsiblePane';
import { PANE_WIDTH_DP } from './pane-widths';
import { usePaneOverrideStore } from './pane-overrides.store';
import { useWindowSizeClass } from './use-window-size-class';
import { useSplitViewStore } from './store';
import { useSplitViewBack } from './use-split-view-back';
import { PaneDivider } from './PaneDivider';
import { DEFAULT_PRIMARY_WIDTH } from './resize';
import type { AdaptiveSplitViewProps } from './types';

/**
 * Markers, not renderers. expo-router's Column would render
 * `Split.Column`, whose Android fork returns null — so Android supplies its
 * own, and children are matched by type identity exactly as iOS does.
 */
function SplitViewColumn({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

function SplitViewInspector({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

/**
 * Hairline, not ink. The panes are separated by BACKGROUND VALUE now, and
 * stacking a heavy border on top of that is two devices doing one job — the
 * borders read as division without ranking, which is why the panels had no
 * hierarchy.
 */
const PANE_DIVIDER = 'border-border/15';

/** Entrance travel for a collapsed pane change, in dp. */
const PANE_TRAVEL = 24;

/**
 * Travel for the inspector drawer, in dp. Must clear the pane's own width
 * (w-pane-inspector is 20rem, and metro sets rem:14, so 280) or the drawer
 * would sit half on screen when closed.
 */
const INSPECTOR_TRAVEL = 300;

function SplitViewNavigator({
  children,
  topColumnForCollapsing,
  showInspector,
  ref,
}: AdaptiveSplitViewProps) {
  const sizeClass = useWindowSizeClass();
  const storedColumn = useSplitViewStore((state) => state.column);
  const setColumn = useSplitViewStore((state) => state.setColumn);
  const primaryWidth = useSplitViewStore((state) => state.primaryWidth);
  const direction = useSplitViewStore((state) => state.direction);
  const paneOverrides = usePaneOverrideStore((state) => state.overrides);

  const all = Children.toArray(children);
  const columns = all.filter((child) => isValidElement(child) && child.type === SplitViewColumn);
  const inspectors = all.filter(
    (child) => isValidElement(child) && child.type === SplitViewInspector,
  );

  if (columns.length > 2) {
    throw new Error('There can only be two SplitView.Column in the SplitView.');
  }

  const columnCount: 1 | 2 = columns.length === 2 ? 2 : 1;
  const collapsed = isCollapsed(sizeClass);

  // The store is the live position; the prop only seeds it, so Back never has
  // to write during render. `supplementary` is clamped away when the two-pane
  // shape has no such column to land on.
  const requested = storedColumn ?? topColumnForCollapsing ?? 'primary';
  const activeColumn =
    requested === 'supplementary' && columnCount === 1 ? 'primary' : requested;

  useSplitViewBack({ collapsed, activeColumn, columnCount });

  /**
   * PLATFORM DIVERGENCE — `show(column)`.
   *
   * iOS forwards to UISplitViewController.show(_:), which can reveal a hidden
   * sidebar as an overlay while expanded. Android has no overlay presentation
   * here, so:
   *   - collapsed: swaps the visible pane, matching iOS.
   *   - expanded:  no-op on screen, because every pane the size class allows is
   *                already tiled. The column is still recorded, so a later
   *                collapse lands on the requested pane rather than snapping
   *                back to `topColumnForCollapsing`.
   *
   * Requesting `supplementary` in the two-pane shape is clamped to `primary`
   * at render, since there is no supplementary column to land on.
   */
  useImperativeHandle(ref, () => ({ show: setColumn }), [setColumn]);

  // Same diagnostics as iOS, so a call site misbehaves identically on both.
  if (all.length !== columns.length + inspectors.length) {
    console.warn(
      'Only SplitView.Column and SplitView.Inspector components are allowed as direct children of SplitView.',
    );
  }
  if (columns.length + inspectors.length === 0) {
    console.warn('No SplitView.Column and SplitView.Inspector found in SplitView.');
    return <Slot />;
  }

  // The automatic size-class policy, then any manual override the user set for
  // THIS size class. Precedence and the "never show what cannot fit" guard both
  // live in the reducer, so this stays a lookup.
  const visible = resolvePaneVisibility(sizeClass, columnCount, paneOverrides);
  // Mounted whenever the size class allows one; `showInspector` only decides
  // whether it is slid open. Unmounting it was what made closing unreliable.
  const inspectorPane = visible.inspector ? inspectors[0] : null;
  const inspectorOpen = Boolean(showInspector && inspectorPane);

  if (collapsed) {
    // Keyed on the column so each pane change remounts and replays the entrance.
    // TRANSFORM-ONLY, never opacity-from-0: if the animation stalls the pane
    // must still be readable rather than an invisible screen.
    return (
      <SafeArea edges={['left', 'right']} className="flex-1">
        <MotionView
          key={activeColumn}
          className="flex-1"
          initial={{ x: direction === 'forward' ? PANE_TRAVEL : -PANE_TRAVEL }}
          animate={{ x: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 320 }}
        >
          {activeColumn === 'primary' && columns[0] ? (
            <Aside className="flex-1">{columns[0]}</Aside>
          ) : activeColumn === 'supplementary' && columns[1] ? (
            <Section className="flex-1">{columns[1]}</Section>
          ) : (
            <Main className="flex-1">
              <Slot />
            </Main>
          )}
        </MotionView>
      </SafeArea>
    );
  }

  // The narrow rail is a fixed step, not a resizable pane, so a stored width
  // only applies at the full-width steps.
  const primaryWidthClass = visible.primaryNarrow
    ? PANE_WIDTH_CLASS.primaryNarrow
    : PANE_WIDTH_CLASS.primary;
  const resizedWidth = visible.primaryNarrow ? null : primaryWidth;

  return (
    <SafeArea edges={['left', 'right']} className="flex-1">
      <View className="flex-1 flex-row">
        {/*
          Panes stay MOUNTED and animate to zero width rather than unmounting.
          A conditional mount is a hard cut: the pane vanishes in one frame and
          the detail pane snaps to its new size. Keeping them mounted also
          preserves each pane's scroll position and local state across a
          collapse, which the brief requires.
        */}
        {columns[0] ? (
          <>
            <CollapsiblePane
              open={visible.primary}
              width={
                visible.primaryNarrow
                  ? PANE_WIDTH_DP.primaryNarrow
                  : resizedWidth ?? PANE_WIDTH_DP.primary
              }
            >
              <Aside className="flex-1">{columns[0]}</Aside>
            </CollapsiblePane>
            {visible.primary ? (
              <PaneDivider width={resizedWidth ?? DEFAULT_PRIMARY_WIDTH} />
            ) : null}
          </>
        ) : null}

        {columns[1] ? (
          <CollapsiblePane
            open={visible.supplementary}
            width={PANE_WIDTH_DP.supplementary}
            className={visible.supplementary ? `border-r ${PANE_DIVIDER}` : undefined}
          >
            <Section className="flex-1">{columns[1]}</Section>
          </CollapsiblePane>
        ) : null}

        <Main className="flex-1">
          <Slot />
        </Main>
      </View>

      {/*
        The inspector is a DRAWER, not a fourth column. It overlays the trailing
        edge of the detail pane rather than taking width from it — a tiled
        inspector squeezes the primary content every time it is shown, which is
        the wrong trade for a secondary surface. This also matches UIKit, where
        the inspector is presented over the secondary column rather than tiled
        beside it.
      */}
      {/*
        Legend Motion (never moti) drives the drawer. It stays MOUNTED and
        animates between open and closed instead of being unmounted by
        AnimatePresence — the exit transition did not run reliably through the
        kit's css-wrapped MotionView, which left the panel stuck on screen.
        TRANSFORM-ONLY, never opacity-from-0, so a stalled animation still
        leaves a readable panel. pointerEvents is dropped while closed so the
        parked drawer cannot swallow taps meant for the grid.
      */}
      {inspectorPane ? (
        <MotionView
          pointerEvents={inspectorOpen ? 'auto' : 'none'}
          className={`absolute bottom-0 right-0 top-0 ${PANE_WIDTH_CLASS.inspector} border-l ${PANE_DIVIDER} bg-surface shadow-overlay`}
          animate={{ x: inspectorOpen ? 0 : INSPECTOR_TRAVEL }}
          transition={{ type: 'spring', damping: 32, stiffness: 140, mass: 1.1 }}
        >
          <Aside className="flex-1">{inspectorPane}</Aside>
        </MotionView>
      ) : null}
    </SafeArea>
  );
}

export const SplitView = Object.assign(SplitViewNavigator, {
  Column: SplitViewColumn,
  Inspector: SplitViewInspector,
});

export type { SplitViewProps, SplitNavigableColumn, SplitViewCommands } from './types';
export { useWindowSizeClass, windowSizeClassForWidth } from './use-window-size-class';
export { WINDOW_SIZE_CLASS_MIN_WIDTH_DP, type WindowSizeClass } from './constants';
