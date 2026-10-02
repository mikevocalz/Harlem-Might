import type { FoldLayout } from './fold-layout';
import type { WindowSizeClass } from './constants';

export type AdaptiveNavigationKind =
  | 'bottom-compact'
  | 'bottom-medium'
  | 'rail-collapsed'
  | 'rail-expanded'
  | 'apple-sidebar';

export interface AdaptiveNavigationPlacement {
  kind: AdaptiveNavigationKind;
  position: 'bottom' | 'left' | 'right';
  rail: boolean;
  expanded: boolean;
}

/**
 * The same responsive navigation decision can be used by native and web.
 * Android/Web follow the Material adaptive rail policy; iPad/web-on-Apple can
 * opt into the Apple sidebar branch at the shell level.
 */
export function resolveAdaptiveNavigationPlacement(input: {
  platform: 'android' | 'ios' | 'web';
  sizeClass: WindowSizeClass;
  heightDp: number;
  folds: readonly FoldLayout[];
  isRTL: boolean;
}): AdaptiveNavigationPlacement {
  const { platform, sizeClass, heightDp, folds, isRTL } = input;
  const start: 'left' | 'right' = isRTL ? 'right' : 'left';
  const tabletop = folds.some((fold) => fold.posture === 'tabletop');

  if (platform === 'ios') {
    if (sizeClass === 'compact') {
      return {
        kind: 'bottom-compact',
        position: 'bottom',
        rail: false,
        expanded: false,
      };
    }

    return {
      kind: 'apple-sidebar',
      position: start,
      rail: true,
      expanded: sizeClass === 'extraLarge',
    };
  }

  if (sizeClass === 'compact') {
    return {
      kind: 'bottom-compact',
      position: 'bottom',
      rail: false,
      expanded: false,
    };
  }

  if (tabletop || heightDp < 480) {
    return {
      kind: 'bottom-medium',
      position: 'bottom',
      rail: false,
      expanded: false,
    };
  }

  const expanded = sizeClass === 'extraLarge';
  return {
    kind: expanded ? 'rail-expanded' : 'rail-collapsed',
    position: start,
    rail: true,
    expanded,
  };
}
