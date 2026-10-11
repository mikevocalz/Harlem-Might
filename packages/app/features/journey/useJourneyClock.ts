'use client';
import { useSyncExternalStore } from 'react';
let now = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) { now = Date.now(); timer = setInterval(() => { now = Date.now(); listeners.forEach(notify => notify()); }, 1000); }
  return () => { listeners.delete(listener); if (listeners.size === 0 && timer) { clearInterval(timer); timer = undefined; } };
}
export function useJourneyClock() { return useSyncExternalStore(subscribe, () => now, () => 0); }
