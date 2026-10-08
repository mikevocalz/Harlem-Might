import { View } from 'react-native';
import type { SpatialWindowOwnersProps } from './SpatialWindowOwnersProps';

/**
 * Off Android there are no view-tree owners to install, so this is a plain
 * `View`. See `SpatialWindowOwners.android.tsx`.
 */
export function SpatialWindowOwners({ style, children }: SpatialWindowOwnersProps) {
  return <View style={style}>{children}</View>;
}
