// Expo Router 58 exposes the JavaScript tab navigator and its public types
// from this stable export; do not reach into expo-router/build internals.
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, Text, View } from '@acme/ui/tw';
import { Home, Compass, Bell, User } from '@acme/ui/icons';
import { MenuButton } from '@acme/app';
import { haptics } from '@acme/ui/haptics';

/** Material 3 navigation rail: 80dp wide, 56dp items. */
export const RAIL_WIDTH = 80;
const RAIL_ITEM_HEIGHT = 56;
/** Gap between the menu button and the bottom edge, per the brief. */
const MENU_BOTTOM_GAP = 10;

const ICONS = {
  index: Home,
  explore: Compass,
  notifications: Bell,
  profile: User,
} as const;

const LABELS = {
  index: 'Grid',
  explore: 'Explore',
  notifications: 'Alerts',
  profile: 'Profile',
} as const;

type RouteName = keyof typeof ICONS;

/**
 * The tab bar, drawn from the app's own primitives.
 *
 * WHY CUSTOM: react-navigation's built-in bar is Material 3 — a tinted stadium
 * pill behind the icon on a hairline surface. Recolouring that pill is not
 * enough, because the *shape* is what makes it foreign: everything else on
 * screen is a rounded-md slab with a 2px ink border and a hard 4px offset
 * shadow (chips, buttons, cards). Its `uikit` variant also renders the leading
 * position as a wide ~20%-of-window sidebar rather than a rail. Owning the
 * render gives the app's slab language, true M3 rail metrics, and somewhere to
 * put the menu button.
 */
export function AppTabBar({ state, emitter, navigateToTab, insets, rail }: BottomTabBarProps & { rail: boolean }) {
  const gridMode = state.routes[state.index]?.name === 'index';

  const items = state.routes.map((route, index) => {
    const focused = state.index === index;
    const name = route.name as RouteName;
    const Icon = ICONS[name];
    if (!Icon) return null;

    const onPress = () => {
      haptics.selection();
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        navigateToTab(route.key);
      }
    };

    return (
      <Pressable
        key={route.key}
        aria-label={LABELS[name]}
        aria-selected={focused}
        onPress={onPress}
        className={rail ? 'w-full' : 'flex-1'}
      >
        {/* The selected slab is the same treatment as the "All" chip and the
            "New booking" button. Unselected items keep a transparent 2px border
            so selection does not shift anything by the border's width. */}
        <View
          style={rail ? { height: RAIL_ITEM_HEIGHT } : undefined}
          className={`items-center justify-center gap-0.5 rounded-md border-2 transition-colors duration-fast motion-reduce:transition-none ${
            rail ? 'px-1' : 'px-3 py-1.5'
          } ${
            focused
              ? gridMode
                ? 'border-cyan-300/40 bg-cyan-300/10 shadow-card'
                : 'border-border bg-primary shadow-card hover:bg-primary-pressed'
              : gridMode
                ? 'border-transparent hover:bg-white/5'
                : 'border-transparent hover:bg-surface-sunken'
          }`}
        >
          <Icon
            size={24}
            className={
              gridMode
                ? focused
                  ? 'text-cyan-200'
                  : 'text-white/55'
                : focused
                  ? 'text-on-primary'
                  : 'text-text-muted'
            }
          />
          <Text
            numberOfLines={1}
            className={`text-xs font-semibold md:text-sm ${
              gridMode
                ? focused
                  ? 'text-cyan-100'
                  : 'text-white/55'
                : focused
                  ? 'text-on-primary'
                  : 'text-text-muted'
            }`}
          >
            {LABELS[name]}
          </Text>
        </View>
      </Pressable>
    );
  });

  if (!rail) {
    return (
      <View
        style={{ paddingBottom: insets.bottom }}
        className={`flex-row items-center gap-1 px-2 pt-1 ${
          gridMode
            ? 'border-t border-cyan-300/25 bg-[#020407]/95'
            : 'border-t-2 border-border bg-surface'
        }`}
      >
        {items}
      </View>
    );
  }

  return (
    <View
      style={{
        width: RAIL_WIDTH,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + MENU_BOTTOM_GAP,
      }}
      className={`h-full items-center gap-2 px-1.5 ${
        gridMode ? 'bg-[#020407]' : 'bg-surface'
      }`}
    >
      {items}
      {/* No trailing rule: the rail shares the screen's surface colour, so the
          selected slab alone carries the edge. A border here read as a seam
          between two panels that are actually one background.

          The drawer toggle lives at the foot of the rail on wide screens — a
          rail has vertical room the bottom bar never did, and the bottom edge
          is the reachable corner on a tablet held two-handed. */}
      <View className="flex-1" />
      <MenuButton className="h-14 w-14" outerClassName="self-center" iconSize={24} />
    </View>
  );
}
