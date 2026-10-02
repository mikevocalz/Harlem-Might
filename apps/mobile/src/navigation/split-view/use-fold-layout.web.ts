'use client';

import { useSyncExternalStore } from 'react';
import {
  foldsFromViewportSegments,
  type FoldLayout,
  type ViewportSegmentLike,
} from './fold-layout';

export interface WebFoldSnapshot {
  posture: 'continuous' | 'folded';
  segments: readonly ViewportSegmentLike[];
  folds: readonly FoldLayout[];
}

type DevicePostureLike = EventTarget & {
  type?: 'continuous' | 'folded';
};

type ViewportLike = {
  segments?: readonly DOMRect[];
};

type FoldableNavigator = Navigator & {
  devicePosture?: DevicePostureLike;
};

type FoldableWindow = Window & {
  viewport?: ViewportLike;
};

const SERVER_SNAPSHOT: WebFoldSnapshot = {
  posture: 'continuous',
  segments: [],
  folds: [],
};

let snapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();
let listening = false;

function readSnapshot(): WebFoldSnapshot {
  if (typeof window === 'undefined') return SERVER_SNAPSHOT;

  const posture =
    (navigator as FoldableNavigator).devicePosture?.type === 'folded'
      ? 'folded'
      : 'continuous';

  const segments = [
    ...((window as FoldableWindow).viewport?.segments ?? []),
  ].map((segment) => ({
    x: segment.x,
    y: segment.y,
    width: segment.width,
    height: segment.height,
  }));

  return {
    posture,
    segments,
    folds: foldsFromViewportSegments(segments, posture),
  };
}

function sameSnapshot(a: WebFoldSnapshot, b: WebFoldSnapshot) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function refresh() {
  const next = readSnapshot();
  if (sameSnapshot(snapshot, next)) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

function startListening() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  snapshot = readSnapshot();

  window.addEventListener('resize', refresh);
  (navigator as FoldableNavigator).devicePosture?.addEventListener('change', refresh);
}

function stopListening() {
  if (!listening || typeof window === 'undefined' || listeners.size > 0) return;
  listening = false;

  window.removeEventListener('resize', refresh);
  (navigator as FoldableNavigator).devicePosture?.removeEventListener('change', refresh);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  startListening();
  return () => {
    listeners.delete(listener);
    stopListening();
  };
}

export function useWebFoldSnapshot() {
  return useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
}

export function useFoldLayouts() {
  return useWebFoldSnapshot().folds;
}

export function useDevicePosture() {
  return useWebFoldSnapshot().posture;
}
