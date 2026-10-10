'use client';
import { useState } from 'react';
import { View } from '../tw';
import type { MightsNotchCardProps } from './MightsNotchCard';
import { notchPath } from './geometry.native';
import { MightsShape, PressableLink, useLayoutSize, useMightsColors } from './MightsShape.native';

// Native fork of MightsNotchCard.tsx: same props. The silhouette is two SVG
// paths: the outer one is the 2dp rail (rule-rail at rest, accent when live),
// the inner one, inset by the rail, is the surface-raised fill. React Native
// cannot clip children to a path, so content sits inside the rail and clear of
// the 8dp notches (pt-2.5/pb-2.5 = rail + notch). Content that paints its own
// background to the edge will cover the bottom-right cut; give such content
// its own inset via `innerClassName`. The web's hover beam becomes a primary rail while pressed.

const RAIL = 2;

/** The notched, cut-corner card. With `href` the whole card is one link. */
export function MightsNotchCard({
  href,
  children,
  className = '',
  innerClassName = '',
  state = 'rest',
  tone = 'raised',
  label,
}: MightsNotchCardProps) {
  if (!href) {
    return (
      <CardBody className={className} innerClassName={innerClassName} state={state} tone={tone} pressed={false}>
        {children}
      </CardBody>
    );
  }
  return (
    <CardLink href={href} label={label} className={className} innerClassName={innerClassName} state={state} tone={tone}>
      {children}
    </CardLink>
  );
}

function CardLink({
  href,
  label,
  className,
  innerClassName,
  state,
  tone,
  children,
}: Required<Pick<MightsNotchCardProps, 'href' | 'className' | 'innerClassName' | 'state' | 'tone'>> &
  Pick<MightsNotchCardProps, 'label' | 'children'>) {
  const [pressed, setPressed] = useState(false);
  return (
    <PressableLink
      href={href}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={label}
      className={`flex-col ${className}`}
    >
      <CardBody className="flex-1" innerClassName={innerClassName} state={state} tone={tone} pressed={pressed}>
        {children}
      </CardBody>
    </PressableLink>
  );
}

function CardBody({
  className,
  innerClassName,
  state,
  tone,
  pressed,
  children,
}: {
  className: string;
  innerClassName: string;
  state: NonNullable<MightsNotchCardProps['state']>;
  tone: NonNullable<MightsNotchCardProps['tone']>;
  pressed: boolean;
  children: React.ReactNode;
}) {
  const colors = useMightsColors();
  const [size, onLayout] = useLayoutSize();
  const rail = state === 'live' ? colors.accent : pressed ? colors.primary : colors.ruleRail;
  return (
    <View onLayout={onLayout} className={`relative flex-col ${className}`}>
      <MightsShape
        size={size}
        path={notchPath}
        layers={[
          { inset: 0, color: rail },
          { inset: RAIL, color: tone === 'inverted' ? colors.primary : colors.surfaceRaised },
        ]}
      />
      <View className={`flex-1 flex-col p-rail pt-2.5 pb-2.5 ${innerClassName}`}>{children}</View>
    </View>
  );
}
