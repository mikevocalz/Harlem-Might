'use client';
import { tv, type VariantProps } from './tv';
import { haptics } from './haptics';
import { PressScale } from './press-scale';

// Press feedback: §8 ladder rung 1 — active-state opacity via NW5 transitions;
// motion-reduce kills transitions.
const iconButton = tv({
  base:
    'shrink-0 items-center justify-center self-start rounded-md border-2 border-border-strong transition-all duration-fast ' +
    'active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 ' +
    'motion-reduce:transition-none',
  variants: {
    variant: {
      primary: 'bg-primary shadow-card hover:bg-primary-pressed',
      ghost: 'border-transparent bg-transparent hover:bg-surface-sunken',
      outline: 'bg-surface-raised shadow-card hover:bg-surface-sunken',
    },
    size: {
      sm: 'h-8 w-8',
      md: 'h-10 w-10',
      lg: 'h-12 w-12',
    },
    disabled: { true: 'opacity-50' },
  },
  defaultVariants: { variant: 'primary', size: 'md', disabled: false },
});

export interface IconButtonProps extends VariantProps<typeof iconButton> {
  icon: React.ReactNode;
  'aria-label': string;
  onPress?: () => void;
  className?: string;
}

export function IconButton({
  icon, onPress, variant, size, disabled, className, ...a11y
}: IconButtonProps) {
  return (
    <PressScale
      onPress={disabled ? undefined : () => { haptics.tap(); onPress?.(); }}
      aria-disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      className={iconButton({ variant, size, disabled, className })}
      outerClassName="self-start"
      {...a11y}
    >
      {icon}
    </PressScale>
  );
}
