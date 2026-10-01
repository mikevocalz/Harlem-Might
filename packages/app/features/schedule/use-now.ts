'use client';
import { useSyncExternalStore } from 'react';

const MS_PER_MINUTE = 60_000;

/**
 * A clock that ticks once a minute, shared by every subscriber.
 *
 * The snapshot is floored to the minute, so it is referentially stable between
 * ticks — a calendar rule that moves once a minute must not re-render the grid
 * sixty times a minute to do it. One interval serves all subscribers rather
 * than one per mounted calendar.
 *
 * `useSyncExternalStore` rather than state + effect: no `useState` anywhere in
 * this codebase, and the server snapshot has to be explicit for SSR.
 */
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();
let snapshot = Math.floor(Date.now() / MS_PER_MINUTE) * MS_PER_MINUTE;

function tick() {
  const next = Math.floor(Date.now() / MS_PER_MINUTE) * MS_PER_MINUTE;
  if (next === snapshot) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (intervalId === null) {
    // Poll faster than the minute we report so the rule lands near the turn of
    // the minute rather than up to 59s late.
    intervalId = setInterval(tick, 15_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

const getSnapshot = () => snapshot;

/**
 * The instant this module loaded, floored to the minute.
 *
 * Read at module scope so the hydration render can return a real time WITHOUT
 * calling `Date.now()` during render. That call was impure — React may re-run a
 * render, and each run produced a different clock — and it could never have
 * matched the server's markup anyway, which is the one thing the server
 * snapshot exists to guarantee. The first tick after mount corrects it.
 */
const SERVER_EPOCH = snapshot;
const getServerSnapshot = () => SERVER_EPOCH;

/** Current time, stable within the minute. */
export function useNow(): Date {
  const epoch = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return new Date(epoch);
}
