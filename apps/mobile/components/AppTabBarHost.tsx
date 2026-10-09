import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { isHorizonBuild } from '@/src/spatial/horizonBuild';
import { RAIL_WINDOW } from '@/src/spatial/railWindow';
import { useHostedSpatialWindow } from '@/src/spatial/useHostedSpatialWindow';
import { AppTabBar } from './AppTabBar';

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 } as const;

/**
 * Places the tab bar. On a quest build the rail asks for its own window on
 * the main window's start edge (DECISIONS S18); while that window is
 * pending or dropped, and on every other build, the bar or in-window rail
 * draws as before. Nothing is reserved in the main window once the rail
 * window shows.
 */
export function AppTabBarHost({ rail, ...props }: BottomTabBarProps & { rail: boolean }) {
  const placement = useHostedSpatialWindow(
    isHorizonBuild ? RAIL_WINDOW : null,
    <AppTabBar {...props} insets={NO_INSETS} layout="window" />,
  );
  if (placement === 'spatial') return null;
  return <AppTabBar {...props} layout={rail ? 'rail' : 'bar'} />;
}
