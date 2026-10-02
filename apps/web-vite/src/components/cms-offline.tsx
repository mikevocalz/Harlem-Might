import { Text, View } from '@acme/ui/tw';

export function CmsOffline({ detail }: { detail: string }) {
  return (
    <View className="gap-3 rounded-xl border border-border bg-surface-raised px-6 py-8 shadow-card">
      <Text className="text-sm font-semibold text-text">Editorial feed unavailable</Text>
      <Text className="text-sm leading-6 text-text-muted">
        The public site is still usable. Published editorial content will reappear when the CMS connection returns.
      </Text>
      <Text className="text-xs text-text-muted">{detail}</Text>
    </View>
  );
}
