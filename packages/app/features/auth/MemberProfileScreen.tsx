'use client';

// The member's own page: who is signed in, the places they saved, and the way
// out. Signed-out visitors get the door back to sign-in instead of a form —
// the auth screens already own that job.

import { useEffect } from 'react';
import { List, ListItem } from '@acme/ui';
import { Link, Section } from '@acme/ui/html';
import {
  MightsButton,
  MightsHeading,
  MightsNotchCard,
  MightsPage,
  MightsText,
  routes,
} from '@acme/ui/mights';
import { Text, View } from '@acme/ui/tw';
import { ContentLoader } from '../site/content/ContentLoader.tsx';
import { ContentNotice } from '../site/content/ContentNotice.tsx';
import { MemberAvatar } from './MemberAvatar.tsx';
import { memberFirstName, useMemberSession, type SavedPlaceEntry } from './member-session.ts';

function savedPlaceLink(entry: SavedPlaceEntry): { name: string; href: string } | undefined {
  const place = entry.place;
  if (typeof place !== 'object' || place === null || !place.name || !place.slug) return undefined;
  return { name: place.name, href: routes.place(place.slug) };
}

function SavedPlaces({ entries }: { entries: readonly SavedPlaceEntry[] }) {
  const places = entries.flatMap((entry) => {
    const link = savedPlaceLink(entry);
    return link ? [{ id: entry.id, ...link }] : [];
  });
  return (
    <Section aria-labelledby="saved-places" className="flex max-w-content-detail flex-col gap-4 border-t border-rule-rail pt-8">
      <MightsHeading level={2} size="title" id="saved-places">
        Saved places
      </MightsHeading>
      {places.length === 0 ? (
        <MightsText>
          Nothing saved yet. Places you keep from the map collect here so they follow you between devices.
        </MightsText>
      ) : (
        <List className="grid gap-4 sm:grid-cols-2">
          {places.map((place) => (
            <ListItem key={place.id} className="flex flex-col">
              <MightsNotchCard href={place.href} tone="raised">
                <View className="flex flex-col gap-1 p-5">
                  <MightsHeading level={3} size="card">
                    {place.name}
                  </MightsHeading>
                  <Text className="text-small text-text-muted">Open on the map</Text>
                </View>
              </MightsNotchCard>
            </ListItem>
          ))}
        </List>
      )}
    </Section>
  );
}

/** `siteUrl` mirrors MemberAuthScreen: '' for same-origin on web, the site origin on native. */
export function MemberProfileScreen({ siteUrl }: { siteUrl: string }) {
  const status = useMemberSession((s) => s.status);
  const member = useMemberSession((s) => s.member);
  const savedPlaces = useMemberSession((s) => s.savedPlaces);
  const hydrate = useMemberSession((s) => s.hydrate);
  const signOut = useMemberSession((s) => s.signOut);

  useEffect(() => {
    void hydrate(siteUrl);
  }, [hydrate, siteUrl]);

  if (status === 'idle' || status === 'loading') {
    return (
      <MightsPage title="Your profile" crumbs={[{ label: 'Profile', href: routes.profile() }]}>
        <ContentLoader label="Checking your member session" />
      </MightsPage>
    );
  }

  if (status === 'signed-out' || !member) {
    return (
      <MightsPage title="Your profile" crumbs={[{ label: 'Profile', href: routes.profile() }]}>
        <ContentNotice
          title="You’re not signed in"
          actions={
            <>
              <MightsButton href={routes.signIn()}>Sign in</MightsButton>
              <MightsButton href={routes.signUp()} variant="secondary">
                Create account
              </MightsButton>
            </>
          }
        >
          A member account keeps saved places with you between devices. Exploring
          Harlem works without one.
        </ContentNotice>
      </MightsPage>
    );
  }

  const label = member.name?.trim() || member.email;
  return (
    <MightsPage
      title={label}
      lead={`Signed in as ${member.email}`}
      crumbs={[
        { label: 'Home', href: routes.home() },
        { label: 'Profile', href: routes.profile() },
      ]}
    >
      <Section aria-label="Your member account" className="flex max-w-content-detail flex-col gap-6">
        <View className="flex-row items-center gap-4">
          <MemberAvatar name={label} imageUri={member.image} size="lg" />
          <View className="flex-col gap-1">
            <MightsText size="small" className="font-semibold uppercase tracking-[0.16em] text-primary">
              Member account
            </MightsText>
            <MightsHeading level={2} size="card">
              {memberFirstName(member)}
            </MightsHeading>
            <MightsText size="small" className="text-text-muted">
              {member.email}
            </MightsText>
          </View>
        </View>
        <View className="flex-row">
          <MightsButton onPress={() => void signOut()} variant="outline" size="sm">
            Sign out
          </MightsButton>
        </View>
      </Section>
      <SavedPlaces entries={savedPlaces} />
      <MightsText size="small" className="max-w-content-detail text-text-muted">
        Saved places sync through your member account. Save a place from{' '}
        <Link href={routes.explore()} className="mights-focus text-primary underline underline-offset-4">
          the map
        </Link>{' '}
        and it shows up here.
      </MightsText>
    </MightsPage>
  );
}
