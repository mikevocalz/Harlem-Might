'use client';

import { useEffect, useRef } from 'react';
import { PixelRatio } from 'react-native';
import type { CanvasRef } from 'react-native-webgpu';
import { Canvas, useDevice } from 'react-native-webgpu';
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
  const canvasRef = useRef<CanvasRef>(null);
  const previousClose = useRef<Promise<void> | undefined>(undefined);
  const unavailableRef = useRef(onUnavailable);
  useEffect(() => { unavailableRef.current = onUnavailable; }, [onUnavailable]);
  const stateRef = useRef<LightCycleMatchState | null>(state ?? null);
  const { device } = useDevice();

  useEffect(() => {
    if (state) stateRef.current = state;
  }, [state]);

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
      owner.own(() => renderer.dispose());
      await renderer.init(assetUri, mcpAssetUri);
      if (!owner.active) return;

      // Match react-native-webgpu's current ThreeJS example: let Three own
      // the display-rate animation callback, then explicitly present the RN
      // WebGPU surface from ThreeLightCycleRenderer.render().
      await renderer.renderer.setAnimationLoop((now) => {
        if (!owner.active) return;
        const snapshot = getState?.() ?? stateRef.current;
        if (snapshot) renderer.render(snapshot, now);
      });
    }, (reason) => unavailableRef.current?.(reason));
    previousClose.current = session.closed;
    return session.close;
  }, [assetUri, device, getState, mcpAssetUri]);

  return (
    <Canvas
      ref={canvasRef}
      opaque={false}
      style={[{ flex: 1 }, style]}
    />
  );
}
