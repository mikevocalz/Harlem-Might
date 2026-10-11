'use client';

// The member's own page: their photo, name and saved places, all editable in
// place — and the way out. Signed-out visitors get the door back to sign-in.

import { useEffect, useState } from 'react';
import { List, ListItem, TextField, notify } from '@acme/ui';
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
import { pickMemberPhoto } from './member-photo';
import { useMemberSession, type MemberProfile, type SavedPlaceEntry } from './member-session.ts';

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

/** The .mights-frame corner marks, drawn with borders so native gets them too
 * (the CSS version is web-only). Offset outside the tile so they clear the
 * avatar's corner cut. */
function FrameMarks() {
  const mark = 'pointer-events-none absolute h-3 w-3 border-primary';
  return (
    <>
      <View className={`${mark} -left-1.5 -top-1.5 border-l-2 border-t-2`} />
      <View className={`${mark} -right-1.5 -top-1.5 border-r-2 border-t-2`} />
      <View className={`${mark} -bottom-1.5 -left-1.5 border-b-2 border-l-2`} />
      <View className={`${mark} -bottom-1.5 -right-1.5 border-b-2 border-r-2`} />
    </>
  );
}

/** The masthead photo: the member's own image or initials inside accent-frame marks, tappable to change. */
function MemberPhoto({ member }: { member: MemberProfile }) {
  const uploadAvatar = useMemberSession((s) => s.uploadAvatar);
  const updateProfile = useMemberSession((s) => s.updateProfile);
  const [previewUri, setPreviewUri] = useState<string | undefined>();
  const [busy, setBusy] = useState<'uploading' | 'removing' | undefined>();
  const label = member.name?.trim() || member.email;

  const change = async () => {
    const photo = await pickMemberPhoto();
    if (!photo) return;
    setPreviewUri(photo.uri);
    setBusy('uploading');
    const result = await uploadAvatar(photo);
    setBusy(undefined);
    if (!result.ok) {
      setPreviewUri(undefined);
      notify.error('Photo not saved', { description: result.message });
      return;
    }
    notify.success('Photo updated');
  };

  const remove = async () => {
    setBusy('removing');
    const result = await updateProfile({ image: null });
    setBusy(undefined);
    if (!result.ok) {
      notify.error('Photo not removed', { description: result.message });
      return;
    }
    setPreviewUri(undefined);
    notify.success('Photo removed');
  };

  return (
    <View className="flex flex-col items-start gap-4">
      <View className="relative">
        <View className={busy ? 'opacity-60' : ''}>
          <MemberAvatar name={label} imageUri={previewUri ?? member.image} size="xl" />
        </View>
        <FrameMarks />
      </View>
      <View className="flex-row items-center gap-2">
        <MightsButton onPress={() => void change()} variant="secondary" size="sm" disabled={busy !== undefined}>
          {busy === 'uploading' ? 'Uploading…' : member.image || previewUri ? 'Change photo' : 'Add a photo'}
        </MightsButton>
        {(member.image || previewUri) && busy !== 'uploading' ? (
          <MightsButton onPress={() => void remove()} variant="ghost" size="sm" disabled={busy !== undefined}>
            {busy === 'removing' ? 'Removing…' : 'Remove'}
          </MightsButton>
        ) : null}
      </View>
      <MightsText size="small" className="max-w-[28ch] text-text-muted">
        Your photo shows next to your name in the navigation when you’re signed in.
      </MightsText>
    </View>
  );
}

/** The editable name row — saved through update-user, disabled until it changes. */
function MemberDetails({ member }: { member: MemberProfile }) {
  const updateProfile = useMemberSession((s) => s.updateProfile);
  const [name, setName] = useState(member.name ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== (member.name ?? '') && name.trim().length > 0;

  const save = async () => {
    setSaving(true);
    const result = await updateProfile({ name: name.trim() });
    setSaving(false);
    if (!result.ok) {
      notify.error('Name not saved', { description: result.message });
      return;
    }
    notify.success('Name updated');
  };

  return (
    <Section aria-labelledby="member-details" className="flex max-w-content-detail flex-col gap-5 border-t border-rule-rail pt-8">
      <MightsHeading level={2} size="title" id="member-details">
        Your details
      </MightsHeading>
      <TextField
        label="Your name"
        value={name}
        onChangeText={setName}
        hint="Shown next to your photo when you’re signed in."
        disabled={saving}
      />
      <View className="flex-row items-center gap-4">
        <MightsButton onPress={() => void save()} size="sm" disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save name'}
        </MightsButton>
        <MightsText size="small" className="text-text-muted">
          Signed in as {member.email}
        </MightsText>
      </View>
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

  const label = member.name?.trim() || 'Your profile';
  return (
    <MightsPage
      title={label}
      lead="Your Harlem, kept — the photo, name and places that travel with you."
      crumbs={[
        { label: 'Home', href: routes.home() },
        { label: 'Profile', href: routes.profile() },
      ]}
      mediaLayout="leading"
      media={<MemberPhoto member={member} />}
    >
      <MemberDetails member={member} />
      <SavedPlaces entries={savedPlaces} />
      <Section aria-label="Account" className="flex max-w-content-detail flex-col gap-4 border-t border-rule-rail pt-8">
        <MightsHeading level={2} size="title">
          Account
        </MightsHeading>
        <View className="flex-row items-center gap-4">
          <MightsButton onPress={() => void signOut()} variant="outline" size="sm">
            Sign out
          </MightsButton>
          <MightsText size="small" className="text-text-muted">
            Save a place from{' '}
            <Link href={routes.explore()} className="mights-focus text-primary underline underline-offset-4">
              the map
            </Link>{' '}
            and it shows up here.
          </MightsText>
        </View>
      </Section>
    </MightsPage>
  );
}
