import { useLayoutEffect, type ReactNode } from 'react';
import type { MetaWindowPlacement, MetaWindowProps } from '@viro-external/meta-layout';
import { metaWindows } from './metaWindows';
import { useSpatialWindowHostStore } from './spatialWindowHost.store';

/**
 * Asks for `content` to show in its own Horizon window, rendered by
 * {@linkcode SpatialWindowHost} at the main surface's origin so presses
 * inside it work (ADR 0005).
 *
 * Returns the window's placement. Render the in-window fallback yourself
 * whenever it is not `spatial`: `pending` while the OS places it, `dropped`
 * when capacity or an error refused it, `inline` where nothing asks for a
 * window. The host never draws the content inline.
 *
 * Pass `window: null` to stay in the main window. Off the quest build, and
 * wherever spatial windows are unavailable, the window is never requested
 * and the result is always `inline`.
 *
 * `content` renders outside the caller's tree position, so it sees the
 * app root's providers only. Wrap it in any context it needs.
 */
export function useHostedSpatialWindow(
  window: MetaWindowProps | null,
  content: ReactNode,
): MetaWindowPlacement {
  const spatialAvailable = metaWindows.useSpatialAvailable();
  const requested = window != null && metaWindows.linked && spatialAvailable ? window : null;
  const label = requested?.label;
  const placement = metaWindows.usePlacement(label ?? '');
  const mount = useSpatialWindowHostStore((state) => state.mount);
  const unmount = useSpatialWindowHostStore((state) => state.unmount);

  useLayoutEffect(() => {
    if (requested) mount({ window: requested, content });
  });
  useLayoutEffect(() => {
    if (label == null) return;
    return () => unmount(label);
  }, [label, unmount]);

  return requested ? placement : 'inline';
}
