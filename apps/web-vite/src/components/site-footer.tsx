import { Link } from '@tanstack/react-router';
import { Footer, Text, View } from '@acme/ui/tw';

export function SiteFooter() {
  return (
    <Footer className="border-t border-border bg-surface-raised">
      <View className="mx-auto w-full max-w-screen-2xl gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <View className="gap-1">
          <Text className="text-xs font-semibold text-text">Harlem Might operations</Text>
          <Text className="text-xs text-text-muted">
            Canonical catalogue, source review and Payload-backed curator tools.
          </Text>
        </View>
        <Link
          to="/admin/businesses"
          className="self-start rounded-lg px-3 py-2 text-xs font-semibold text-text-muted hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
        >
          Open catalogue
        </Link>
      </View>
    </Footer>
  );
}
