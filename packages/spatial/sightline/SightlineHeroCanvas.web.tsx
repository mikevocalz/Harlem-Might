'use client';

import { useEffect, useRef } from 'react';
import { GpuCanvas } from '@acme/ui/primitives';
import { SightlineHeroRenderer } from './SightlineHeroRenderer';

export interface SightlineHeroCanvasProps {
  getProgress?: () => number;
  reducedMotion?: boolean;
  className?: string;
}

export function SightlineHeroCanvas({
  getProgress,
  reducedMotion = false,
  className,
}: SightlineHeroCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gpu = globalThis.navigator?.gpu;
    if (!canvas || !gpu) return;

    let disposed = false;
    let renderer: SightlineHeroRenderer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let device: GPUDevice | null = null;

    void (async () => {
      const adapter = await gpu.requestAdapter();
      if (!adapter || disposed) return;

      device = await adapter.requestDevice();
      if (disposed) {
        device.destroy();
        return;
      }

      const context = canvas.getContext('webgpu');
      if (!context) {
        device.destroy();
        return;
      }

      const resize = () => {
        const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        renderer?.resize(width, height);
      };

      resize();
      context.configure({
        device,
        format: gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied',
      });

      renderer = new SightlineHeroRenderer({
        context,
        device,
        width: canvas.width,
        height: canvas.height,
      });
      await renderer.init();

      if (disposed) {
        renderer.dispose();
        device.destroy();
        return;
      }

      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);

      renderer.renderer.setAnimationLoop((now) => {
        renderer?.setProgress(getProgress?.() ?? 0);
        renderer?.render(now, reducedMotion);
      });
    })();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      renderer?.dispose();
      device?.destroy();
    };
  }, [getProgress, reducedMotion]);

  return (
    <GpuCanvas
      ref={canvasRef}
      aria-label="Harlem Mights Sightline spatial glasses and compute puck"
      className={className}
    />
  );
}
