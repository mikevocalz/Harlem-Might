'use client';

import { useEffect, useRef } from 'react';
import { PixelRatio } from 'react-native';
import type { CanvasRef } from 'react-native-webgpu';
import { Canvas, useDevice } from 'react-native-webgpu';
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
  const canvasRef = useRef<CanvasRef>(null);
  const rendererRef = useRef<ThreeLightCycleRenderer | null>(null);
  const stateRef = useRef<LightCycleMatchState | null>(state ?? null);
  const { device } = useDevice();

  useEffect(() => {
    if (state) stateRef.current = state;
  }, [state]);

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
      const dpr = PixelRatio.get();
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

      context.configure({
        device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied',
      });

      const renderer = new ThreeLightCycleRenderer({
        context,
        device,
        width: canvas.width,
        height: canvas.height,
        assetUri,
      });
      rendererRef.current = renderer;
      await renderer.init(assetUri, mcpAssetUri);
      if (cancelled) {
        renderer.dispose();
        return;
      }

      // Match react-native-webgpu's current ThreeJS example: let Three own
      // the display-rate animation callback, then explicitly present the RN
      // WebGPU surface from ThreeLightCycleRenderer.render().
      renderer.renderer.setAnimationLoop((now) => {
        const snapshot = getState?.() ?? stateRef.current;
        if (snapshot) renderer.render(snapshot, now);
      });
    };

    void start();

    return () => {
      cancelled = true;
      rendererRef.current?.renderer.setAnimationLoop(null);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [assetUri, device, getState, mcpAssetUri]);

  return (
    <Canvas
      ref={canvasRef}
      opaque={false}
      style={[{ flex: 1 }, style]}
    />
  );
}
