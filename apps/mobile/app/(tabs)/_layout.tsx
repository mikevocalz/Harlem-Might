import { useNavigationPresentation } from '@/src/navigation/useNavigationPresentation';
import { Tabs } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { AppTabBarHost } from '@/components/AppTabBarHost';
import { APP_TABS, TAB_SCREEN } from '@/src/site/app-tabs';

export const unstable_settings = { initialRouteName: 'explore' };

/**
 * The app's IA, matching the site (DECISIONS S13): Explore, Walks, Stories,
 * Today from `primaryNav`, plus More for `secondaryNav`. Each tab ships with
 * its route, so no tab can 404.
 *
 * Struck 2026-10-08, with the drawer: Grid home, light-cycle
 * race, Spatial, Schedule, Editor settings, Menu viewer, Notifications,
 * Profile, Settings. None had a site counterpart or real data.
 *
 * On a quest build the rail moves into its own window on the main window's
 * physical left edge (`AppTabBarHost`).
 *
 * JS tabs, not `NativeTabs`: `NativeTabs` cannot draw an Android navigation
 * rail (`sidebarAdaptable` is iOS 18+ iPad only), and `tabBarPosition` exists
 * only on the JS tabs.
 */
export default function TabLayout() {
  const { rail, position } = useNavigationPresentation();
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => <AppHeader />,
        tabBarPosition: position,
      }}
      tabBar={(props) => <AppTabBarHost {...props} rail={rail} />}
    >
      {APP_TABS.map((tab) => (
        <Tabs.Screen key={tab.route} name={TAB_SCREEN[tab.route]} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}
