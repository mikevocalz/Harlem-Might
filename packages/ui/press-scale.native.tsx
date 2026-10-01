'use client';
/**
 * PLATFORM FORK — native press feedback: Legend Motion spring scale.
 * Two layers by design: the outer Motion.Pressable owns the hit area and
 * layout (outerClassName), the inner MotionView carries the visual classes
 * and springs to whileTap. Pass the same alignment class to both when needed.
 */
import { Motion } from '@legendapp/motion';
import { css } from './html/css';
import { MotionView } from './motion';

const CssMotionPressable = css(
  Motion.Pressable as React.ComponentType<object>,
  'Motion.Pressable',
) as React.FC<React.ComponentProps<typeof Motion.Pressable> & { className?: string }>;

export interface PressScaleProps {
  children?: React.ReactNode;
  /** Visual classes — applied to the animated surface. */
  className?: string;
  /** Outer pressable classes (alignment/sizing), e.g. 'self-start' or 'w-full'. */
  outerClassName?: string;
  onPress?: () => void;
  disabled?: boolean;
  role?: string;
  'aria-label'?: string;
  'aria-disabled'?: boolean;
  accessibilityState?: { checked?: boolean; disabled?: boolean; selected?: boolean };
}

export function PressScale({
  children, className, outerClassName, onPress, disabled, role, ...a11y
}: PressScaleProps) {
  return (
    <CssMotionPressable
      role={(role ?? 'button') as never}
      onPress={disabled ? undefined : onPress}
      className={outerClassName}
      {...a11y}
    >
      <MotionView
        className={className}
        whileTap={{ scale: 0.96, opacity: 0.9 }}
        transition={{ type: 'spring', damping: 22, stiffness: 500 }}
      >
        {children}
      </MotionView>
    </CssMotionPressable>
  );
}
