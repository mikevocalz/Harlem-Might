'use client';

import { useEffect, useRef } from 'react';
import { GpuCanvas } from '@acme/ui/primitives';
import { SightlineHeroRenderer } from './SightlineHeroRenderer';
import { startCanvasSession } from '../canvasSession';

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
  const previousClose = useRef<Promise<void> | undefined>(undefined);
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

    const session = startCanvasSession(previousClose.current, async (owner) => {
      let renderer: SightlineHeroRenderer | null = null;
      const draw = (now: number) => {
        if (!owner.active) return;
        renderer?.setProgress(getProgress?.() ?? 0);
        renderer?.render(now, reducedMotion);
      };

      const adapter = await gpu.requestAdapter();
      if (!owner.active) return;
      if (!adapter) return owner.fail('no-adapter');

      const device = await adapter.requestDevice();
      owner.own(() => device.destroy());
      if (!owner.active) return;
      // destroy() on unmount also resolves `lost`; only an unexpected loss is a failure.
      void device.lost.then((info) => {
        if (info.reason !== 'destroyed') owner.fail('device-lost');
      });

      // Cast: apps whose lib config lacks the WebGPU getContext overload resolve this to RenderingContext.
      const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
      if (!context) return owner.fail('no-context');

      const resize = () => {
        if (!owner.active) return;
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

      renderer = new SightlineHeroRenderer({
        context,
        device,
        width: canvas.width,
        height: canvas.height,
      });
      const ownedRenderer = renderer;
      owner.own(() => ownedRenderer.dispose());
      await renderer.init();
      if (!owner.active) return;

      const resizeObserver = new ResizeObserver(resize);
      owner.own(() => resizeObserver.disconnect());
      resizeObserver.observe(canvas);

      if (reducedMotion) {
        draw(performance.now());
      } else {
        await renderer.renderer.setAnimationLoop(draw);
      }
      if (owner.active) callbacks.current.onReady?.();
    }, (reason) => callbacks.current.onUnavailable?.(reason));
    previousClose.current = session.closed;
    return session.close;
  }, [getProgress, reducedMotion]);

  return (
    <GpuCanvas ref={canvasRef} role="img" aria-label={ariaLabel} className={className} />
  );
}
