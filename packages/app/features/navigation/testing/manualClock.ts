// Test-only deterministic clock and scheduler.
import type { ScheduleFn } from '../reroute/rerouteController.ts';

export interface ManualClock {
  now(): number;
  readonly schedule: ScheduleFn;
  /** Advances time and runs every timer that falls due, in order. */
  advance(ms: number): void;
  readonly pendingTimers: number;
}

export function createManualClock(startMs: number): ManualClock {
  let now = startMs;
  let seq = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  return {
    now: () => now,
    schedule(run, delayMs) {
      const id = (seq += 1);
      timers.set(id, { at: now + delayMs, run });
      return () => {
        timers.delete(id);
      };
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].run();
      }
      now = target;
    },
    get pendingTimers() {
      return timers.size;
    },
  };
}

/** A promise with its resolve/reject exposed, for controlling provider timing. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets pending promise callbacks run. */
export const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
