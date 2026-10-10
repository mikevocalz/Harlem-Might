import { Heading, Paragraph } from '../html';
import { tv } from '../tv';
import { condensed } from './geometry';

// Both render React Native Web text on web, which ships browser-style heading
// and paragraph margins and pre-wrap white space; `my-0 whitespace-normal`
// restores the Tailwind preflight the raw tags had. Margin utilities a caller
// passes still win (they sort after my-0).
const reset = 'my-0 whitespace-normal';

// Type roles on the 1.25 modular scale. Display sizes run Mona Sans at the
// condensed end of wdth; UI sizes stay at normal width. Sentence case only.
const heading = tv({
  base: `${reset} font-sans text-text text-balance`,
  variants: {
    size: {
      marquee: `text-display-lg md:text-display-xl xl:text-display-2xl font-bold ${condensed}`,
      'display-lg': `text-display-sm md:text-display-md xl:text-display-lg font-bold ${condensed}`,
      'display-md': `text-title-lg md:text-display-sm xl:text-display-md font-bold ${condensed}`,
      title: 'text-title md:text-title-lg font-semibold tracking-[-0.005em]',
      card: 'text-card font-semibold',
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
  return (
    <Heading level={level} id={id} className={heading({ size, className })}>
      {children}
    </Heading>
  );
}

const text = tv({
  base: `${reset} font-sans max-w-[75ch] text-pretty`,
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
  return <Paragraph className={text({ size, tone, className })}>{children}</Paragraph>;
}
