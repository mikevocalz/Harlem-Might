'use client';

import { useRive } from '@rive-app/react-webgl2';
import { View } from '@acme/ui/tw';
import { Asset } from 'expo-asset';
import type { RiveStageProps } from './RiveStage.types';

export function RiveStage({
  source,
  artboard,
  stateMachine,
  autoplay = true,
  className,
  height = 280,
}: RiveStageProps) {
  const { RiveComponent } = useRive({
    src: typeof source === 'number' ? Asset.fromModule(source).uri : source,
    artboard,
    stateMachines: stateMachine,
    autoplay,
    autoBind: true,
  });

  return (
    <View
      className={`overflow-hidden rounded-2xl border border-cyan-300/25 bg-black/40 ${className ?? ''}`}
      style={{ height }}
    >
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
