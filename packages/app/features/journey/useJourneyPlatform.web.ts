'use client';
import { useEffect } from 'react';
import { journeyController } from './runtime.ts';
import { useNavigationHost } from '../navigation/ui/useNavigationHost';
import { createBrowserLocationSource } from '../navigation/view/locationSource.ts';
const source = () => createBrowserLocationSource(typeof navigator === 'undefined' ? undefined : navigator.geolocation, typeof navigator === 'undefined' ? undefined : navigator.permissions);
export function useJourneyPlatform(): void {
  useNavigationHost(source);
  useEffect(() => {
    const check = () => { if (document.visibilityState === 'visible') void journeyController().checkIdentity(); };
    check(); window.addEventListener('focus', check); document.addEventListener('visibilitychange', check);
    return () => { window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, []);
}
