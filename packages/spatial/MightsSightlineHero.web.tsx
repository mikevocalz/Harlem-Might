'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { MightsSightlineHeroRenderer } from './MightsSightlineHeroRenderer';

export interface MightsSightlineHeroProps {
  style?: object;
}

export function MightsSightlineHero({ style }: MightsSightlineHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gpu = globalThis.navigator?.gpu;
    if (!canvas || !gpu) return;

    let disposed = false;
    let renderer: MightsSightlineHeroRenderer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let device: GPUDevice | null = null;

    void (async () => {
      const adapter = await gpu.requestAdapter();
      if (!adapter || disposed) return;

      device = await adapter.requestDevice();
      const context = canvas.getContext('webgpu');
      if (!context || disposed) return;

      const resize = () => {
        const dpr = globalThis.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));
        canvas.width = width;
        canvas.height = height;
        renderer?.resize(width, height);
      };

      resize();
      context.configure({
        device,
        format: gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied',
      });

      renderer = new MightsSightlineHeroRenderer({
        context,
        device,
        width: canvas.width,
        height: canvas.height,
      });
      await renderer.init();
      if (disposed) return;

      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
      renderer.renderer.setAnimationLoop((now) => renderer?.render(now));
    })();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      renderer?.renderer.setAnimationLoop(null);
      renderer?.dispose();
      device?.destroy();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Harlem Mights Mights Sightline spatial glasses and compute puck concept"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        ...(style as CSSProperties | undefined),
      }}
    />
  );
}
