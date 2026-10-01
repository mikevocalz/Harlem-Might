import { useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { AppTabBar } from '../../../components/AppTabBar';

/**
 * Material's navigation rail threshold. Below 600dp the bar sits at the bottom;
 * from medium up — tablets and unfolded foldables — it moves to the leading
 * edge as a rail.
 *
 * This is NOT the kit's REGULAR_MIN_WIDTH (768). That constant governs when a
 * layout earns a second pane; the rail switches earlier, at the width where a
 * full-width bottom bar starts wasting a wide window's vertical space.
 */
const RAIL_MIN_WIDTH = 600;

/**
 * These are expo-router's JS tabs, not `NativeTabs`.
 *
 * TRADE-OFF, made deliberately: `NativeTabs` renders the real platform bar, but
 * its only repositioning prop is `sidebarAdaptable`, which expo-router
 * documents as iOS 18+ iPad/macOS and explicitly a no-op elsewhere — it cannot
 * produce an Android navigation rail at all. `tabBarPosition` exists only on
 * the JS tabs, so a rail on Android means giving up the native bar. In exchange
 * the rail is identical on both platforms and carries the app's own styling.
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
      tabBar={(props) => <AppTabBar {...props} rail={rail} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Grid' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Alerts' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
