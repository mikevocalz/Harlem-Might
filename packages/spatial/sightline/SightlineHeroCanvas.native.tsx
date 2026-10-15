'use client';

import { useEffect, useRef } from 'react';
import { PixelRatio } from 'react-native';
import type { CanvasRef } from 'react-native-webgpu';
import { Canvas, useDevice } from 'react-native-webgpu';
import { SightlineHeroRenderer } from './SightlineHeroRenderer';
import { startCanvasSession } from '../canvasSession';

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
  const previousClose = useRef<Promise<void> | undefined>(undefined);
  const { device } = useDevice();

  useEffect(() => {
    if (!device || !canvasRef.current) return;

    const session = startCanvasSession(previousClose.current, async (owner) => {
      const context = canvasRef.current?.getContext('webgpu');
      if (!context) return owner.fail('no-context');
      // useDevice owns this device; only the renderer belongs to this effect.
      void device.lost.then((info) => {
        if (info.reason !== 'destroyed') owner.fail('device-lost');
      });

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
      owner.own(() => renderer.dispose());
      await renderer.init();

      if (!owner.active) return;

      await renderer.renderer.setAnimationLoop((now) => {
        if (!owner.active) return;
        renderer.setProgress(getProgress?.() ?? 0);
        renderer.render(now, reducedMotion);
      });
    });
    previousClose.current = session.closed;
    return session.close;
  }, [device, getProgress, reducedMotion]);

  return <Canvas ref={canvasRef} opaque={false} style={[{ flex: 1 }, style]} />;
}
