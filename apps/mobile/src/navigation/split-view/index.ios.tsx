/**
 * iOS delegates to expo-router's UISplitViewController wrapper untouched.
 *
 * Re-exported rather than wrapped so that `SplitView.Column` keeps its
 * identity: expo-router filters children with `child.type === SplitViewColumn`
 * (expo-router/build/split-view/split-view.js), and any wrapper component here
 * would fail that check and be dropped with a warning.
 */
export { SplitView } from 'expo-router/unstable-split-view';
export type { SplitViewProps, SplitNavigableColumn, SplitViewCommands } from './types';
export { useWindowSizeClass, windowSizeClassForWidth } from './use-window-size-class';
export { WINDOW_SIZE_CLASS_MIN_WIDTH_DP, type WindowSizeClass } from './constants';
