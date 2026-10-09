'use client';

import { Link } from 'solito/link';
import { Button, Link as Anchor, Text } from '../html';
import { tv } from '../tv';
import { View } from '../tw';
import { cornerCut, cornerCutSm, expanded } from './geometry';

// One visual recipe, two elements. With `href` it navigates and renders <a>
// (solito Link, or the kit anchor for `external`). Without `href` it acts and
// renders <button>. The diagonal cut is the sole ornament.
// The outer element stays unclipped so focus corners and the hover glow sit
// outside the shape. Secondary draws a 1px rail that follows the cut by
// layering two clipped boxes. Proportions measured from NeonBlade's Corner
// Cut Button.
const outer = tv({
  // Kit View: a flex column by default, so the row is explicit.
  base: 'flex flex-row transition-colors duration-fast',
  variants: {
    variant: {
      primary: 'bg-primary group-hover:bg-primary-pressed',
      secondary: 'bg-primary/70 p-px group-hover:bg-primary',
      ghost: 'bg-primary/10 group-hover:bg-primary/20',
      // Quiet toggle at rest: a border-strong rail (3.73:1 on surface, WCAG
      // 1.4.11) instead of ghost's 10% gold fill, which measures 1.06:1.
      outline: 'bg-border-strong p-px group-hover:bg-primary/70',
    },
    size: { md: cornerCut, sm: cornerCutSm, xr: cornerCutSm, 'xr-primary': cornerCut },
  },
});

const inner = tv({
  // Kit Text: the label is a text root, so every font property is set here.
  base: `flex flex-row items-center justify-center whitespace-nowrap font-sans font-semibold tracking-[0.01em] ${expanded}`,
  variants: {
    variant: {
      primary: 'text-on-primary',
      secondary: 'bg-surface text-primary transition-colors duration-fast group-hover:bg-surface-raised',
      ghost: 'text-primary',
      outline: 'bg-surface text-text transition-colors duration-fast group-hover:bg-surface-raised',
    },
    size: {
      md: `h-13 px-8 text-ui ${cornerCut}`,
      sm: `h-10 px-5 text-small ${cornerCutSm}`,
      xr: `h-target min-w-target px-5 text-xr-label ${cornerCutSm}`,
      'xr-primary': `h-target-primary min-w-target-primary px-6 text-xr-body ${cornerCut}`,
    },
  },
});

const glow =
  'transition-[filter] duration-slow hover:[filter:drop-shadow(0_0_14px_color-mix(in_srgb,var(--color-primary)_40%,transparent))] motion-reduce:transition-none';

interface MightsButtonBaseProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  /**
   * `xr` (48dp) and `xr-primary` (60dp) are the Horizon sizes: Meta's minimum
   * target and its hand-tracking size for primary actions, in absolute px so
   * the native rem polyfill cannot shrink them.
   * @default 'md'
   */
  size?: 'md' | 'sm' | 'xr' | 'xr-primary';
  className?: string;
  /** Stretch to fill the parent (grid cells, sheets). */
  fill?: boolean;
}

/** Navigates. Renders an `<a>`. */
export interface MightsLinkButtonProps extends MightsButtonBaseProps {
  href: string;
  /** Opens in a new tab with the kit anchor instead of the router link. */
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
    <View className={`${outer({ variant, size })} ${fill ? 'w-full' : ''}`}>
      <Text className={`${inner({ variant, size })} ${fill ? 'w-full' : ''}`}>{children}</Text>
    </View>
  );
  const disabled = props.href === undefined && props.disabled === true;
  const cls = `mights-focus group ${fill ? 'flex w-full' : 'inline-flex shrink-0'} select-none ${
    variant === 'ghost' || variant === 'outline' || disabled ? '' : glow
  } ${className ?? ''}`;

  if (props.href === undefined) {
    return (
      <Button
        type={props.type ?? 'button'}
        onPress={props.onPress}
        disabled={props.disabled}
        aria-pressed={props.pressed}
        aria-label={props['aria-label']}
        className={`${cls} flex-row disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {content}
      </Button>
    );
  }
  if (props.external) {
    return (
      <Anchor
        href={props.href}
        className={`${cls} flex-row`}
        target="_blank"
        rel="noreferrer"
        aria-current={props['aria-current']}
      >
        {content}
      </Anchor>
    );
  }
  return (
    <Link href={props.href} className={cls} aria-current={props['aria-current']}>
      {content}
    </Link>
  );
}
