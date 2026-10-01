'use client';
// Settings — reached from Profile. Preferences, appearance, and session
// controls live here; identity stays on the profile screen.
import { Section, View, Pressable } from '@acme/ui/tw';
import { Button, Card, Heading, Switch, Text, FadeIn } from '@acme/ui';
import { useProfile, type ThemePreference } from '../profile/profile.store';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function ThemeSegment() {
  const theme = useProfile((s) => s.theme);
  const setTheme = useProfile((s) => s.setTheme);
  return (
    <View className="flex-row gap-1 self-start rounded-lg border-2 border-border bg-surface-sunken p-1">
      {THEME_OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <Pressable
            key={option.value}
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            onPress={() => setTheme(option.value)}
            className={`rounded-md px-4 py-1.5 transition-colors duration-fast ${
              active ? 'border-2 border-border-strong bg-primary' : 'hover:bg-surface-raised/60'
            }`}
          >
            <Text variant="caption" className={active ? 'font-semibold text-on-primary' : 'text-text-muted'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SettingsContent() {
  const p = useProfile();

  return (
    <View className="gap-6 md:gap-10 lg:gap-12">
      <FadeIn>
        <Section className="gap-1">
          <Heading level={1} size="display-sm">Settings</Heading>
          <Text tone="muted">Notifications, appearance, and your session.</Text>
        </Section>
      </FadeIn>

      <FadeIn delay={80}>
        <Card className="gap-4">
          <View className="gap-1">
            <Text variant="heading">Preferences</Text>
            <Text variant="caption" tone="muted">Notifications and visibility.</Text>
          </View>
          <Switch value={p.notifications} onChange={p.setNotifications} label="Push notifications" />
          <Switch value={p.digest} onChange={p.setDigest} label="Weekly email digest" />
          <Switch value={p.publicProfile} onChange={p.setPublicProfile} label="Public profile" />
        </Card>
      </FadeIn>

      <FadeIn delay={140}>
        <Card className="gap-4">
          <View className="gap-1">
            <Text variant="heading">Appearance</Text>
            <Text variant="caption" tone="muted">Follow the device, or pick a side.</Text>
          </View>
          <ThemeSegment />
        </Card>
      </FadeIn>

      <FadeIn delay={200}>
        <Card className="gap-3">
          <View className="gap-1">
            <Text variant="heading">Session</Text>
            <Text variant="caption" tone="muted">Sign out on this device only.</Text>
          </View>
          <View className="flex-row gap-3">
            <Button title="Sign out" variant="outline" onPress={() => {}} />
            <Button title="Delete account" variant="ghost" onPress={() => {}} />
          </View>
        </Card>
      </FadeIn>
    </View>
  );
}
