'use client';

import { useEffect, useRef } from 'react';
import { GpuCanvas } from '@acme/ui/primitives';
import { SightlineHeroRenderer } from './SightlineHeroRenderer';

export interface SightlineHeroCanvasProps {
  /** Must be referentially stable: it is an effect dependency, and a new function rebuilds the GPU device. */
  getProgress?: () => number;
  /** Renders one frame and stops; resize redraws that frame. */
  reducedMotion?: boolean;
  className?: string;
  ariaLabel?: string;
  /** Called after the first frame is on the canvas. */
  onReady?: () => void;
  /** Called when there is no adapter, init throws, or the device is lost, so the host can swap in a fallback. */
  onUnavailable?: (reason: string) => void;
}

export function SightlineHeroCanvas({
  getProgress,
  reducedMotion = false,
  className,
  ariaLabel = 'Concept render of Sightline glasses and compute puck',
  onReady,
  onUnavailable,
}: SightlineHeroCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Callbacks live in a ref so a host re-render never rebuilds the device.
  const callbacks = useRef({ onReady, onUnavailable });
  useEffect(() => {
    callbacks.current = { onReady, onUnavailable };
  }, [onReady, onUnavailable]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gpu = globalThis.navigator?.gpu;
    if (!canvas) return;
    if (!gpu) {
      callbacks.current.onUnavailable?.('no-webgpu');
      return;
    }

    let disposed = false;
    let renderer: SightlineHeroRenderer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let device: GPUDevice | null = null;

    const fail = (reason: string) => {
      if (!disposed) callbacks.current.onUnavailable?.(reason);
    };

    const draw = (now: number) => {
      renderer?.setProgress(getProgress?.() ?? 0);
      renderer?.render(now, reducedMotion);
    };

    void (async () => {
      const adapter = await gpu.requestAdapter();
      if (disposed) return;
      if (!adapter) return fail('no-adapter');

      device = await adapter.requestDevice();
      if (disposed) {
        device.destroy();
        return;
      }
      // destroy() on unmount also resolves `lost`; only an unexpected loss is a failure.
      void device.lost.then((info) => {
        if (info.reason !== 'destroyed') fail('device-lost');
      });

      // Cast: apps whose lib config lacks the WebGPU getContext overload resolve this to RenderingContext.
      const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
      if (!context) return fail('no-context');

      const resize = () => {
        const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        renderer?.resize(width, height);
        // Reduced motion has no loop, so the one frame is redrawn at the new size.
        if (reducedMotion && renderer) draw(performance.now());
      };

      resize();
      context.configure({
        device,
        format: gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied',
      });

      try {
        renderer = new SightlineHeroRenderer({
          context,
          device,
          width: canvas.width,
          height: canvas.height,
        });
        await renderer.init();
      } catch {
        return fail('init-failed');
      }

      if (disposed) return;

      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);

      if (reducedMotion) {
        draw(performance.now());
      } else {
        renderer.renderer.setAnimationLoop(draw);
      }
      callbacks.current.onReady?.();
    })().catch(() => fail('init-failed'));

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      renderer?.renderer.setAnimationLoop(null);
      renderer?.dispose();
      device?.destroy();
    };
  }, [getProgress, reducedMotion]);

  return (
    <GpuCanvas ref={canvasRef} role="img" aria-label={ariaLabel} className={className} />
  );
}
