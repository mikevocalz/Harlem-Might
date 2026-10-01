import { tv, type VariantProps } from 'tailwind-variants';
import { Text as TWText } from './tw';

/**
 * The type scale steps up with the window, not with the device.
 *
 * A phone-tuned scale on a 1280dp tablet reads as fine print: the same 16px
 * body sits in three times the measure, so the type looks undersized against
 * everything around it. Every step is defined here rather than as `md:` classes
 * sprinkled through screens, so a change lands everywhere at once and screens
 * cannot drift apart.
 *
 * `md` is 768dp — the kit's REGULAR_MIN_WIDTH, where a layout stops being
 * phone-shaped.
 */
const text = tv({
  base: 'font-sans text-text',
  variants: {
    variant: {
      display: 'font-display text-display-md md:text-display-lg',
      title: 'font-display text-2xl font-semibold md:text-3xl',
      heading: 'text-lg font-semibold md:text-xl lg:text-2xl',
      body: 'text-base md:text-lg',
      caption: 'text-sm md:text-base',
      label: 'text-xs font-medium uppercase tracking-wide md:text-sm',
    },
    tone: {
      default: 'text-text',
      muted: 'text-text-muted',
      accent: 'text-accent',
      primary: 'text-primary',
      inverse: 'text-text-inverse',
      danger: 'text-danger',
    },
  },
  defaultVariants: { variant: 'body', tone: 'default' },
});

export interface TextProps
  extends React.ComponentProps<typeof TWText>,
    VariantProps<typeof text> {}

export function Text({ variant, tone, className, ...props }: TextProps) {
  return <TWText className={text({ variant, tone, className })} {...props} />;
}
