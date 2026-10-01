'use client';
import Animated from 'react-native-reanimated';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { css } from './html/css';

/**
 * A scroll view that keeps the focused field above the keyboard.
 *
 * `react-native-keyboard-controller`, never React Native's
 * `KeyboardAvoidingView`: iOS reports a scheduled keyboard animation while
 * modern edge-to-edge Android reports per-frame insets, and RN's component has
 * no per-frame Android primitive — so Android content snaps instead of tracking
 * the keyboard. This library maps both onto one animated value.
 *
 * Wrapped with `createAnimatedComponent` so it can also carry a Reanimated
 * scroll handler — that is what lets a pane have BOTH keyboard avoidance and an
 * auto-hiding header without nesting two scroll views inside each other.
 *
 * Lives in the kit so screens compose it from `@acme/ui` rather than importing
 * the library, matching every other primitive here.
 */
export const KeyboardAwareScroll = css(
  Animated.createAnimatedComponent(KeyboardAwareScrollView),
  'KeyboardAwareScroll',
);
