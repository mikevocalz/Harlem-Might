import { Link } from '@tanstack/react-router';
import { Header, Nav, Text, View } from '@acme/ui/tw';

const LINKS = [
  { to: '/', label: 'Workspace' },
  { to: '/admin', label: 'Admin' },
  { to: '/admin/businesses', label: 'Businesses + places' },
] as const;

export function SiteNav() {
  return (
    <Header className="sticky top-0 z-50 border-b border-border/80 bg-surface/95 backdrop-blur-xl">
      <View className="mx-auto w-full max-w-screen-2xl flex-row items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          to="/"
          aria-label="Harlem Might curator workspace"
          className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
        >
          <View className="h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-primary">
            <Text className="text-sm font-bold text-on-primary">HM</Text>
          </View>
          <View className="min-w-0 gap-0.5">
            <Text className="truncate font-display text-base font-semibold tracking-[-0.02em] text-text sm:text-lg">
              Harlem Might
            </Text>
            <Text className="hidden text-[11px] text-text-muted sm:block">
              Curator + catalogue workspace
            </Text>
          </View>
        </Link>

        <Nav aria-label="Curator workspace" className="flex-row flex-wrap items-center gap-1">
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
