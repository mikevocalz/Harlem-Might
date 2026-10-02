import { Link } from '@tanstack/react-router';
import { Text, View } from '@acme/ui/tw';
import type { CmsPage } from '@/lib/payload';

export function PageCard({ page }: { page: CmsPage }) {
  return (
    <Link
      to="/pages/$slug"
      params={{ slug: page.slug }}
      className="group block rounded-xl border border-border bg-surface-raised p-5 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 motion-reduce:transform-none motion-reduce:transition-none"
    >
      <View className="gap-3">
        <Text className="text-xs font-medium text-text-muted">{page.slug}</Text>
        <Text className="font-display text-lg font-semibold tracking-[-0.02em] text-text group-hover:text-primary">
          {page.title}
        </Text>
        {page.summary ? (
          <Text className="text-sm leading-6 text-text-muted">{page.summary}</Text>
        ) : null}
        <Text className="pt-1 text-xs font-semibold text-primary">Read story</Text>
      </View>
    </Link>
  );
}
