import { tabletopSession } from '../runtime/tabletopSessionStore.ts';

/** Reuse SpatialScreen's closed view and the session panel's visible error. */
export function handleTabletopCanvasUnavailable(reason: string) {
  const session = tabletopSession.getState();
  if (session.mode !== 'solo' || !session.spatialViewOpen) return;
  session.reset();
  session.setError(
    reason === 'no-webgpu' || reason === 'no-adapter'
      ? 'Solo / AI needs WebGPU support. Try a supported browser or device.'
      : 'The 3D race is unavailable. Try Solo / AI again.',
  );
}
