import { Link } from '@tanstack/react-router';
import { Header, Nav, Text, View } from '@acme/ui/tw';

const LINKS = [
  { to: '/explore', label: 'Explore' },
  { to: '/walks', label: 'Walks' },
  { to: '/stories', label: 'Stories' },
  { to: '/today', label: 'Today' },
  { to: '/ar', label: 'AR' },
  { to: '/about', label: 'About' },
] as const;

export function SiteNav() {
  return (
    <Header className="sticky top-0 z-50 border-b border-border/80 bg-surface/92 backdrop-blur-xl">
      <View className="mx-auto w-full max-w-screen-2xl gap-3 px-4 py-3 sm:px-6">
        <View className="flex-row items-center justify-between gap-4">
          <Link
            to="/"
            aria-label="Harlem Mights home"
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
          >
            <View className="h-9 w-9 items-center justify-center rounded-xl border border-border bg-primary">
              <Text className="text-base font-bold text-on-primary">HM</Text>
            </View>
            <View className="gap-0.5">
              <Text className="font-display text-base font-semibold tracking-[-0.02em] text-text sm:text-lg">
                Harlem Mights
              </Text>
              <Text className="hidden text-[11px] text-text-muted sm:block">
                Harlem, mapped with context
              </Text>
            </View>
          </Link>

          <Link
            to="/explore"
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
          >
            Open the map
          </Link>
        </View>

        <Nav aria-label="Primary" className="flex-row flex-wrap items-center gap-x-1 gap-y-1">
          {LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors duration-150 hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
              activeProps={{
                className:
                  'rounded-lg bg-surface-raised px-3 py-2 text-sm font-semibold text-primary shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40',
              }}
            >
              {item.label}
            </Link>
          ))}
        </Nav>
      </View>
    </Header>
  );
}
