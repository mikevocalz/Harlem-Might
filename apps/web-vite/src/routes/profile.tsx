import { useEffect } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Heading,
  Text,
  TextField,
} from '@acme/ui';
import { Main, Section, View } from '@acme/ui/tw';
import { useMemberSession, type SavedPlaceRecord } from '@/lib/member-session';
import type { CmsPlace } from '@/lib/payload';

export const Route = createFileRoute('/profile')({
  head: () => ({ meta: [{ title: 'Profile — Harlem Might' }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const status = useMemberSession((state) => state.status);
  const member = useMemberSession((state) => state.member);
  const hydrate = useMemberSession((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (status === 'loading' || status === 'idle') {
    return (
      <Main className="flex-1 bg-surface">
        <Section className="mx-auto w-full max-w-5xl gap-4 px-4 py-12 sm:px-6">
          <Text className="text-sm text-text-muted">Loading your profile…</Text>
        </Section>
      </Main>
    );
  }

  return member ? <SignedInProfile /> : <SignInPanel />;
}

function SignInPanel() {
  const mode = useMemberSession((state) => state.mode);
  const email = useMemberSession((state) => state.email);
  const password = useMemberSession((state) => state.password);
  const name = useMemberSession((state) => state.name);
  const error = useMemberSession((state) => state.error);
  const setMode = useMemberSession((state) => state.setMode);
  const setEmail = useMemberSession((state) => state.setEmail);
  const setPassword = useMemberSession((state) => state.setPassword);
  const setName = useMemberSession((state) => state.setName);
  const submit = useMemberSession((state) => state.submit);

  return (
    <Main className="flex-1 bg-surface">
      <Section className="mx-auto w-full max-w-5xl gap-8 px-4 py-12 sm:px-6 md:py-16">
        <View className="max-w-3xl gap-3">
          <Heading level={1} size="display-md" className="tracking-[-0.035em] text-text">
            Keep your Harlem close.
          </Heading>
          <Text className="text-base leading-7 text-text-muted md:text-lg">
            Browsing stays free without an account. Sign in only when you want saved
            places, saved walks and preferences to follow you between devices.
          </Text>
        </View>

        <Card className="w-full max-w-xl gap-5 border-border bg-surface-raised p-5 sm:p-7">
          <View className="flex-row gap-2">
            <Button
              title="Sign in"
              variant={mode === 'login' ? 'primary' : 'outline'}
              size="sm"
              onPress={() => setMode('login')}
            />
            <Button
              title="Create account"
              variant={mode === 'register' ? 'primary' : 'outline'}
              size="sm"
              onPress={() => setMode('register')}
            />
          </View>

          {mode === 'register' ? (
            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              placeholder="Your name"
            />
          ) : null}

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
          />

          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            placeholder="••••••••"
            error={error ?? undefined}
          />

          <Button
            title={mode === 'register' ? 'Create account' : 'Sign in'}
            onPress={() => void submit()}
            fullWidth
          />

          <Text className="text-xs leading-5 text-text-muted">
            An account is optional. Explore, Stories, Walks, Today and place pages stay
            available when you are signed out.
          </Text>
        </Card>
      </Section>
    </Main>
  );
}

function SignedInProfile() {
  const member = useMemberSession((state) => state.member);
  const savedPlaces = useMemberSession((state) => state.savedPlaces);
  const signOut = useMemberSession((state) => state.signOut);
  const removeSavedPlace = useMemberSession((state) => state.removeSavedPlace);

  if (!member) return null;

  const avatarUri =
    typeof member.avatar === 'object' && member.avatar ? member.avatar.url : undefined;

  return (
    <Main className="flex-1 bg-surface">
      <Section className="mx-auto w-full max-w-screen-2xl gap-8 px-4 py-12 sm:px-6">
        <View className="flex-row flex-wrap items-center justify-between gap-4">
          <View className="flex-row items-center gap-4">
            <Avatar
              name={member.name ?? member.email}
              imageUri={avatarUri}
              entity="person"
              size="xl"
            />
            <View className="gap-1">
              <Heading level={1} size="title" className="text-text">
                {member.name ?? 'Your profile'}
              </Heading>
              <Text className="text-sm text-text-muted">{member.email}</Text>
            </View>
          </View>
          <Button title="Sign out" variant="outline" onPress={() => void signOut()} />
        </View>

        <View className="gap-4">
          <View className="gap-1">
            <Heading level={2} size="display-sm" className="text-text">
              Saved places
            </Heading>
            <Text className="text-sm text-text-muted">
              Places you save from the map will collect here.
            </Text>
          </View>

          {savedPlaces.length ? (
            <View className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {savedPlaces.map((saved) => (
                <SavedPlaceCard
                  key={String(saved.id)}
                  saved={saved}
                  onRemove={() => void removeSavedPlace(saved.id)}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              icon={<Text className="text-2xl">◎</Text>}
              title="Nothing saved yet"
              description="Explore the catalogue and save places you want to revisit, walk to or add to a future route."
              action={
                <Link
                  to="/explore"
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
                >
                  Explore Harlem
                </Link>
              }
            />
          )}
        </View>
      </Section>
    </Main>
  );
}

function SavedPlaceCard({
  saved,
  onRemove,
}: {
  saved: SavedPlaceRecord;
  onRemove: () => void;
}) {
  const place =
    saved.place && typeof saved.place === 'object'
      ? (saved.place as CmsPlace)
      : null;

  return (
    <Card className="gap-4 border-border bg-surface-raised p-5">
      <View className="gap-1">
        <Heading level={3} size="title" className="text-text">
          {place?.name ?? 'Saved place'}
        </Heading>
        <Text className="text-sm text-text-muted">
          {[place?.primaryCategory, place?.primaryArea].filter(Boolean).join(' · ') ||
            'Harlem Might place'}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Link
          to="/explore"
          className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
        >
          Open on map
        </Link>
        <Button title="Remove" variant="ghost" size="sm" onPress={onRemove} />
      </View>
    </Card>
  );
}
