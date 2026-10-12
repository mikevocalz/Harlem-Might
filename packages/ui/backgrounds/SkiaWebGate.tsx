'use client';

import { useEffect, type ComponentType, type ReactNode } from 'react';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { useInstanceStore, useStore } from '../use-instance-store';

type ModuleWithDefault<P extends object> = { default: ComponentType<P> };

let skiaReady: Promise<void> | null = null;

function prepareSkia() {
  skiaReady ??= Promise.resolve()
    .then(() => LoadSkiaWeb({ locateFile: (file) => `/canvaskit/${file}` }))
    .catch((error: unknown) => {
      // Share pending/successful work, but allow a later gate to retry a failure.
      skiaReady = null;
      throw error;
    });
  return skiaReady;
}

export function SkiaWebGate<P extends object>({
  load,
  props,
  fallback,
}: {
  load: () => Promise<ModuleWithDefault<P>>;
  props: P;
  fallback?: ReactNode;
}) {
  const store = useInstanceStore(() => ({
    loaded: null as { load: typeof load; Component: ComponentType<P> } | null,
  }));
  const loaded = useStore(store, (state) => state.loaded);
  const Component = loaded?.load === load ? loaded.Component : null;

  useEffect(() => {
    let active = true;
    void prepareSkia()
      .then(() => active ? load() : null)
      .then((module) => {
        if (active && module) store.setState({ loaded: { load, Component: module.default } });
      })
      .catch(() => {
        // Initialization and lazy-import errors keep this gate on its fallback.
        // Retry only on a later mount or a different load callback.
        if (active) store.setState({ loaded: null });
      });
    return () => {
      active = false;
    };
  }, [load, store]);

  return Component ? <Component {...props} /> : (fallback ?? null);
}
