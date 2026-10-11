import { Image } from '../Image';
import { View } from '../tw';

// Bundle the existing landscape brand asset so the header also works offline.
const landscapeLogo = require('../../assets/Harlem-Might-Logo-landscape.png');

export function MightsWordmark({ height = 40, className = '' }: { height?: number; className?: string }) {
  return (
    <View className={className}>
      <Image src={landscapeLogo} alt="Harlem Might" width={height * 3} height={height} contentFit="contain" />
    </View>
  );
}
