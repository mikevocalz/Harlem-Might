'use client';
/**
 * Reusable motion primitives (@legendapp/motion) — universal: RN Animated on
 * native, react-native-web's Animated in the browser.
 *
 * - motion(Component): the custom-components pattern from Legend's docs
 *   (createMotionAnimatedComponent) + the kit's className shim — turn ANY
 *   component into a Motion component in one call. The component must accept
 *   a style prop (and forward refs for the native-driver fast path).
 * - MotionView / MotionText: motion versions of the kit's view/text. They sit
 *   on Animated.View/Animated.Text (ref-forwarding, native-driver capable) —
 *   on web these render the same react-native-web elements the tw wrappers
 *   compile to, and MotionText carries tw.Text's default text color.
 * - FadeIn / ScaleIn / SlideUp: entrance presets components compose; pass
 *   `delay` to stagger. Override any Motion prop as needed.
 */
import { useSyncExternalStore } from 'react';
import {
  Motion,
  AnimatePresence,
  createMotionComponent,
  createMotionAnimatedComponent,
} from '@legendapp/motion';
import { css } from './html/css';

export { Motion, AnimatePresence, createMotionComponent, createMotionAnimatedComponent };

// SSR safety: server HTML must render CONTENT VISIBLE (no opacity-0 initial
// state — if hydration is slow or fails the page would be blank). Presets
// render statically until hydration, then remount WITH the entrance so the
// animation runs. On native and CSR the snapshot is true from the first
// render: animated immediately, no remount. (External-store read, not state.)
const noopSubscribe = () => () => {};
export const useHydrated = () =>
  useSyncExternalStore(noopSubscribe, () => true, () => false);

type CN = { className?: string };

/** Make a className-capable Motion version of any style-accepting component. */
export function motion<P extends object>(
  Component: React.ComponentType<P>,
  displayName = Component.displayName ?? Component.name ?? 'Component',
) {
  const M = createMotionAnimatedComponent(Component as React.ComponentType<{ style?: unknown }>);
  return css(M as React.ComponentType<object>, `Motion(${displayName})`);
}

export type MotionViewProps = React.ComponentProps<typeof Motion.View> & CN;

export const MotionView = css(
  Motion.View as React.ComponentType<object>,
  'Motion.View',
) as React.FC<MotionViewProps>;

export type MotionTextProps = React.ComponentProps<typeof Motion.Text> & CN;

const MotionTextBase = css(Motion.Text as React.ComponentType<object>, 'Motion.Text');

// Parity with tw.Text: the base-layer default color adapts to the theme;
// explicit text-* classes still override.
export const MotionText = ({ className, ...props }: MotionTextProps) => (
  <MotionTextBase className={`text-body-default ${className ?? ''}`} {...props} />
);
MotionText.displayName = 'CSS(Motion.Text)';

export interface MotionPresetProps extends MotionViewProps {
  /** Delay in ms — stagger sibling entrances. */
  delay?: number;
}

/** Soft rise-and-fade entrance — content blocks, empty states, list headers. */
export const FadeIn = ({ delay = 0, ...props }: MotionPresetProps) => {
  const hydrated = useHydrated();
  return (
  <MotionView
    key={hydrated ? 'hydrated' : 'ssr'}
    initial={hydrated ? { y: 12 } : undefined}
    animate={hydrated ? { y: 0 } : undefined}
    transition={{ type: 'timing', duration: 280, ease: 'easeOut', delay }}
    {...props}
  />
  );
};

/** Pop entrance — dialog cards, badges, confirmation moments. */
export const ScaleIn = ({ delay = 0, ...props }: MotionPresetProps) => {
  const hydrated = useHydrated();
  return (
  <MotionView
    key={hydrated ? 'hydrated' : 'ssr'}
    initial={hydrated ? { scale: 0.94 } : undefined}
    animate={hydrated ? { scale: 1 } : undefined}
    transition={{ type: 'spring', damping: 18, stiffness: 260, delay }}
    {...props}
  />
  );
};

/** Docked-surface entrance — toasts, tab-bar accessories, bottom docks. */
export const SlideUp = ({ delay = 0, ...props }: MotionPresetProps) => {
  const hydrated = useHydrated();
  return (
  <MotionView
    key={hydrated ? 'hydrated' : 'ssr'}
    initial={hydrated ? { y: 24 } : undefined}
    animate={hydrated ? { y: 0 } : undefined}
    transition={{ type: 'spring', damping: 20, stiffness: 300, delay }}
    {...props}
  />
  );
};
