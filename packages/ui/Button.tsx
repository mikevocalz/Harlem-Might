'use client';
import { tv, type VariantProps } from 'tailwind-variants';
import { ActivityIndicator } from 'react-native';
import { PressScale } from './press-scale';
import { Text } from './tw';
import { haptics } from './haptics';

// Press feedback: §8 ladder rung 1 — simple active-state opacity/scale via
// NW5 transitions; respects reduced motion (motion-reduce kills transitions).
const button = tv({
  slots: {
    root:
      'shrink-0 flex-row items-center justify-center gap-2 self-start rounded-md border-2 border-border-strong ' +
      'transition-all duration-fast active:translate-x-[3px] active:translate-y-[3px] active:shadow-none ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 ' +
      'motion-reduce:transition-none',
    label: 'whitespace-nowrap font-semibold',
  },
  variants: {
    variant: {
      primary: { root: 'bg-primary shadow-card hover:bg-primary-pressed', label: 'text-on-primary' },
      accent: { root: 'bg-accent shadow-card hover:bg-accent-pressed', label: 'text-on-accent' },
      outline: { root: 'bg-surface-raised shadow-card hover:bg-surface-sunken', label: 'text-text' },
      ghost: { root: 'border-transparent bg-transparent shadow-none hover:bg-surface-sunken active:shadow-none', label: 'text-text' },
      danger: { root: 'bg-danger shadow-card hover:opacity-90', label: 'text-on-danger' },
    },
    // Labels and padding both step up at md. Scaling the label alone would
    // leave the text crowded against a phone-sized box on a tablet, so the
    // control grows with its text.
    size: {
      sm: { root: 'px-4 py-2 md:px-5 md:py-2.5', label: 'text-sm md:text-base' },
      md: { root: 'px-5 py-2.5 md:px-6 md:py-3', label: 'text-sm md:text-base' },
      lg: { root: 'px-6 py-3.5 md:px-8 md:py-4', label: 'text-base md:text-lg' },
    },
    /*
      Unavailable has to READ as unavailable. Opacity alone was not enough: a
      50%-opacity yellow button on a white sheet still looks like a yellow
      button, so a disabled submit invited a tap that did nothing and explained
      nothing. In this design language the hard offset shadow IS the pressable
      affordance, so dropping it — plus a muted fill and label — is what says
      "not yet". The colour cue is deliberately not the only one.
    */
    disabled: {
      true: {
        root: 'border-border bg-surface-sunken shadow-none hover:bg-surface-sunken active:translate-x-0 active:translate-y-0',
        label: 'text-text-muted',
      },
    },
    fullWidth: { true: { root: 'w-full self-auto' } },
  },
  defaultVariants: { variant: 'primary', size: 'md', disabled: false },
});

export interface ButtonProps extends VariantProps<typeof button> {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function Button({
  title, onPress, variant, size, disabled, fullWidth, loading, className, ...a11y
}: ButtonProps) {
  const { root, label } = button({ variant, size, disabled: disabled || loading, fullWidth });
  return (
    <PressScale
      onPress={disabled || loading ? undefined : () => { haptics.tap(); onPress?.(); }}
      aria-disabled={disabled || loading}
      className={root({ className })}
      outerClassName={fullWidth ? 'w-full' : 'self-start'}
      {...a11y}
    >
      {loading ? <ActivityIndicator size="small" /> : null}
      <Text className={label()}>{title}</Text>
    </PressScale>
  );
}
