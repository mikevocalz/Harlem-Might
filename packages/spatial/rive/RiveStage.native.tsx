'use client';

import { Fit, RiveView, useRiveFile } from '@rive-app/react-native';
import { View } from '@acme/ui/tw';
import type { RiveStageProps } from './RiveStage.types';

export function RiveStage({
  source,
  artboard,
  stateMachine,
  autoplay = true,
  className,
  height = 280,
}: RiveStageProps) {
  const { riveFile } = useRiveFile(typeof source === 'number' ? (source as never) : { uri: source });

  return (
    <View
      className={`overflow-hidden rounded-2xl border border-cyan-300/25 bg-black/40 ${className ?? ''}`}
      style={{ height }}
    >
      {riveFile ? (
        <RiveView
          file={riveFile}
          artboardName={artboard}
          stateMachineName={stateMachine}
          autoPlay={autoplay}
          fit={Fit.Contain}
          style={{ width: '100%', height: '100%' }}
        />
      ) : null}
    </View>
  );
}
