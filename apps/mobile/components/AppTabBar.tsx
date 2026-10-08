// Expo Router 58 exposes the JavaScript tab navigator and its public types
// from this stable export; do not reach into expo-router/build internals.
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, Text, View } from '@acme/ui/tw';
import { BookOpen, CalendarClock, Ellipsis, Footprints, MapPinned } from '@acme/ui/icons';
import { haptics } from '@acme/ui/haptics';
import { APP_TABS, TAB_SCREEN, type AppTabRoute } from '@/src/site/app-tabs';

/** Material 3 navigation rail width. Items keep the 48dp target floor. */
export const RAIL_WIDTH = 88;

// The same glyphs as the site's dock (packages/ui/mights/MightsDock.tsx).
const ICONS: Record<AppTabRoute, typeof MapPinned> = {
  explore: MapPinned,
  walks: Footprints,
  stories: BookOpen,
  today: CalendarClock,
  more: Ellipsis,
};

const LABELS = Object.fromEntries(APP_TABS.map((tab) => [tab.route, tab.label])) as Record<AppTabRoute, string>;

/** Screen name (`(more)`) back to the tab it belongs to. */
const TAB_BY_SCREEN = new Map(APP_TABS.map((tab) => [TAB_SCREEN[tab.route], tab.route]));

/**
 * The app's primary navigation, drawn in the site dock's likeness
 * (MightsDock): a paper bar under a hairline rule, muted items, and the
 * current one marked by a gold rail plus gold label. No pill and no fill, so
 * the selection reads the same as on the site.
 *
 * Bottom bar below 600dp. From 600dp up (tablets, the 1280dp Horizon window)
 * it becomes a leading rail, where the gold marker moves to the item's
 * leading edge.
 */
export function AppTabBar({ state, emitter, navigateToTab, insets, rail }: BottomTabBarProps & { rail: boolean }) {
  const items = state.routes.map((route, index) => {
    const tab = TAB_BY_SCREEN.get(route.name);
    if (!tab) return null;
    const focused = state.index === index;
    const Icon = ICONS[tab];
    const label = LABELS[tab];

    const onPress = () => {
      haptics.selection();
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigateToTab(route.key);
    };

    return (
      <Pressable
        key={route.key}
        role="tab"
        aria-label={label}
        aria-selected={focused}
        onPress={onPress}
        className={`relative min-h-target min-w-target items-center justify-center gap-1 active:bg-surface-sunken ${
          rail ? 'w-full py-2' : 'flex-1'
        }`}
      >
        {focused ? (
          <View
            aria-hidden
            className={rail ? 'absolute bottom-2 left-0 top-2 w-rail bg-primary' : 'absolute top-0 h-rail w-8 bg-primary'}
          />
        ) : null}
        <Icon size={rail ? 24 : 20} strokeWidth={focused ? 2.25 : 1.75} className={focused ? 'text-primary' : 'text-text-muted'} />
        <Text
          numberOfLines={1}
          className={`font-sans font-medium ${rail ? 'text-label' : 'text-caption'} ${
            focused ? 'text-primary' : 'text-text-muted'
          }`}
        >
          {label}
        </Text>
      </Pressable>
    );
  });

  if (!rail) {
    return (
      <View
        role="tablist"
        style={{ paddingBottom: insets.bottom }}
        className="flex-row border-t border-rule-hairline bg-paper px-1"
      >
        <View className="h-dock flex-1 flex-row items-stretch">{items}</View>
      </View>
    );
  }

  return (
    <View
      role="tablist"
      style={{ width: RAIL_WIDTH, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}
      className="h-full items-center gap-target-gap border-r border-rule-hairline bg-paper"
    >
      {items}
    </View>
  );
}
