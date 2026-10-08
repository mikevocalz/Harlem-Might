import type { ReactNode } from 'react';
import { SafeArea } from '@acme/ui';
import { Pressable, ScrollView, Text, View } from '@acme/ui/tw';

/**
 * A text page inside a tab, in the site's `MightsPage` shape: an H1, a muted
 * lead, then the body. Flat paper on warm black, left-aligned, measure capped
 * so lines stay readable on a 1280dp Horizon window.
 */
export function SitePage({
  title,
  lead,
  underHeader = false,
  children,
}: {
  title: string;
  lead?: string;
  /** True when a stack header already sits above the page and owns the top inset. */
  underHeader?: boolean;
  children?: ReactNode;
}) {
  return (
    <SafeArea edges={underHeader ? ['left', 'right'] : ['top', 'left', 'right']} className="flex-1 bg-surface">
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-8 px-6 pb-12 pt-8">
        <View className="max-w-content-detail gap-4">
          <Text role="heading" aria-level={1} className="font-sans text-title-lg font-bold text-text">
            {title}
          </Text>
          {lead ? <Text className="font-sans text-lead-sm text-text-muted">{lead}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeArea>
  );
}

/**
 * The empty and could-not-check notice for Walks, Stories and Today, ported
 * from apps/web/components/content/ContentNotice.tsx: a gold rail on the
 * leading edge, an H2, one paragraph and the actions.
 */
export function ContentNotice({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <View className="max-w-content-detail gap-5 border-l-2 border-rule-rail pl-5">
      <Text role="heading" aria-level={2} className="font-sans text-title font-semibold text-text">
        {title}
      </Text>
      <Text className="font-sans text-body text-text-muted">{children}</Text>
      <View className="flex-row flex-wrap gap-3">{actions}</View>
    </View>
  );
}

/**
 * A text action in the site's button colours. Primary is gold on warm black,
 * secondary is a gold outline. 48dp tall, the Horizon target floor.
 */
export function SiteAction({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      role="button"
      aria-label={label}
      onPress={onPress}
      className={`min-h-target justify-center px-5 ${
        variant === 'primary'
          ? 'bg-primary active:bg-primary-pressed'
          : 'border border-primary active:bg-surface-sunken'
      }`}
    >
      <Text className={`font-sans text-ui font-semibold ${variant === 'primary' ? 'text-on-primary' : 'text-primary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
