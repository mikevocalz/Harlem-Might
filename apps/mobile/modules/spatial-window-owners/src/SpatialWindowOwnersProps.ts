import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Props for {@linkcode SpatialWindowOwners}. It lays out like a plain `View`.
 */
export type SpatialWindowOwnersProps = {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};
