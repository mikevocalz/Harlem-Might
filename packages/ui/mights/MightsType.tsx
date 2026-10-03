import { tv } from 'tailwind-variants';
import { condensed } from './geometry';

// Type roles on the 1.25 modular scale. Display sizes run Mona Sans at the
// condensed end of wdth; UI sizes stay at normal width. Sentence case only.
const heading = tv({
  base: 'font-sans text-text text-balance',
  variants: {
    size: {
      marquee: `text-display-lg md:text-display-xl xl:text-display-2xl font-bold ${condensed}`,
      'display-lg': `text-display-sm md:text-display-md xl:text-display-lg font-bold ${condensed}`,
      'display-md': `text-title-lg md:text-display-sm xl:text-display-md font-bold ${condensed}`,
      title: 'text-title md:text-title-lg font-semibold tracking-[-0.005em]',
      card: 'text-[20px] leading-7 font-semibold',
    },
  },
  defaultVariants: { size: 'display-md' },
});

export interface MightsHeadingProps {
  level?: 1 | 2 | 3;
  size?: 'marquee' | 'display-lg' | 'display-md' | 'title' | 'card';
  className?: string;
  children: React.ReactNode;
  id?: string;
}

export function MightsHeading({ level = 2, size, className, children, id }: MightsHeadingProps) {
  const Tag = `h${level}` as const;
  return (
    <Tag id={id} className={heading({ size, className })}>
      {children}
    </Tag>
  );
}

const text = tv({
  base: 'font-sans max-w-[75ch] text-pretty',
  variants: {
    size: {
      lead: 'text-[18px] leading-7 md:text-lead',
      body: 'text-base leading-7',
      small: 'text-[14px] leading-6',
    },
    tone: { default: 'text-text', muted: 'text-text-muted' },
  },
  defaultVariants: { size: 'body', tone: 'muted' },
});

export function MightsText({
  size,
  tone,
  className,
  children,
}: {
  size?: 'lead' | 'body' | 'small';
  tone?: 'default' | 'muted';
  className?: string;
  children: React.ReactNode;
}) {
  return <p className={text({ size, tone, className })}>{children}</p>;
}
