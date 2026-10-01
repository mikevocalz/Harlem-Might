import { tv, type VariantProps } from 'tailwind-variants';
import {
  Heading as PrimitiveHeading,
  type HeadingProps as PrimitiveHeadingProps,
} from './primitives';

const heading = tv({
  base: 'font-display text-text',
  variants: {
    // Each size steps up one rung at md — see Text.tsx for why the scale is
    // responsive at the source rather than per screen. display-2xl is already
    // the top of the scale and has nowhere to go.
    size: {
      'display-2xl': 'text-display-2xl',
      'display-xl': 'text-display-xl md:text-display-2xl',
      'display-lg': 'text-display-lg md:text-display-xl',
      'display-md': 'text-display-md md:text-display-lg',
      'display-sm': 'text-display-sm md:text-display-md',
      title: 'text-2xl font-semibold md:text-3xl',
    },
    tone: {
      default: 'text-text',
      muted: 'text-text-muted',
      primary: 'text-primary',
      accent: 'text-accent',
      inverse: 'text-text-inverse',
    },
  },
  defaultVariants: { size: 'display-md', tone: 'default' },
});

export interface HeadingProps
  extends PrimitiveHeadingProps,
    VariantProps<typeof heading> {}

export function Heading({ level = 1, size, tone, className, ...props }: HeadingProps) {
  return (
    <PrimitiveHeading
      level={level}
      className={heading({ size, tone, className })}
      {...props}
    />
  );
}
