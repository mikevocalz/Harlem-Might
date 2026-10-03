'use client';

import { Link } from 'solito/link';
import { tv } from 'tailwind-variants';
import { cornerCut, cornerCutSm, expanded } from './geometry';

// Navigating actions only — these render <a>. The diagonal cut is the sole
// ornament; secondary draws its rail by layering two clipped boxes.
// The <a> stays unclipped so focus corners and the hover glow sit outside the
// shape. Secondary draws a 1px rail that follows the cut by layering two
// clipped boxes. Proportions measured from NeonBlade's Corner Cut Button.
const outer = tv({
  base: 'flex transition-colors duration-[120ms]',
  variants: {
    variant: {
      primary: 'bg-primary group-hover:bg-primary-pressed',
      secondary: 'bg-primary/70 p-px group-hover:bg-primary',
      ghost: 'bg-primary/10 group-hover:bg-primary/20',
    },
    size: { md: cornerCut, sm: cornerCutSm },
  },
});

const inner = tv({
  base: `flex items-center justify-center whitespace-nowrap font-sans font-semibold tracking-[0.01em] ${expanded}`,
  variants: {
    variant: {
      primary: 'text-on-primary',
      secondary: 'bg-surface text-primary transition-colors duration-[120ms] group-hover:bg-surface-raised',
      ghost: 'text-primary',
    },
    size: {
      md: `h-[52px] px-8 text-[15px] ${cornerCut}`,
      sm: `h-10 px-5 text-[14px] ${cornerCutSm}`,
    },
  },
});

const glow =
  'transition-[filter] duration-300 hover:[filter:drop-shadow(0_0_14px_color-mix(in_srgb,var(--color-primary)_40%,transparent))] motion-reduce:transition-none';

export interface MightsButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
  className?: string;
  external?: boolean;
  /** Stretch to fill the parent (grid cells, sheets). */
  fill?: boolean;
  'aria-current'?: 'page' | undefined;
}

export function MightsButton({
  href,
  children,
  variant = 'primary',
  size = 'md',
  className,
  external,
  fill,
  ...aria
}: MightsButtonProps) {
  const content = (
    <span className={`${outer({ variant, size })} ${fill ? 'w-full' : ''}`}>
      <span className={`${inner({ variant, size })} ${fill ? 'w-full' : ''}`}>{children}</span>
    </span>
  );
  const cls = `mights-focus group ${fill ? 'flex w-full' : 'inline-flex shrink-0'} select-none ${variant === 'ghost' ? '' : glow} ${className ?? ''}`;
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
