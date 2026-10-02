/**
 * The CMS-unreachable state — designed, not a thrown error. Rendered whenever
 * a Payload read fails so the prerendered output still carries real HTML.
 *
 * SOT-KEYWORDS: web-vite cms offline state payload
 */
import { Text, View } from '@acme/ui/tw';
import { PAYLOAD_API_BASE } from '@/lib/payload';

export function CmsOffline({ detail }: { detail: string }) {
  return (
    <View className="gap-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] px-6 py-10">
      <Text className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400/70">
        CMS offline
      </Text>
      <Text className="text-sm leading-relaxed text-cyan-100/60">
        The site could not reach the Payload REST API at{' '}
        <Text className="font-mono text-cyan-300">{PAYLOAD_API_BASE}</Text>. Start the CMS with{' '}
        <Text className="font-mono text-cyan-300">pnpm --filter web dev</Text> (needs{' '}
        <Text className="font-mono text-cyan-300">DATABASE_URL</Text> +{' '}
        <Text className="font-mono text-cyan-300">PAYLOAD_SECRET</Text>) and this rail fills in on
        the next request.
      </Text>
      <Text className="font-mono text-xs text-cyan-100/30">{detail}</Text>
    </View>
  );
}
