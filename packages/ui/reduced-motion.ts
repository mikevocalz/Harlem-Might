'use client';
import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import { create } from 'zustand';

/**
 * The OS "reduce motion" setting, held once for the whole app.
 *
 * `motion-reduce:` classes only cover CSS transitions. Legend Motion springs,
 * pane width animations and press scales run in JS, so they read this flag
 * and switch to {@linkcode INSTANT_TRANSITION} instead.
 */
interface ReducedMotionState {
  /** True when the user asked the OS to reduce motion. False until the first read resolves. */
  reduceMotion: boolean;
  setReduceMotion: (reduceMotion: boolean) => void;
}

export const useReducedMotionStore = create<ReducedMotionState>((set) => ({
  reduceMotion: false,
  setReduceMotion: (reduceMotion) => set({ reduceMotion }),
}));

/** A transition that lands on its end state in the same frame. */
export const INSTANT_TRANSITION = { type: 'timing', duration: 0 } as const;

/**
 * `transition` unless the user asked to reduce motion, in which case the
 * change is instant. Pure, so it can be used outside React.
 */
export function transitionFor<T>(reduceMotion: boolean, transition: T): T | typeof INSTANT_TRANSITION {
  return reduceMotion ? INSTANT_TRANSITION : transition;
}

let subscribed = false;

/**
 * Reads the OS setting once and follows `reduceMotionChanged` for the life of
 * the app. Idempotent: every caller after the first is a no-op, so any number
 * of components can call {@linkcode useReducedMotion}.
 */
function followSystemReduceMotion() {
  if (subscribed) return;
  subscribed = true;
  const { setReduceMotion } = useReducedMotionStore.getState();
  AccessibilityInfo.isReduceMotionEnabled()
    .then(setReduceMotion)
    .catch((error: unknown) => {
      console.warn(`[reduced-motion] could not read the system setting: ${String(error)}`);
    });
  AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
}

/** True when the user asked the OS to reduce motion. Re-renders when it changes. */
export function useReducedMotion(): boolean {
  useEffect(followSystemReduceMotion, []);
  return useReducedMotionStore((state) => state.reduceMotion);
}
