import type { HeadingSample } from '@acme/app/features/navigation/model/location.ts';
import type { LocationAvailability, LocationSource } from '@acme/app/features/navigation/view/locationSource.ts';
import { availabilityFromFix, fixFromBrowserPosition } from '@acme/app/features/navigation/view/locationSource.ts';

interface Permission { status: string; ios?: { accuracy?: string }; android?: { accuracy?: string } }
interface Subscription { remove(): void }
export interface ExpoLocationApi {
  getForegroundPermissionsAsync(): Promise<Permission>;
  requestForegroundPermissionsAsync(): Promise<Permission>;
  hasServicesEnabledAsync(): Promise<boolean>;
  watchPositionAsync(options: { accuracy: number; timeInterval: number; distanceInterval: number }, onPosition: (position: {
    coords: { latitude: number; longitude: number; accuracy: number | null; altitudeAccuracy: number | null; heading: number | null; speed: number | null };
    timestamp: number;
  }) => void, onError?: (reason: string) => void): Promise<Subscription>;
  watchHeadingAsync(onHeading: (heading: { trueHeading: number; magHeading: number; accuracy: number }) => void): Promise<Subscription>;
  Accuracy: { High: number };
}
function availability(permission: Permission): LocationAvailability {
  if (permission.status === 'denied') return 'denied';
  if (permission.status !== 'granted') return 'unknown';
  return permission.ios?.accuracy === 'reduced' || permission.android?.accuracy === 'coarse' ? 'approximate' : 'granted';
}

/** Foreground-only Expo feed. Async permission/setup completion cannot resurrect a stopped watch. */
export function createExpoLocationSource(api: ExpoLocationApi): LocationSource {
  return {
    kind: 'native',
    async check() {
      try { return await api.hasServicesEnabledAsync() ? availability(await api.getForegroundPermissionsAsync()) : 'disabled'; }
      catch { return 'unsupported'; }
    },
    watch(handlers) {
      let stopped = false;
      const subscriptions: Subscription[] = [];
      const retain = (subscription: Subscription) => { if (stopped) subscription.remove(); else subscriptions.push(subscription); };
      void (async () => {
        if (!await api.hasServicesEnabledAsync()) { if (!stopped) handlers.onAvailability('disabled'); return; }
        if (stopped) return;
        const permission = await api.requestForegroundPermissionsAsync();
        if (stopped) return;
        handlers.onAvailability(availability(permission));
        if (permission.status !== 'granted') return;
        retain(await api.watchPositionAsync({ accuracy: api.Accuracy.High, timeInterval: 1000, distanceInterval: 1 }, position => {
          if (stopped || position.coords.accuracy === null) return;
          const fix = fixFromBrowserPosition({ ...position, coords: { ...position.coords, accuracy: position.coords.accuracy } });
          if (!fix) return;
          handlers.onAvailability(availability(permission) === 'approximate' ? 'approximate' : availabilityFromFix(fix));
          handlers.onFix(fix);
        }, () => { if (!stopped) handlers.onAvailability('disabled'); }));
        if (stopped || !handlers.onHeading) return;
        try {
          retain(await api.watchHeadingAsync(value => {
            if (stopped || !Number.isFinite(value.trueHeading) || value.trueHeading < 0 || value.accuracy < 1) return;
            const heading: HeadingSample = { headingDeg: value.trueHeading, timestampMs: Date.now(), source: 'compass', accuracyDeg: value.accuracy === 3 ? 10 : value.accuracy === 2 ? 25 : 45 };
            handlers.onHeading?.(heading);
          }));
        } catch { /* Course from GPS remains available; don't invent a compass heading. */ }
      })().catch(() => { if (!stopped) handlers.onAvailability('disabled'); });
      return () => { stopped = true; subscriptions.forEach(subscription => subscription.remove()); subscriptions.length = 0; };
    },
  };
}
