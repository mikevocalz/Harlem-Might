'use client';
import { useMemo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { EventDragProps } from './event-drag.web';

export type { EventDragProps } from './event-drag.web';

/**
 * Drag-to-reschedule (native).
 *
 * Uses react-native-gesture-handler, NOT expo-drag-drop-content-view — the
 * latter is OS-level content drag-and-drop for moving files across app
 * boundaries (what DropZone uses) and cannot reposition a view in our own UI.
 *
 * SMOOTHNESS, and why the first version was not:
 *
 *  - The gesture is `useMemo`'d. Gesture Handler v2 re-attaches the recognizer
 *    whenever the gesture object identity changes, so an un-memoised
 *    `Gesture.Pan()` rebuilt on every render tore itself down mid-drag.
 *  - The drag drives a Reanimated shared value on the UI thread. The previous
 *    version used `.runOnJS(true)` and wrote the Zustand store on every frame,
 *    which re-rendered the whole grid per pointer move — that is the jank.
 *  - The store is written exactly ONCE, on release, via `scheduleOnRN`. Gesture
 *    callbacks are workletized when Reanimated is installed, so calling a
 *    JS-thread function straight from one crashes; `scheduleOnRN` is the bridge.
 *
 * This wrapper owns the block's absolute position so the animated transform has
 * something to move. EventBlock fills it (`absolute inset-0`) rather than
 * positioning itself — a plain wrapper would become the containing block and
 * break the absolute layout.
 */
export function EventDrag({
  children,
  top,
  height,
  left,
  width,
  onCommit,
  snapPx,
  enabled = true,
}: EventDragProps) {
  const offsetY = useSharedValue(0);
  const startY = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        // A vertical drag must travel before it wins, so a tap still selects
        // and the surrounding grid can still scroll.
        .activeOffsetY([-8, 8])
        .onBegin(() => {
          startY.value = offsetY.value;
        })
        .onUpdate((event) => {
          // Follow the finger CONTINUOUSLY. Quantising here made the block
          // teleport between 15-minute steps, which reads as jumping — the
          // snap belongs on release, not during the drag.
          offsetY.value = startY.value + event.translationY;
        })
        .onEnd(() => {
          // Settle onto the 15-minute grid with a spring so the block eases
          // into its slot instead of snapping instantly, then hand the final
          // offset to JS. The store re-renders `top` to the committed time and
          // the transform returns to zero, so this must not double-count.
          const settled = snapPx > 0 ? Math.round(offsetY.value / snapPx) * snapPx : offsetY.value;
          scheduleOnRN(onCommit, settled);
          offsetY.value = withSpring(0, { damping: 30, stiffness: 220 });
        }),
    [enabled, onCommit, snapPx, offsetY, startY],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offsetY.value }],
  }));

  // Memoised so the style array identity does not change on every render,
  // which would make Reanimated re-apply the whole style each pass.
  const baseStyle = useMemo(
    () => ({ position: 'absolute' as const, top, height, left, width }),
    [top, height, left, width],
  );

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[baseStyle, animatedStyle]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
