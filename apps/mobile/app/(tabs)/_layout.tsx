import { useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { AppTabBarHost } from '@/components/AppTabBarHost';
import { APP_TABS, TAB_SCREEN } from '@/src/site/app-tabs';

/**
 * Material's navigation rail threshold. Below 600dp the bar sits at the bottom;
 * from medium up (tablets, unfolded foldables, the 1280dp Horizon window) it
 * moves to the leading edge as a rail.
 */
const RAIL_MIN_WIDTH = 600;

export const unstable_settings = { initialRouteName: 'explore' };

/**
 * The app's IA, matching the site (DECISIONS S13): Explore, Walks, Stories,
 * Today from `primaryNav`, plus More for `secondaryNav`. Each tab ships with
 * its route, so no tab can 404.
 *
 * Struck 2026-10-08, with the drawer and the app bar: Grid home, light-cycle
 * race, Spatial, Schedule, Editor settings, Menu viewer, Notifications,
 * Profile, Settings. None had a site counterpart or real data.
 *
 * On a quest build the rail moves into its own window on the main window's
 * start edge (DECISIONS S18, `AppTabBarHost`).
 *
 * JS tabs, not `NativeTabs`: `NativeTabs` cannot draw an Android navigation
 * rail (`sidebarAdaptable` is iOS 18+ iPad only), and `tabBarPosition` exists
 * only on the JS tabs.
 */
export default function TabLayout() {
  const { width } = useWindowDimensions();
  const rail = width >= RAIL_MIN_WIDTH;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: rail ? 'left' : 'bottom',
      }}
      tabBar={(props) => <AppTabBarHost {...props} rail={rail} />}
    >
      {APP_TABS.map((tab) => (
        <Tabs.Screen key={tab.route} name={TAB_SCREEN[tab.route]} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}
