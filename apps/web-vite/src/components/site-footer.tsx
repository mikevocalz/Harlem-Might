/**
 * The site's footer — the cyan hairline + low-alpha copy of the app footer
 * (apps/web/components/site/SiteFooter.tsx), minimal variant.
 *
 * SOT-KEYWORDS: web-vite site footer dark cyan
 */
import { Footer, Text, View } from '@acme/ui/tw';

export function SiteFooter() {
  return (
    <Footer className="border-t border-cyan-400/15 bg-[#050505] [box-shadow:0_-1px_24px_rgba(0,243,255,0.08)]">
      <View className="mx-auto w-full max-w-screen-2xl flex-row flex-wrap items-center justify-between gap-2 px-4 py-6 sm:px-6">
        <Text className="text-xs text-cyan-100/40">© Harlem Might</Text>
        <Text className="text-xs text-cyan-100/40">
          Expo SDK 58 · Next.js 16 · TanStack Start · Payload 4
        </Text>
      </View>
    </Footer>
  );
}
