'use client';

import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useNavigationStore } from '../session/navigationStore';
import type { LocationSource } from '../view/locationSource';
import { useNavigationUi } from '../view/navigationUi.store';
import { configureNavigationRuntime, isLocationRunning, startLocation, stopLocation } from '../view/runtime';

let configured = false;

/**
 * Wires the navigation runtime into a host app. Call once, high in the tree
 * of the screen that shows directions.
 *
 * - Configures the platform's location source (once per app).
 * - Foreground only: stops the position feed when the app or tab goes to the
 *   background and restarts it on return if a trip from the device's
 *   location is still running. Nothing tracks position in the background.
 * - Online state: on the web, `navigator.onLine` and its events; native has
 *   no network module in this build, so it stays `undefined` and a failed
 *   request reports offline instead.
 */
export function useNavigationHost(locationSource: () => LocationSource): void {
  useEffect(() => {
    if (configured) return;
    configured = true;
    configureNavigationRuntime({ locationSource: locationSource() });
    // The source factory is read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let resumeOnActive = false;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (resumeOnActive) startLocation();
        resumeOnActive = false;
        return;
      }
      if (isLocationRunning()) {
        const session = useNavigationStore.getState().session;
        const fromDevice = 'origin' in session && session.origin.kind === 'device-location';
        resumeOnActive = fromDevice || useNavigationUi.getState().directionsPlaceId !== null;
        stopLocation();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof navigator === 'undefined') return;
    const { setOnline } = useNavigationUi.getState();
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
}
