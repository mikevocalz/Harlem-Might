'use client';
import { useSyncExternalStore } from 'react';
import { navigationFixStore, useNavigationStore } from '../navigation/session/navigationStore.ts';
let now = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let stopSensors: (() => void) | undefined;
const listeners = new Set<() => void>();
function refresh() { now = Date.now(); listeners.forEach(notify => notify()); }
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    // Sensor/progress updates need a fresh evaluation time between ticks.
    // Keep the snapshot stable during render, without allowing future fixes.
    const fixes = navigationFixStore.subscribe(refresh);
    const navigation = useNavigationStore.subscribe(refresh);
    stopSensors = () => { fixes(); navigation(); };
    timer = setInterval(refresh, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer) clearInterval(timer);
      timer = undefined;
      stopSensors?.(); stopSensors = undefined;
    }
  };
}
export function useJourneyClock() { return useSyncExternalStore(subscribe, () => now, () => 0); }
