'use client';
import { useState } from 'react';
import { tv } from '../tv';
import { Text, View } from '../tw';
import type { MightsButtonProps } from './MightsButton';
import { CORNER_CUT, cornerCutPath } from './geometry.native';
import { MightsShape, PressableLink, PressableSurface, useLayoutSize, useMightsColors, type MightsColors, type ShapeLayer } from './MightsShape.native';

// Native fork of MightsButton.tsx: same props, same recipe. The diagonal cut
// is drawn with react-native-svg behind the label (no clip-path on native);
// secondary and outline draw their 1px rail as an outer path plus a path
// inset by 1dp. Hover becomes the pressed state. Labels use Mona Sans
// SemiExpanded SemiBold (`font-ui`), the static twin of the web's
// font-stretch 112.5%.

type Variant = NonNullable<MightsButtonProps['variant']>;
type Size = NonNullable<MightsButtonProps['size']>;

const box = tv({
  base: 'relative flex-row items-center justify-center',
  variants: {
    size: {
      md: 'h-13 px-8',
      sm: 'h-10 px-5',
      xr: 'h-target min-w-target px-5',
      'xr-primary': 'h-target-primary min-w-target-primary px-6',
    },
  },
});

const label = tv({
  base: 'font-ui tracking-[0.01em]',
  variants: {
    variant: {
      primary: 'text-on-primary',
      secondary: 'text-primary',
      ghost: 'text-primary',
      outline: 'text-text',
    },
    size: { md: 'text-ui', sm: 'text-small', xr: 'text-xr-label', 'xr-primary': 'text-xr-body' },
  },
});

// Web: hover/pressed states of `outer` and `inner` in MightsButton.tsx.
function layersFor(variant: Variant, pressed: boolean, c: MightsColors): ShapeLayer[] {
  switch (variant) {
    case 'primary':
      return [{ inset: 0, color: pressed ? c.primaryPressed : c.primary }];
    case 'secondary':
      return [
        { inset: 0, color: c.primary, opacity: pressed ? 1 : 0.7 },
        { inset: 1, color: pressed ? c.surfaceRaised : c.surface },
      ];
    case 'ghost':
      return [{ inset: 0, color: c.primary, opacity: pressed ? 0.2 : 0.1 }];
    case 'outline':
      return [
        pressed ? { inset: 0, color: c.primary, opacity: 0.7 } : { inset: 0, color: c.borderStrong },
        { inset: 1, color: pressed ? c.surfaceRaised : c.surface },
      ];
  }
}

// sm is 40dp tall; the slop brings its touch target to 48dp.
const HIT_SLOP: Record<Size, { top: number; bottom: number } | undefined> = {
  md: undefined,
  sm: { top: 4, bottom: 4 },
  xr: undefined,
  'xr-primary': undefined,
};

/**
 * Cut-corner button. With `href` it navigates through solito's `Link`, which
 * also opens absolute URLs (`external`) in the system browser. Without `href`
 * it acts. `type` is accepted for parity with the web form button and has no
 * effect.
 */
export function MightsButton(props: MightsButtonProps) {
  if (props.href === undefined) {
    return (
      <ButtonFrame
        {...props}
        href={undefined}
        onPress={props.onPress}
        disabled={props.disabled === true}
        selected={props.pressed}
        accessibilityLabel={props['aria-label']}
      />
    );
  }
  return <ButtonFrame {...props} disabled={false} selected={props['aria-current'] === 'page'} />;
}

function ButtonFrame({
  children,
  variant = 'primary',
  size = 'md',
  className,
  fill,
  href,
  onPress,
  disabled,
  selected,
  accessibilityLabel,
}: Pick<MightsButtonProps, 'children' | 'variant' | 'size' | 'className' | 'fill'> & {
  /** Navigates through solito when set; otherwise the button calls `onPress`. */
  href: string | undefined;
  onPress?: () => void;
  disabled: boolean;
  selected: boolean | undefined;
  accessibilityLabel?: string;
}) {
  const colors = useMightsColors();
  const [layout, onLayout] = useLayoutSize();
  const [isPressed, setPressed] = useState(false);
  const cut = CORNER_CUT[size];
  const content =
    typeof children === 'string' || typeof children === 'number' ? (
      <Text numberOfLines={1} className={label({ variant, size })}>
        {children}
      </Text>
    ) : (
      children
    );
  const body = (
    <View onLayout={onLayout} className={box({ size })}>
      <MightsShape
        size={layout}
        path={(s, inset) => cornerCutPath(s, cut, inset)}
        layers={layersFor(variant, isPressed && !disabled, colors)}
      />
      {content}
    </View>
  );
  const press = {
    onPressIn: () => setPressed(true),
    onPressOut: () => setPressed(false),
    hitSlop: HIT_SLOP[size],
    accessibilityLabel,
    accessibilityState: { disabled, selected },
    className: `${fill ? 'w-full' : 'self-start'} ${disabled ? 'opacity-50' : ''} ${className ?? ''}`,
  };

  if (href !== undefined) {
    return (
      <PressableLink href={href} {...press}>
        {body}
      </PressableLink>
    );
  }
  return (
    <PressableSurface role="button" onPress={onPress} disabled={disabled} {...press}>
      {body}
    </PressableSurface>
  );
}
