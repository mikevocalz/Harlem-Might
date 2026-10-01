import { Drawer } from 'expo-router/drawer';
import { useColorScheme } from 'react-native';
import { palette } from '@acme/theme';
import { DrawerContent } from '../../components/DrawerContent';
import { AppHeader } from '../../components/AppHeader';
import { horizontalGesturesEnabled } from '@/src/navigation/split-view/pane-search';
import { usePaneSearchStore } from '@/src/navigation/split-view/pane-search.store';

export default function DrawerLayout() {
  const isDark = useColorScheme() === 'dark';
  /**
   * The drawer's edge swipe and a focused search field want the same gesture: a
   * horizontal drag near the leading edge is also how you move the caret or
   * select text. The field wins while it holds focus — it is the surface the
   * user is actively working in. Generalised from the reference's
   * `use-drawer-enabled`, which disabled the drawer on search focus.
   */
  const searches = usePaneSearchStore((state) => state.panes);
  const swipeEnabled = horizontalGesturesEnabled(Object.values(searches));

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        // Every drawer route gets the app bar. The split route opts out below:
        // it fills the screen and draws its own header inside its safe area.
        header: () => <AppHeader />,
        drawerType: 'front',
        drawerStyle: {
          width: 270,
          backgroundColor: isDark ? palette.ink[900] : palette.ink[50],
        },
        overlayColor: 'rgba(0,0,0,0.6)',
        swipeEnabled,
        swipeEdgeWidth: 40,
      }}
    >
      <Drawer.Screen name="(tabs)" options={{ headerShown: false }} />
      <Drawer.Screen name="split" options={{ headerShown: false }} />
    </Drawer>
  );
}
