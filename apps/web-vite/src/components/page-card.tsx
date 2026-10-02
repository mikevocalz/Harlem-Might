/**
 * One published CMS page as a card — hairline cyan border, the dark grid
 * card language in miniature.
 *
 * SOT-KEYWORDS: web-vite page card payload
 */
import { Link } from '@tanstack/react-router';
import { Text, View } from '@acme/ui/tw';
import type { CmsPage } from '@/lib/payload';

export function PageCard({ page }: { page: CmsPage }) {
  return (
    <Link
      to="/pages/$slug"
      params={{ slug: page.slug }}
      className="group block rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-5 transition-colors duration-150 hover:border-cyan-400/40 hover:bg-cyan-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
    >
      <View className="gap-2">
        <Text className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-400/70">
          /pages/{page.slug}
        </Text>
        <Text className="font-display text-lg font-bold uppercase tracking-wide text-cyan-50 group-hover:text-cyan-300">
          {page.title}
        </Text>
        {page.summary ? (
          <Text className="text-sm leading-relaxed text-cyan-100/60">{page.summary}</Text>
        ) : null}
        <Text className="pt-1 text-xs text-cyan-400/60">Read →</Text>
      </View>
    </Link>
  );
}
