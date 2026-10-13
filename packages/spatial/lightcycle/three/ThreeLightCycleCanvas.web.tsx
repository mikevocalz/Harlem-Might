'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { LightCycleMatchState } from '../tabletopCore';
import { ThreeLightCycleRenderer } from './ThreeLightCycleRenderer';
import { startCanvasSession } from '../../canvasSession';

export type ThreeLightCycleCanvasProps = {
  state?: LightCycleMatchState;
  getState?: () => LightCycleMatchState | null;
  assetUri?: string;
  mcpAssetUri?: string;
  style?: object;
  /** Lets the host close the failed view and present its existing fallback. */
  onUnavailable?: (reason: string) => void;
};

export function ThreeLightCycleCanvas({
  state,
  getState,
  assetUri,
  mcpAssetUri,
  style,
  onUnavailable,
}: ThreeLightCycleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousClose = useRef<Promise<void> | undefined>(undefined);
  const unavailableRef = useRef(onUnavailable);
  useEffect(() => { unavailableRef.current = onUnavailable; }, [onUnavailable]);
  const stateRef = useRef<LightCycleMatchState | null>(state ?? null);

  useEffect(() => {
    if (state) stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gpu = globalThis.navigator?.gpu;
    if (!canvas) return;
    if (!gpu) {
      unavailableRef.current?.('no-webgpu');
      return;
    }

    const session = startCanvasSession(previousClose.current, async (owner) => {
      let renderer: ThreeLightCycleRenderer | null = null;
      const adapter = await gpu.requestAdapter();
      if (!owner.active) return;
      if (!adapter) return owner.fail('no-adapter');

      const device = await adapter.requestDevice();
      owner.own(() => device.destroy());
      if (!owner.active) return;
      void device.lost.then((info) => {
        if (info.reason !== 'destroyed') owner.fail('device-lost');
      });

      const context = canvas.getContext('webgpu');
      if (!context) return owner.fail('no-context');

      const resize = () => {
        if (!owner.active) return;
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
      const ownedRenderer = renderer;
      owner.own(() => ownedRenderer.dispose());
      await renderer.init(assetUri, mcpAssetUri);
      if (!owner.active) return;

      const resizeObserver = new ResizeObserver(resize);
      owner.own(() => resizeObserver.disconnect());
      resizeObserver.observe(canvas);

      await renderer.renderer.setAnimationLoop((now) => {
        if (!owner.active) return;
        const snapshot = getState?.() ?? stateRef.current;
        if (snapshot) renderer?.render(snapshot, now);
      });
    }, (reason) => unavailableRef.current?.(reason));
    previousClose.current = session.closed;
    return session.close;
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
