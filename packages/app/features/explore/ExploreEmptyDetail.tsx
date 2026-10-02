import { Heading, Text } from '@acme/ui';
import { View } from '@acme/ui/tw';

export function ExploreEmptyDetail() {
  return (
    <View className="flex-1 items-center justify-center bg-surface px-6 py-16">
      <View className="max-w-md items-center gap-3 rounded-[24px] border border-border bg-surface-raised p-7 shadow-card">
        <Text className="text-xs font-semibold text-primary">PLACE DETAIL</Text>
        <Heading level={1} size="title" className="text-center text-text">
          Pick a place on the map.
        </Heading>
        <Text className="text-center text-sm leading-6 text-text-muted">
          The canonical Place record opens here while Master and Map stay mounted on larger
          screens.
        </Text>
      </View>
    </View>
  );
}
