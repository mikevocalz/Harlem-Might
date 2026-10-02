import { Link } from '@tanstack/react-router';
import { Footer, Text, View } from '@acme/ui/tw';

export function SiteFooter() {
  return (
    <Footer className="border-t border-border bg-surface-raised">
      <View className="mx-auto w-full max-w-screen-2xl gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <View className="gap-1">
          <Text className="text-xs text-text-muted">© Harlem Mights</Text>
          <Text className="text-xs text-text-muted">
            Built for Harlem first. Sources, rights and corrections stay visible.
          </Text>
        </View>
        <Link
          to="/admin"
          className="self-start rounded-lg px-3 py-2 text-xs font-semibold text-text-muted hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
        >
          Admin
        </Link>
      </View>
    </Footer>
  );
}
