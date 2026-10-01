'use client';
// Shared profile sections — identity, account, preferences, session.
// One screen owns the whole "you" surface; settings live here, not on a
// separate route (design decision: fewer places, clearer map).
import { useRouter } from 'solito/navigation';
import { Section, View } from '@acme/ui/tw';
import {
  Avatar,
  Button,
  Card,
  Heading,
  PressScale,
  Text,
  TextField,
  FadeIn,
  ScaleIn,
} from '@acme/ui';
import { Settings as SettingsIcon, ChevronRight } from '@acme/ui/icons';
import { AVATAR_URI, useProfile } from './profile.store';

const TAGS = ['Design', 'Mobile', 'Web'];
const STATS = [
  { label: 'Projects', value: '24' },
  { label: 'Followers', value: '1.2k' },
  { label: 'Following', value: '184' },
];

export function ProfileContent() {
  const p = useProfile();
  const router = useRouter();

  return (
    <View className="gap-6 md:gap-10 lg:gap-12">
      {/* Identity */}
      <FadeIn>
        <Section className="gap-4">
          <View className="flex-row flex-wrap items-center gap-5">
            <ScaleIn delay={60}>
              <Avatar name={p.name} imageUri={AVATAR_URI} size="xl" />
            </ScaleIn>
            <View className="min-w-40 flex-1 gap-1">
              <Text variant="label" tone="muted">Account</Text>
              <Heading level={1} size="display-sm">{p.name}</Heading>
              <Text tone="muted">{p.handle}</Text>
            </View>
            <Button title="Edit profile" variant="outline" size="sm" onPress={() => {}} />
          </View>
          <View className="flex-row flex-wrap gap-2">
            {TAGS.map((tag) => (
              <View key={tag} className="rounded-sm border-2 border-border bg-primary/20 px-3 py-1">
                <Text variant="caption" className="font-semibold text-text">{tag}</Text>
              </View>
            ))}
          </View>
          <View className="flex-row overflow-hidden rounded-card border-2 border-border bg-surface-raised shadow-card">
            {STATS.map((stat, i) => (
              <View key={stat.label} className={`flex-1 items-center gap-0.5 py-4 ${i > 0 ? 'border-l-2 border-border' : ''}`}>
                <Text variant="heading">{stat.value}</Text>
                <Text variant="caption" tone="muted">{stat.label}</Text>
              </View>
            ))}
          </View>
        </Section>
      </FadeIn>

      {/* Account */}
      <FadeIn delay={80}>
        <Card className="gap-4">
          <View className="gap-1">
            <Text variant="heading">Account</Text>
            <Text variant="caption" tone="muted">How you appear across the app.</Text>
          </View>
          <TextField label="Name" value={p.name} onChangeText={p.setName} />
          <TextField label="Email" value={p.email} onChangeText={p.setEmail} hint="Used for sign-in and receipts." />
        </Card>
      </FadeIn>

      {/* Settings entry — preferences, appearance, and session live there */}
      <FadeIn delay={140}>
        <PressScale
          aria-label="Open settings"
          onPress={() => router.push('/settings')}
          className="w-full flex-row items-center gap-3 rounded-card border-2 border-border bg-surface-raised p-4 shadow-card"
          outerClassName="w-full"
        >
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <SettingsIcon size={20} className="text-text" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="heading">Settings</Text>
            <Text variant="caption" tone="muted">Notifications, appearance, session.</Text>
          </View>
          <ChevronRight size={18} className="text-text-muted" />
        </PressScale>
      </FadeIn>



    </View>
  );
}
