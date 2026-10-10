"use client";
// Repo rule: zustand always, never React useState. For component-local state
// (multi-instance safe), create a vanilla store once per instance and
// subscribe with useStore. useMemo, not a ref: reading ref.current during
// render breaks react-hooks/refs and the React Compiler.
import { useMemo } from "react";
import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";

export function useInstanceStore<S>(init: () => S): StoreApi<S> {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one store per instance; init runs once
  return useMemo(() => createStore<S>(() => init()), []);
}

export { useStore };
