'use client';

import { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { Avatar } from '@acme/ui';
import { Header, Nav, Text, View } from '@acme/ui/tw';
import { useMemberSession } from '@/lib/member-session';

const LINKS = [
  { to: '/explore', label: 'Explore' },
  { to: '/walks', label: 'Walks' },
  { to: '/stories', label: 'Stories' },
  { to: '/today', label: 'Today' },
  { to: '/ar', label: 'AR' },
  { to: '/about', label: 'About' },
] as const;

export function SiteNav() {
  const status = useMemberSession((state) => state.status);
  const member = useMemberSession((state) => state.member);
  const hydrate = useMemberSession((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const avatarUri =
    typeof member?.avatar === 'object' && member.avatar ? member.avatar.url : undefined;

  return (
    <Header className="sticky top-0 z-50 border-b border-border/80 bg-surface/92 backdrop-blur-xl">
      <View className="mx-auto w-full max-w-screen-2xl gap-3 px-4 py-3 sm:px-6">
        <View className="flex-row items-center justify-between gap-3">
          <Link
            to="/"
            aria-label="Harlem Mights home"
            className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
          >
            <View className="h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-primary">
              <Text className="text-base font-bold text-on-primary">HM</Text>
            </View>
            <View className="min-w-0 gap-0.5">
              <Text className="truncate font-display text-base font-semibold tracking-[-0.02em] text-text sm:text-lg">
                Harlem Mights
              </Text>
              <Text className="hidden text-[11px] text-text-muted sm:block">
                Harlem, mapped with context
              </Text>
            </View>
          </Link>

          <View className="shrink-0 flex-row items-center gap-2">
            <Link
              to="/profile"
              aria-label={member ? `Open profile for ${member.name ?? member.email}` : 'Sign in'}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-2 py-1.5 shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
            >
              {member ? (
                <>
                  <Avatar
                    name={member.name ?? member.email}
                    imageUri={avatarUri}
                    size="xs"
                    entity="person"
                  />
                  <Text className="hidden max-w-32 truncate text-xs font-semibold text-text sm:block">
                    {member.name ?? 'Profile'}
                  </Text>
                </>
              ) : (
                <Text className="px-1 text-xs font-semibold text-text">
                  {status === 'loading' ? 'Profile' : 'Sign in'}
                </Text>
              )}
            </Link>
            <Link
              to="/explore"
              className="hidden rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 sm:block"
            >
              Open the map
            </Link>
          </View>
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
