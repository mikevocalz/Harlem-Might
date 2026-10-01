import { DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';
import { Calendar, Home, Compass, Bell, User, Settings } from '@acme/ui/icons';
// expo-router's router, NOT solito's, and only because this file is
// mobile-only. solito's native useRouter goes through react-navigation's
// useLinkTo, which resolves a path against a linking config that expo-router
// does not populate — so the push silently resolved to nothing. Shared screens
// in packages/app still use solito; this drawer never renders on web.
import { usePathname } from 'solito/navigation';
import { useRouter, type Href } from 'expo-router';
import { Pressable, Text, View } from '@acme/ui/tw';
import { Avatar } from '@acme/ui';
import { AVATAR_URI, useProfile } from '@acme/app';


const MAIN_ITEMS = [
  { label: 'Home', icon: Home, href: '/' },
  { label: 'Explore', icon: Compass, href: '/explore' },
  { label: 'Schedule', icon: Calendar, href: '/split' },
  { label: 'Spatial', icon: Compass, href: '/spatial' },
  { label: 'Notifications', icon: Bell, href: '/notifications' },
  { label: 'Profile', icon: User, href: '/profile' },
  { label: 'Settings', icon: Settings, href: '/settings' },
] as const;

export function DrawerContent(props: DrawerContentComponentProps) {
  const pathname = usePathname() ?? '/';
  // The signed-in user lives in the profile store; the drawer used to hardcode
  // a second copy of the name, so the two drifted apart.
  const profileName = useProfile((state) => state.name);
  const handle = useProfile((state) => state.handle);

  const router = useRouter();
  const navigate = (href: Href) => {
    props.navigation.closeDrawer();
    router.push(href);
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' || pathname === '' : pathname.startsWith(href);

  return (
    <DrawerContentScrollView {...props} showsVerticalScrollIndicator={false}>
      {/* Identity block. The 2px rule and the raised slab match every other
          bordered surface in the app; the old hairline was the only 1px border
          in the drawer and read as an unfinished divider. */}
      <View className="mx-3 mb-4 flex-row items-center gap-3 rounded-md border-2 border-border bg-surface-raised p-3 shadow-card">
        <Avatar name={profileName} imageUri={AVATAR_URI} />
        <View className="flex-1">
          <Text numberOfLines={1} className="text-base font-semibold text-text">
            {profileName}
          </Text>
          <Text numberOfLines={1} className="text-sm text-text-muted">
            {handle}
          </Text>
        </View>
      </View>

      <Text className="mx-5 mb-1 text-xs font-semibold uppercase text-text-muted">Menu</Text>

      <View className="py-2">
        {MAIN_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Pressable
              key={item.label}
              aria-label={item.label}
              aria-selected={active}
              onPress={() => navigate(item.href)}
              // The selected row is the app's slab — yellow field, ink text,
              // 2px border, hard offset shadow — the same treatment the rail's
              // selected tab and the primary button use. It replaces yellow
              // text on a yellow tint, which was barely legible and shared its
              // look with nothing else in the app. The transparent border on
              // inactive rows keeps selection from shifting the row by 2px.
              // Hover follows the kit's existing convention — a one-step
              // colour shift, the same as Button and DataTable rows — not a
              // lift. It only ever fires on web and pointer-equipped devices,
              // so it is a refinement layered on top of the active state, never
              // the only signal that a row is interactive.
              className={`mx-3 mb-1 min-h-11 flex-row items-center gap-3 rounded-md border-2 px-3 py-2.5 transition-colors duration-fast motion-reduce:transition-none ${
                active
                  ? 'border-border bg-primary shadow-card hover:bg-primary-pressed'
                  : 'border-transparent hover:bg-surface-sunken active:bg-surface-sunken'
              }`}
            >
              <item.icon size={18} className={active ? 'text-on-primary' : 'text-text-muted'} />
              <Text
                className={`flex-1 text-base ${
                  active ? 'font-semibold text-on-primary' : 'text-text'
                }`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

    </DrawerContentScrollView>
  );
}
