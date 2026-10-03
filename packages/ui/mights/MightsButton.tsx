'use client';

import { Link } from 'solito/link';
import { tv } from 'tailwind-variants';
import { cornerCut } from './geometry';

// Navigating actions only — these render <a>. The diagonal cut is the sole
// ornament; secondary draws its rail by layering two clipped boxes.
// The <a> stays unclipped so its focus corners can sit outside the shape.
const outer = tv({
  base: `flex ${cornerCut} transition-colors duration-[120ms]`,
  variants: {
    variant: {
      primary: 'bg-primary group-hover:bg-primary-pressed',
      secondary: 'bg-rule-rail p-px',
      ghost: '',
    },
    size: { md: '', sm: '' },
  },
});

const inner = tv({
  base: `flex items-center justify-center whitespace-nowrap font-sans font-semibold ${cornerCut}`,
  variants: {
    variant: {
      primary: 'text-on-primary',
      secondary: 'bg-surface text-text transition-colors duration-[120ms] group-hover:bg-paper',
      ghost: 'text-primary underline-offset-4 group-hover:underline',
    },
    size: {
      md: 'h-12 px-6 text-base',
      sm: 'h-8 px-3.5 text-sm',
    },
  },
  compoundVariants: [{ variant: 'ghost', class: 'px-0' }],
});

export interface MightsButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
  className?: string;
  external?: boolean;
  'aria-current'?: 'page' | undefined;
}

export function MightsButton({
  href,
  children,
  variant = 'primary',
  size = 'md',
  className,
  external,
  ...aria
}: MightsButtonProps) {
  const content = (
    <span className={outer({ variant, size })}>
      <span className={inner({ variant, size })}>{children}</span>
    </span>
  );
  const cls = `mights-focus group inline-flex shrink-0 select-none ${className ?? ''}`;
  if (external) {
    return (
      <a href={href} className={cls} target="_blank" rel="noreferrer" {...aria}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...aria}>
      {content}
    </Link>
  );
}
