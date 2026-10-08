import { tv } from '../tv';
import { H1, H2, H3, P } from '../tw';
import type { MightsHeadingProps, MightsText as WebMightsText } from './MightsType';

// Native fork of MightsType.tsx: same props, same size steps, same tokens.
// Width comes from the font file instead of font-stretch (see
// nativeFontFamilies in @acme/theme): `font-display` is Mona Sans Display
// Condensed Bold, `font-sans-semibold` is Mona Sans SemiBold. No weight
// classes on top, or Android synthesises a second bold. text-balance,
// text-pretty and the 75ch measure have no React Native equivalent.
const heading = tv({
  base: 'text-text',
  variants: {
    size: {
      marquee: 'font-display text-display-lg md:text-display-xl xl:text-display-2xl',
      'display-lg': 'font-display text-display-sm md:text-display-md xl:text-display-lg',
      'display-md': 'font-display text-title-lg md:text-display-sm xl:text-display-md',
      title: 'font-sans-semibold text-title md:text-title-lg',
      card: 'font-sans-semibold text-card',
    },
  },
  defaultVariants: { size: 'display-md' },
});

const HEADING_BY_LEVEL = { 1: H1, 2: H2, 3: H3 } as const;

/** Heading with role="heading" and aria-level, sized on the Mights type scale. */
export function MightsHeading({ level = 2, size, className, children, id }: MightsHeadingProps) {
  const Tag = HEADING_BY_LEVEL[level];
  return (
    <Tag nativeID={id} className={heading({ size, className })}>
      {children}
    </Tag>
  );
}

const text = tv({
  base: 'font-sans',
  variants: {
    size: {
      lead: 'text-lead-sm md:text-lead',
      body: 'text-body',
      small: 'text-small',
    },
    tone: { default: 'text-text', muted: 'text-text-muted' },
  },
  defaultVariants: { size: 'body', tone: 'muted' },
});

/** Body copy on the Mights type scale. Same props as the web MightsText. */
export function MightsText({ size, tone, className, children }: Parameters<typeof WebMightsText>[0]) {
  return <P className={text({ size, tone, className })}>{children}</P>;
}
