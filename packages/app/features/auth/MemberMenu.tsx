'use client';

// The account control for the navbar's trailing slot. Signed-out visitors get
// the same Sign in button as before; signed-in members get their avatar and a
// menu with the profile and sign-out. While the session cookie is still being
// checked, an invisible spacer holds the space — a member should never see a
// "Sign in" flash.

import { useEffect } from 'react';
import { useRouter } from 'solito/navigation';
import { Menu } from '@acme/ui';
import { MightsButton, routes } from '@acme/ui/mights';
import { View , Text } from '@acme/ui/tw';
import { MemberAvatar } from './MemberAvatar.tsx';
import { memberFirstName, useMemberSession } from './member-session.ts';

export function MemberMenu({ siteUrl }: { siteUrl: string }) {
  const status = useMemberSession((s) => s.status);
  const member = useMemberSession((s) => s.member);
  const hydrate = useMemberSession((s) => s.hydrate);
  const signOut = useMemberSession((s) => s.signOut);
  const router = useRouter();

  const refresh = useMemberSession((s) => s.refresh);

  useEffect(() => {
    void hydrate(siteUrl);
  }, [hydrate, siteUrl]);

  // The cookie is the truth, not this tab: sign-in or sign-out on another tab
  // (or a session that lands after the first read) is picked up when the
  // window regains focus instead of a stale "Sign in" staying up.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState !== 'hidden') {
        const s = useMemberSession.getState();
        if (s.status === 'idle') void s.hydrate(siteUrl);
        else if (s.status !== 'loading') void s.refresh();
      }
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [siteUrl, refresh]);

  if (status === 'signed-in' && member) {
    const label = member.name?.trim() || 'Member';
    return (
      <Menu
        title={member.name?.trim() ?? 'Your account'}
        actions={[
          { id: 'profile', title: 'Your profile' },
          { id: 'sign-out', title: 'Sign out', destructive: true },
        ]}
        onAction={(id) => {
          if (id === 'profile') router.push(routes.profile());
          if (id === 'sign-out') void signOut();
        }}
      >
        <View className="flex-row items-center gap-2.5">
          <MemberAvatar name={label} imageUri={member.image} size="sm" />
          <Text className="hidden text-small font-bold text-text lg:block">{memberFirstName(member)}</Text>
        </View>
      </Menu>
    );
  }

  if (status === 'signed-out') {
    return (
      <MightsButton href={routes.signIn()} variant="outline" size="sm">
        Sign in
      </MightsButton>
    );
  }

  return <View aria-hidden className="h-9 w-24" />;
}
