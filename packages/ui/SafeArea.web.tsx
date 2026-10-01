'use client';
// Web fork — the browser has no unsafe areas; render a plain view and drop
// the native-only props.
import { View } from './tw';

export interface SafeAreaProps extends React.ComponentProps<typeof View> {
  edges?: readonly string[];
}

export const SafeArea = ({ edges: _edges, ...props }: SafeAreaProps) => <View {...props} />;
SafeArea.displayName = 'SafeArea(web)';
