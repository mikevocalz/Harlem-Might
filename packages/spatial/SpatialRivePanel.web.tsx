'use client';

import { ViroQuad, ViroText } from './viro';

/**
 * The fork's Nitro ViroRivePanel is a native texture bridge. Web Rive is
 * rendered by RiveStage outside the Viro canvas until a web texture bridge is
 * published, so the immersive scene shows an explicit placeholder instead of
 * pretending the native surface exists.
 */
export function SpatialRivePanel({
  position = [0, 0.1, -2.2],
}: {
  bytes?: ArrayBuffer;
  position?: [number, number, number];
}) {
  return (
    <>
      <ViroQuad position={position} width={1.3} height={0.8} materials={['spatialDark']} />
      <ViroText
        position={[position[0], position[1], position[2] + 0.01]}
        width={2.4}
        height={0.5}
        scale={[0.4, 0.4, 0.4]}
        text="Rive WebGL2 runs in the universal panel below the Viro scene"
        style={{ fontSize: 18, color: '#2cf6ff', textAlign: 'center' }}
      />
    </>
  );
}
