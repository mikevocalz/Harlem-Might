'use client';
import { useCallback } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  headerProgress,
  nextHeaderOffset,
  snapHeaderOffset,
  SHOWN,
} from './sticky-header.ts';

/** Matches the snap felt in the pane transitions without importing them: the
 *  header settles, it does not spring. */
const SNAP_DURATION_MS = 180;

export interface StickyHeader {
  /** Attach to the scroll view's `onScroll` (needs `scrollEventThrottle={16}`). */
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
  /** Attach to the header's Animated.View. */
  headerStyle: StyleProp<ViewStyle>;
  /** Call from the header's `onLayout` once its height is known. */
  onHeaderLayout: (height: number) => void;
}

/**
 * An auto-hiding header driven entirely on the UI thread.
 *
 * REANIMATED, NOT LEGEND MOTION — deliberately, and this is the boundary the
 * README documents. A scroll-linked header has to update on every frame of the
 * gesture; Legend Motion is built on RN's `Animated` and is driven from JS, so
 * the header would lag the finger under load. Reanimated runs the handler on
 * the UI thread. Legend Motion keeps the declarative state transitions (pane
 * show/hide, chevrons); Reanimated owns anything tied to a scroll or a gesture.
 *
 * The maths lives in `sticky-header.ts` so it is unit-tested away from the UI
 * thread; the worklets below only sequence it.
 */
export function useStickyHeader(): StickyHeader {
  const offset = useSharedValue(SHOWN);
  const headerHeight = useSharedValue(0);
  const lastScrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      // Delta from the previous position, not the absolute offset — see
      // nextHeaderOffset for why that distinction is the whole trick.
      const delta = y - lastScrollY.value;
      lastScrollY.value = y;

      // Bounces past the top would otherwise read as an upward drag and pop the
      // header open while the list is still settling.
      if (y < 0) return;
      offset.value = nextHeaderOffset(offset.value, delta, headerHeight.value);
    },
    onEndDrag: (event) => {
      offset.value = withTiming(
        snapHeaderOffset(offset.value, headerHeight.value, event.contentOffset.y),
        { duration: SNAP_DURATION_MS },
      );
    },
    onMomentumEnd: (event) => {
      offset.value = withTiming(
        snapHeaderOffset(offset.value, headerHeight.value, event.contentOffset.y),
        { duration: SNAP_DURATION_MS },
      );
    },
  });

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
    // Fades as it retracts so the text does not slide under the content edge
    // while still fully opaque.
    opacity: 1 - headerProgress(offset.value, headerHeight.value),
  }));

  const onHeaderLayout = useCallback(
    (height: number) => {
      // Reanimated shared value: writing `.value` IS the API, and the box is
      // stable across renders. The rule reads it as React-owned state.
      // eslint-disable-next-line react-hooks/immutability
      headerHeight.value = height;
    },
    [headerHeight],
  );

  return { scrollHandler, headerStyle: headerStyle as StyleProp<ViewStyle>, onHeaderLayout };
}
