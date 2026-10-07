'use client';

import { Link } from 'solito/link';
import { tv } from 'tailwind-variants';
import { cornerCut, cornerCutSm, expanded } from './geometry';

// One visual recipe, two elements. With `href` it navigates and renders <a>
// (solito Link, or a raw <a> for `external`). Without `href` it acts and
// renders <button>. The diagonal cut is the sole ornament.
// The outer element stays unclipped so focus corners and the hover glow sit
// outside the shape. Secondary draws a 1px rail that follows the cut by
// layering two clipped boxes. Proportions measured from NeonBlade's Corner
// Cut Button.
const outer = tv({
  base: 'flex transition-colors duration-fast',
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
      secondary: 'bg-surface text-primary transition-colors duration-fast group-hover:bg-surface-raised',
      ghost: 'text-primary',
    },
    size: {
      md: `h-13 px-8 text-ui ${cornerCut}`,
      sm: `h-10 px-5 text-small ${cornerCutSm}`,
    },
  },
});

const glow =
  'transition-[filter] duration-slow hover:[filter:drop-shadow(0_0_14px_color-mix(in_srgb,var(--color-primary)_40%,transparent))] motion-reduce:transition-none';

interface MightsButtonBaseProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
  className?: string;
  /** Stretch to fill the parent (grid cells, sheets). */
  fill?: boolean;
}

/** Navigates. Renders an `<a>`. */
export interface MightsLinkButtonProps extends MightsButtonBaseProps {
  href: string;
  /** Opens in a new tab with a raw `<a>` instead of the router link. */
  external?: boolean;
  'aria-current'?: 'page' | undefined;
}

/** Acts in place (retry, submit, toggle). Renders a `<button>`. */
export interface MightsActionButtonProps extends MightsButtonBaseProps {
  href?: undefined;
  /** Called on click. Optional for `type="submit"` inside a form. */
  onPress?: () => void;
  /** @default 'button' */
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  /**
   * Makes the button a toggle and sets `aria-pressed`. The caller picks the
   * look per state, e.g. `variant={on ? 'primary' : 'ghost'}`.
   */
  pressed?: boolean;
  /** Only when the visible label is an icon or needs more context. */
  'aria-label'?: string;
}

export type MightsButtonProps = MightsLinkButtonProps | MightsActionButtonProps;

export function MightsButton(props: MightsButtonProps) {
  const { children, variant = 'primary', size = 'md', className, fill } = props;
  const content = (
    <span className={`${outer({ variant, size })} ${fill ? 'w-full' : ''}`}>
      <span className={`${inner({ variant, size })} ${fill ? 'w-full' : ''}`}>{children}</span>
    </span>
  );
  const disabled = props.href === undefined && props.disabled === true;
  const cls = `mights-focus group ${fill ? 'flex w-full' : 'inline-flex shrink-0'} select-none ${
    variant === 'ghost' || disabled ? '' : glow
  } ${className ?? ''}`;

  if (props.href === undefined) {
    return (
      <button
        type={props.type ?? 'button'}
        onClick={props.onPress}
        disabled={props.disabled}
        aria-pressed={props.pressed}
        aria-label={props['aria-label']}
        className={`${cls} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {content}
      </button>
    );
  }
  if (props.external) {
    return (
      <a href={props.href} className={cls} target="_blank" rel="noreferrer" aria-current={props['aria-current']}>
        {content}
      </a>
    );
  }
  return (
    <Link href={props.href} className={cls} aria-current={props['aria-current']}>
      {content}
    </Link>
  );
}
