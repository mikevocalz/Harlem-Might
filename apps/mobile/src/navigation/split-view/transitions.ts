/**
 * Motion tokens for the pane surfaces.
 *
 * Every transition in the split view names one of these. Inline transition
 * literals scattered through components make timing impossible to tune and
 * guarantee drift between panes that are meant to move as one.
 *
 * These are `@legendapp/motion` transition objects, which is RN `Animated`
 * under the hood — see README's animation-boundary section for which surfaces
 * that covers and which belong to Reanimated.
 *
 * Legend Motion's own default is a 300ms tween; nothing here relies on it.
 */
export const TRANSITIONS = {
  /**
   * Pane slide (translateX). Native-driven, so it is safe to run on a node
   * that animates nothing else. Damping is high enough that a pane never
   * overshoots past the screen edge and reveals what is behind it.
   */
  paneSlide: { type: 'spring', damping: 28, stiffness: 260 },

  /**
   * Pane WIDTH (rail <-> sidebar). JS-driven — width is not on RN's native
   * list — so this belongs on a dedicated node. A tween, not a spring: a
   * spring on width makes every neighbouring pane reflow on each frame of the
   * overshoot.
   */
  paneWidth: { type: 'timing', duration: 220, easing: 'easeInOut' },

  /** Content fade/slide inside a pane. Native-driven. */
  paneContent: { type: 'timing', duration: 160, easing: 'easeOut' },

  /** Chevron/disclosure rotation. Native-driven. */
  disclosure: { type: 'timing', duration: 180, easing: 'easeInOut' },

  /** Selection background colour. Interpolated by Legend Motion, JS-driven. */
  selection: { type: 'timing', duration: 140, easing: 'easeOut' },
} as const;

export type TransitionToken = keyof typeof TRANSITIONS;
