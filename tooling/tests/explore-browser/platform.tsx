// Controlled platform leaves: Solito's Next router context, links and image.
// Native History, URLSearchParams, DOM refs, focus and matchMedia stay real.
import React, { useSyncExternalStore } from 'react';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
window.addEventListener('popstate', notify);
for (const method of ['pushState', 'replaceState'] as const) {
  const original = window.history[method].bind(window.history);
  window.history[method] = (...args: Parameters<typeof original>) => { original(...args); notify(); };
}
const snapshot = () => window.location.search;
export function useSearchParams() { return new URLSearchParams(useSyncExternalStore(subscribe, snapshot, snapshot)); }
export function usePathname() { return window.location.pathname; }
export function useRouter() { return { back: () => window.history.back() }; }
export function Link(props: React.ComponentProps<'a'>) { return <a {...props} />; }
export function SolitoImage({ fill: _fill, contentFit: _fit, priority: _priority, ...props }: Record<string, unknown>) {
  return <img {...props as React.ComponentProps<'img'>} />;
}

// Mapbox's GPU/network canvas is outside this DOM ownership gate. The real
// MapRegion and NavigationHud above it, including Steps, remain production code.
export function ExploreMap() { return <div role="img" aria-label="Controlled map canvas" />; }
