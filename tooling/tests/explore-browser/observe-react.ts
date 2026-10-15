// Only observe subscription ownership. React owns rendering, effects, refs and
// scheduling, and calls the original real useSyncExternalStore below.
import * as React from 'actual-react';
export * from 'actual-react';

type Subscribe = (listener: () => void) => () => void;
export const names = new Map<Subscribe, string>();
export const ownership = new Map<string, { active: number; added: number; removed: number; delivered: number }>();
export function useSyncExternalStore<T>(subscribe: Subscribe, read: () => T, server?: () => T): T {
  const observed = React.useMemo(() => (listener: () => void) => {
    const name = names.get(subscribe) ?? 'other';
    const row = ownership.get(name) ?? { active: 0, added: 0, removed: 0, delivered: 0 };
    ownership.set(name, row);
    row.active++; row.added++;
    const unsubscribe = subscribe(() => { row.delivered++; listener(); });
    let active = true;
    return () => {
      if (!active) throw new Error(`Subscription released twice: ${name}`);
      active = false;
      unsubscribe();
      row.active--; row.removed++;
    };
  }, [subscribe]);
  return React.useSyncExternalStore(observed, read, server);
}
export default { ...React, useSyncExternalStore };
