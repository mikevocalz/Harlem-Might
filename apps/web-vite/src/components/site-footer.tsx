import { Footer, Text, View } from '@acme/ui/tw';

export function SiteFooter() {
  return (
    <Footer className="border-t border-border bg-surface-raised">
      <View className="mx-auto w-full max-w-screen-2xl gap-2 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Text className="text-xs text-text-muted">© Harlem Mights</Text>
        <Text className="text-xs text-text-muted">
          Built for Harlem first. Sources, rights and corrections stay visible.
        </Text>
      </View>
    </Footer>
  );
}
