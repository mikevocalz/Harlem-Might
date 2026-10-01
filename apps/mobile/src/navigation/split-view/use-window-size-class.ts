'use client';
import { useWindowDimensions } from 'react-native';
import { windowSizeClassForWidth, type WindowSizeClass } from './constants';

export { windowSizeClassForWidth };

/**
 * Size class of the current WINDOW, never the device.
 *
 * `useWindowDimensions` subscribes to the RN dimensions event, so rotation,
 * entering multi-window/split-screen, and unfolding all re-render this hook
 * with the new width. A cached `Dimensions.get('window')` would go stale on
 * exactly those transitions, which is the failure mode Phase 2 guards against.
 *
 * On Android `width` is already density-independent; on iOS it is points.
 * Neither needs PixelRatio.
 */
export function useWindowSizeClass(): WindowSizeClass {
  const { width } = useWindowDimensions();
  return windowSizeClassForWidth(width);
}
