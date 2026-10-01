'use client';
// Notifications — mirrors the liquid-glass template (unread header + mark-all,
// Today/Earlier groups, icon-well rows, tap to read) with Legend Motion.
import { Section, View, Text as TWText, Pressable } from '@acme/ui/tw';
import { Heading, Text, FadeIn } from '@acme/ui';
import { WELL, INK } from '../home/home.data';
import { useNotifications, type Notification } from './notifications.store';

function NotificationRow({ item, index }: { item: Notification; index: number }) {
  const markRead = useNotifications((s) => s.markRead);
  return (
    <FadeIn delay={80 + index * 45}>
      <Pressable
        aria-label={item.title}
        onPress={() => markRead(item.id)}
        className={`flex-row items-start gap-3 px-4 py-3.5 transition-colors duration-fast hover:bg-surface-sunken ${
          item.read ? '' : 'bg-primary/5'
        }`}
      >
        <View className={`h-10 w-10 items-center justify-center rounded-xl ${WELL[item.tone]}`}>
          <item.icon size={18} className={INK[item.tone]} />
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <TWText className={`flex-1 text-sm text-text ${item.read ? 'font-medium' : 'font-bold'}`}>
              {item.title}
            </TWText>
            {!item.read ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
          </View>
          <Text variant="caption" tone="muted">{item.body}</Text>
          <Text variant="caption" tone="muted" className="text-[11px]">{item.time}</Text>
        </View>
      </Pressable>
    </FadeIn>
  );
}

function Group({ label, items, offset }: { label: string; items: Notification[]; offset: number }) {
  if (!items.length) return null;
  return (
    <Section className="gap-2">
      <Text variant="label" tone="muted">{label}</Text>
      <View className="overflow-hidden rounded-card border-2 border-border bg-surface-raised shadow-card">
        {items.map((item, i) => (
          <View key={item.id} className={i > 0 ? 'border-t-2 border-border' : ''}>
            <NotificationRow item={item} index={offset + i} />
          </View>
        ))}
      </View>
    </Section>
  );
}

export function NotificationsContent() {
  const items = useNotifications((s) => s.items);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const unread = items.filter((n) => !n.read).length;
  const today = items.slice(0, 3);
  const earlier = items.slice(3);

  return (
    <View className="gap-6 md:gap-10 lg:gap-12">
      <FadeIn>
        <Section className="flex-row items-end justify-between gap-3">
          <View className="gap-0.5">
            <Heading level={1} size="display-sm">Notifications</Heading>
            {unread > 0 ? <Text variant="caption" tone="muted">{unread} unread</Text> : null}
          </View>
          {unread > 0 ? (
            <Pressable
              role="button"
              aria-label="Mark all notifications read"
              onPress={markAllRead}
              className="rounded-md border-2 border-border-strong bg-primary px-3.5 py-2 shadow-card transition-all duration-fast hover:bg-primary-pressed active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            >
              <TWText className="text-sm font-semibold text-on-primary">Mark all read</TWText>
            </Pressable>
          ) : null}
        </Section>
      </FadeIn>

      <Group label="Today" items={today} offset={0} />
      <Group label="Earlier" items={earlier} offset={3} />
    </View>
  );
}
