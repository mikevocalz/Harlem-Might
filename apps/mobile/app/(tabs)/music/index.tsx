import { View, Text } from '@acme/ui/tw';

export default function MusicRoute() {
  return (
    <View className="flex-1 gap-4 bg-surface p-6">
      <Text className="text-3xl font-bold">Harlem Music</Text>
      <Text>Artist biographies and featured performances will appear after editorial verification.</Text>
    </View>
  );
}
