'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { LightCycleMatchState } from '../tabletopCore';
import { ThreeLightCycleRenderer } from './ThreeLightCycleRenderer';

export type ThreeLightCycleCanvasProps = {
  state?: LightCycleMatchState;
  getState?: () => LightCycleMatchState | null;
  assetUri?: string;
  mcpAssetUri?: string;
  style?: object;
};

export function ThreeLightCycleCanvas({
  state,
  getState,
  assetUri,
  mcpAssetUri,
  style,
}: ThreeLightCycleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<LightCycleMatchState | null>(state ?? null);

  useEffect(() => {
    if (state) stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gpu = navigator.gpu;
    if (!canvas || !gpu) return;

    let disposed = false;
    let renderer: ThreeLightCycleRenderer | null = null;
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
        const dpr = window.devicePixelRatio || 1;
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

      renderer = new ThreeLightCycleRenderer({
        context,
        device,
        width: canvas.width,
        height: canvas.height,
        assetUri,
      });
      await renderer.init(assetUri, mcpAssetUri);

      if (disposed) {
        renderer.dispose();
        device.destroy();
        return;
      }

      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);

      renderer.renderer.setAnimationLoop((now) => {
        const snapshot = getState?.() ?? stateRef.current;
        if (snapshot) renderer?.render(snapshot, now);
      });
    })();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      renderer?.renderer.setAnimationLoop(null);
      renderer?.dispose();
      device?.destroy();
    };
  }, [assetUri, getState, mcpAssetUri]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        ...(style as CSSProperties | undefined),
      }}
    />
  );
}
