'use client';
// Repo rule: zustand always, never React useState. For component-local state
// (multi-instance safe), hold a vanilla store in a ref and subscribe with
// useStore — refs are stable containers, not React state.
import { useRef } from 'react';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';

export function useInstanceStore<S>(init: () => S): StoreApi<S> {
  const ref = useRef<StoreApi<S> | null>(null);
  ref.current ??= createStore<S>(() => init());
  return ref.current;
}

export { useStore };
