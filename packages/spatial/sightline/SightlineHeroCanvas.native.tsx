'use client';

import { useEffect, useRef } from 'react';
import { PixelRatio } from 'react-native';
import type { CanvasRef } from 'react-native-webgpu';
import { Canvas, useDevice } from 'react-native-webgpu';
import { SightlineHeroRenderer } from './SightlineHeroRenderer';

export interface SightlineHeroCanvasProps {
  getProgress?: () => number;
  reducedMotion?: boolean;
  className?: string;
  style?: object;
}

export function SightlineHeroCanvas({
  getProgress,
  reducedMotion = false,
  style,
}: SightlineHeroCanvasProps) {
  const canvasRef = useRef<CanvasRef>(null);
  const rendererRef = useRef<SightlineHeroRenderer | null>(null);
  const { device } = useDevice();

  useEffect(() => {
    if (!device || !canvasRef.current) return;

    let cancelled = false;

    const start = async () => {
      const context = canvasRef.current?.getContext('webgpu');
      if (!context || cancelled) return;

      const canvas = context.canvas as unknown as {
        width: number;
        height: number;
        clientWidth: number;
        clientHeight: number;
      };
      const dpr = Math.min(2, PixelRatio.get());
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

      context.configure({
        device,
        format: globalThis.navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied',
      });

      const renderer = new SightlineHeroRenderer({
        context,
        device,
        width: canvas.width,
        height: canvas.height,
      });
      rendererRef.current = renderer;
      await renderer.init();

      if (cancelled) {
        renderer.dispose();
        return;
      }

      renderer.renderer.setAnimationLoop((now) => {
        renderer.setProgress(getProgress?.() ?? 0);
        renderer.render(now, reducedMotion);
      });
    };

    void start();

    return () => {
      cancelled = true;
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [device, getProgress, reducedMotion]);

  return <Canvas ref={canvasRef} opaque={false} style={[{ flex: 1 }, style]} />;
}
