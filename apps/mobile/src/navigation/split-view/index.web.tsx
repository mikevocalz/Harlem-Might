'use client';

import {
  Children,
  isValidElement,
  useImperativeHandle,
  type ReactNode,
} from 'react';
import { I18nManager, useWindowDimensions } from 'react-native';
import { Slot } from 'expo-router';
import { Aside, Main, Section } from '@acme/ui/primitives';
import { MotionView, SafeArea } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { isCollapsed } from './constants';
import {
  resolveTrailingInspectorLayout,
  resolveVerticalFoldPanePlan,
  resolveVerticalMultiFoldPanePlan,
} from './fold-layout';
import { PANE_WIDTH_DP } from './pane-widths';
import { resolvePaneVisibility } from './pane-overrides';
import { usePaneOverrideStore } from './pane-overrides.store';
import { useSplitViewStore } from './store';
import { useSplitViewBack } from './use-split-view-back';
import { useWindowSizeClass } from './use-window-size-class';
import { useFoldLayouts } from './use-fold-layout.web';
import type { AdaptiveSplitViewProps } from './types';

function SplitViewColumn({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

function SplitViewInspector({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

const PANE_TRAVEL = 24;
const DETAIL_MIN = 280;
const PANE_MIN = 180;

function SplitViewNavigator({
  children,
  topColumnForCollapsing,
  showInspector,
  ref,
}: AdaptiveSplitViewProps) {
  const { width: rowWidth } = useWindowDimensions();
  const sizeClass = useWindowSizeClass();
  const folds = useFoldLayouts();

  const storedColumn = useSplitViewStore((state) => state.column);
  const setColumn = useSplitViewStore((state) => state.setColumn);
  const primaryStoredWidth = useSplitViewStore((state) => state.primaryWidth);
  const direction = useSplitViewStore((state) => state.direction);
  const paneOverrides = usePaneOverrideStore((state) => state.overrides);

  const all = Children.toArray(children);
  const columns = all.filter(
    (child) => isValidElement(child) && child.type === SplitViewColumn,
  );
  const inspectors = all.filter(
    (child) => isValidElement(child) && child.type === SplitViewInspector,
  );

  if (columns.length > 2) {
    throw new Error('There can only be two SplitView.Column in the SplitView.');
  }

  const columnCount: 1 | 2 = columns.length === 2 ? 2 : 1;
  const collapsed = isCollapsed(sizeClass);
  const requested = storedColumn ?? topColumnForCollapsing ?? 'primary';
  const activeColumn =
    requested === 'supplementary' && columnCount === 1 ? 'primary' : requested;

  useSplitViewBack({ collapsed, activeColumn, columnCount });
  useImperativeHandle(ref, () => ({ show: setColumn }), [setColumn]);

  if (all.length !== columns.length + inspectors.length) {
    console.warn(
      'Only SplitView.Column and SplitView.Inspector components are allowed as direct children of SplitView.',
    );
  }

  if (columns.length + inspectors.length === 0) {
    return <Slot />;
  }

  if (collapsed) {
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

  const visible = resolvePaneVisibility(sizeClass, columnCount, paneOverrides);
  const primaryWidth = visible.primaryNarrow
    ? PANE_WIDTH_DP.primaryNarrow
    : primaryStoredWidth ?? PANE_WIDTH_DP.primary;
  const supplementaryWidth = PANE_WIDTH_DP.supplementary;

  const multiFoldPlan = resolveVerticalMultiFoldPanePlan({
    folds,
    rowWidth,
    primaryVisible: Boolean(columns[0] && visible.primary),
    supplementaryVisible: Boolean(columns[1] && visible.supplementary),
    detailVisible: true,
    primaryWidth,
    supplementaryWidth,
    detailMinWidth: DETAIL_MIN,
    paneMinWidth: PANE_MIN,
  });

  const primaryVerticalFold =
    folds.find((fold) => fold.separating && fold.orientation === 'vertical') ?? null;

  const foldPlan = multiFoldPlan
    ? null
    : resolveVerticalFoldPanePlan({
        fold: primaryVerticalFold,
        rowWidth,
        primaryVisible: Boolean(columns[0] && visible.primary),
        supplementaryVisible: Boolean(columns[1] && visible.supplementary),
        detailVisible: true,
        primaryWidth,
        supplementaryWidth,
        detailMinWidth: DETAIL_MIN,
        paneMinWidth: PANE_MIN,
      });

  const effectivePrimaryWidth =
    multiFoldPlan?.primaryWidth ?? foldPlan?.primaryWidth ?? primaryWidth;
  const effectiveSupplementaryWidth =
    multiFoldPlan?.supplementaryWidth ??
    foldPlan?.supplementaryWidth ??
    supplementaryWidth;

  const gapAfterPrimary =
    multiFoldPlan?.gapAfterPrimary ??
    (foldPlan?.splitAfter === 'primary' ? foldPlan.gapWidth : 0);
  const gapAfterSupplementary =
    multiFoldPlan?.gapAfterSupplementary ??
    (foldPlan?.splitAfter === 'supplementary' ? foldPlan.gapWidth : 0);

  const inspectorPane = inspectors[0] ?? null;
  const inspectorOpen = Boolean(
    showInspector && inspectorPane && visible.inspector,
  );
  const inspector = resolveTrailingInspectorLayout({
    folds,
    rowWidth,
    preferredWidth: PANE_WIDTH_DP.inspector,
    isRTL: I18nManager.isRTL,
  });

  return (
    <SafeArea edges={['left', 'right']} className="flex-1">
      <View className="relative flex-1 flex-row">
        {columns[0] ? (
          <MotionView
            animate={{ width: visible.primary ? effectivePrimaryWidth : 0 }}
            className="overflow-hidden border-r border-border/60"
          >
            <View
              style={{ width: effectivePrimaryWidth }}
              className="flex-1"
              aria-hidden={!visible.primary}
              pointerEvents={visible.primary ? 'auto' : 'none'}
            >
              <Aside className="flex-1">{columns[0]}</Aside>
            </View>
          </MotionView>
        ) : null}

        {gapAfterPrimary > 0 ? (
          <View
            pointerEvents="none"
            aria-hidden
            style={{ width: gapAfterPrimary }}
            className="h-full shrink-0 bg-surface-sunken"
          />
        ) : null}

        {columns[1] ? (
          <MotionView
            animate={{
              width: visible.supplementary ? effectiveSupplementaryWidth : 0,
            }}
            className="overflow-hidden border-r border-border/60"
          >
            <View
              style={{ width: effectiveSupplementaryWidth }}
              className="flex-1"
              aria-hidden={!visible.supplementary}
              pointerEvents={visible.supplementary ? 'auto' : 'none'}
            >
              <Section className="flex-1">{columns[1]}</Section>
            </View>
          </MotionView>
        ) : null}

        {gapAfterSupplementary > 0 ? (
          <View
            pointerEvents="none"
            aria-hidden
            style={{ width: gapAfterSupplementary }}
            className="h-full shrink-0 bg-surface-sunken"
          />
        ) : null}

        <Main className="min-w-0 flex-1">
          <Slot />
        </Main>

        {inspectorPane ? (
          <MotionView
            pointerEvents={inspectorOpen ? 'auto' : 'none'}
            aria-hidden={!inspectorOpen}
            style={{
              width: inspector.width,
              [inspector.edge]: 0,
            }}
            className="absolute bottom-0 top-0 border-l border-border/70 bg-surface-raised shadow-overlay"
            animate={{ x: inspectorOpen ? 0 : inspector.closedX }}
            transition={{
              type: 'spring',
              damping: 32,
              stiffness: 140,
              mass: 1.1,
            }}
          >
            <Aside className="flex-1">{inspectorPane}</Aside>
          </MotionView>
        ) : null}
      </View>
    </SafeArea>
  );
}

export const SplitView = Object.assign(SplitViewNavigator, {
  Column: SplitViewColumn,
  Inspector: SplitViewInspector,
});

export type {
  SplitViewProps,
  SplitNavigableColumn,
  SplitViewCommands,
} from './types';
export {
  useWindowSizeClass,
  windowSizeClassForWidth,
} from './use-window-size-class';
export {
  WINDOW_SIZE_CLASS_MIN_WIDTH_DP,
  type WindowSizeClass,
} from './constants';
export { useDevicePosture, useFoldLayouts, useWebFoldSnapshot } from './use-fold-layout.web';
export { resolveAdaptiveNavigationPlacement } from './adaptive-navigation';
