'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { journeyController } from './runtime.ts';
export function useJourney() {
  const controller = journeyController();
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.hydrate(); }, [controller]);
  return state;
}
