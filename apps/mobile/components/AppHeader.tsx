import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MightsWordmark } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';

/** Persistent app identity; navigation lives in the adjacent rail or phone tabs. */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View className="border-b border-rule-hairline bg-paper" style={{ paddingTop: insets.top, paddingLeft: insets.left }}>
      <View className="h-16 justify-center px-4">
        <MightsWordmark height={40} />
      </View>
    </View>
  );
}
