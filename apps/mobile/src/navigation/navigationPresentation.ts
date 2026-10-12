export interface NavigationDevice {
  isHorizon: boolean;
  isSpatial?: boolean;
  isFoldable: boolean;
  isTablet: boolean;
  hardwareColumnWidth: number;
}

/** Device family owns navigation. A narrow foldable remains a foldable. */
export function navigationPresentation(device: NavigationDevice) {
  if (device.isHorizon || device.isSpatial) return { rail: true, position: 'left' as const };
  const rail = device.isFoldable || device.isTablet || device.hardwareColumnWidth > 0;
  return { rail, position: rail ? 'right' as const : 'bottom' as const };
}

export function tabBarPositionForDirection(position: 'left' | 'right' | 'bottom', isRTL: boolean) {
  if (position === 'bottom' || !isRTL) return position;
  return position === 'left' ? 'right' : 'left';
}

export function navigationRailStyle({ position, isRTL, insets, hardwareColumnWidth, railWidth }: {
  position: 'left' | 'right';
  isRTL: boolean;
  insets: { left: number; right: number };
  hardwareColumnWidth: number;
  railWidth: number;
}) {
  const column = position === 'right' ? hardwareColumnWidth : 0;
  const inset = column ? 0 : insets[position];
  const atStart = tabBarPositionForDirection(position, isRTL) === 'left';
  return {
    width: column || railWidth + inset,
    paddingStart: atStart ? inset : 0,
    paddingEnd: atStart ? 0 : inset,
    borderStartWidth: atStart ? 0 : 1,
    borderEndWidth: atStart ? 1 : 0,
  };
}
