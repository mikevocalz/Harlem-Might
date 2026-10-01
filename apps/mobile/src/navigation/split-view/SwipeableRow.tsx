'use client';
import { useMemo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { View } from '@acme/ui/tw';
import { haptics } from '@acme/ui/haptics';
import {
  resolveSwipe,
  restingTranslation,
  swipeTranslation,
  type SwipeSide,
} from './swipe-actions.ts';
import { TRANSITIONS } from './transitions.ts';

/** Width of the revealed action area, in dp. */
const ACTION_WIDTH = 88;
const SETTLE_MS = 180;

export interface SwipeableRowProps {
  children: React.ReactNode;
  /** Rendered behind the row, revealed as it slides. */
  actions: React.ReactNode;
  /** Runs on a full swipe, or when a revealed action is tapped. */
  onCommit: () => void;
  side?: SwipeSide;
  rowWidth: number;
}

/**
 * A row that slides aside to reveal actions behind it.
 *
 * REANIMATED + GESTURE HANDLER, not Legend Motion: this is finger-tracking, so
 * it has to run on the UI thread — the same boundary the sticky header sits on.
 *
 * The thresholds live in `swipe-actions.ts` and are unit-tested there; the
 * worklets below only sequence them. Two distinct thresholds matter: the row
 * PARKS open at half the action width so the buttons can be tapped, and only
 * COMMITS past 60% of the row, far enough that peeking at the actions can never
 * fire one by accident.
 *
 * The gesture is memoised because Gesture Handler v2 rebuilds the native
 * handler whenever the object identity changes, which drops an in-flight drag.
 */
export function SwipeableRow({
  children,
  actions,
  onCommit,
  side = 'trailing',
  rowWidth,
}: SwipeableRowProps) {
  const translateX = useSharedValue(0);
  const committed = useSharedValue(false);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Vertical scrolling must win until the drag is clearly horizontal, or
        // the list becomes impossible to scroll over its own rows.
        .activeOffsetX(side === 'trailing' ? [-12, 9999] : [-9999, 12])
        .failOffsetY([-8, 8])
        .onUpdate((event) => {
          translateX.value = swipeTranslation(event.translationX, ACTION_WIDTH, rowWidth, side);
        })
        .onEnd((event) => {
          const outcome = resolveSwipe({
            translation: translateX.value,
            velocity: event.velocityX,
            actionWidth: ACTION_WIDTH,
            rowWidth,
          });

          translateX.value = withTiming(
            restingTranslation(outcome, ACTION_WIDTH, rowWidth, side),
            { duration: SETTLE_MS },
          );

          if (outcome.kind === 'commit' && !committed.value) {
            committed.value = true;
            runOnJS(haptics.selection)();
            runOnJS(onCommit)();
          }
        }),
    [side, rowWidth, onCommit, translateX, committed],
  );

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View className="relative overflow-hidden">
      {/* Behind the row, pinned to the side the actions come from. */}
      <View
        className={`absolute bottom-0 top-0 flex-row items-center ${
          side === 'trailing' ? 'right-0' : 'left-0'
        }`}
        style={{ width: ACTION_WIDTH }}
      >
        {actions}
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

export { ACTION_WIDTH };
