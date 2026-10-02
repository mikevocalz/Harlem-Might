'use client';

import { useEffect, useRef } from 'react';
import { PixelRatio } from 'react-native';
import type { CanvasRef } from 'react-native-webgpu';
import { Canvas, useDevice } from 'react-native-webgpu';
import { MightsSightlineHeroRenderer } from './MightsSightlineHeroRenderer';

export interface MightsSightlineHeroProps {
  style?: object;
}

export function MightsSightlineHero({ style }: MightsSightlineHeroProps) {
  const canvasRef = useRef<CanvasRef>(null);
  const rendererRef = useRef<MightsSightlineHeroRenderer | null>(null);
  const { device } = useDevice();

  useEffect(() => {
    if (!device || !canvasRef.current) return;
    let cancelled = false;

    void (async () => {
      const context = canvasRef.current?.getContext('webgpu');
      if (!context || cancelled) return;

      const canvas = context.canvas as unknown as {
        width: number;
        height: number;
        clientWidth: number;
        clientHeight: number;
      };
      const dpr = PixelRatio.get();
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

      context.configure({
        device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied',
      });

      const renderer = new MightsSightlineHeroRenderer({
        context,
        device,
        width: canvas.width,
        height: canvas.height,
      });
      rendererRef.current = renderer;
      await renderer.init();
      if (cancelled) return;

      renderer.renderer.setAnimationLoop((now) => renderer.render(now));
    })();

    return () => {
      cancelled = true;
      rendererRef.current?.renderer.setAnimationLoop(null);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [device]);

  return <Canvas ref={canvasRef} opaque={false} style={[{ flex: 1 }, style]} />;
}
