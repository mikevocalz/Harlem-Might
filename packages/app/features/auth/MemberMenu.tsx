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

  useEffect(() => {
    void hydrate(siteUrl);
  }, [hydrate, siteUrl]);

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
