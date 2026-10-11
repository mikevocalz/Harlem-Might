import { createElement } from 'react';
import { NitroModules, callback } from 'react-native-nitro-modules';
import { registerNativeMap, type NativeMapModule } from '@acme/app';
import { mapboxTokenFromEnv } from '@acme/app/features/navigation/providers/mapboxToken.ts';
import { isHorizonBuild } from '../spatial/horizonBuild';

/**
 * Hands Explore the native Mapbox map view on phones and foldables
 * (docs/adr/0007-native-mapbox-map-mobile.md). Explore keeps the schematic
 * when this registers nothing:
 *
 * - the quest build (`isHorizonBuild`): the headset keeps the schematic until
 *   a Mapbox SDK is supported on Horizon OS (DECISIONS S16);
 * - a build that does not link the `MapboxMapView` hybrid view;
 * - no public `pk.` token in `EXPO_PUBLIC_MAPBOX_TOKEN`.
 *
 * The library modules are required lazily, so nothing touches their native
 * objects on a build that skips the map.
 */
export function registerExploreNativeMap(): void {
  if (isHorizonBuild) return;
  if (!NitroModules.hasHybridObject('MapboxMapView') || !NitroModules.hasHybridObject('MapboxAR')) return;
  const token = mapboxTokenFromEnv();
  if (token.kind !== 'public') return;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MapboxAR } = require('@mikevocalz/nitro-mapbox-ar') as typeof import('@mikevocalz/nitro-mapbox-ar');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const maps = require('@mikevocalz/nitro-mapbox-ar-maps') as typeof import('@mikevocalz/nitro-mapbox-ar-maps');
  if (!maps.MapboxMaps.isMapViewAvailable) return;

  // The view reads this process-wide token when it creates its native map.
  MapboxAR.accessToken = token.token;

  // Nitro's host component is a string element type, like every native host
  // component. @acme/ui/tw's View is an @expo/html-elements Div, which throws in
  // dev on any string-typed child ("unsupported React DOM element"), so Explore
  // gets a function component that renders the host component instead.
  const HostMapView = maps.MapboxMapView;
  const MapView = (props: object) => createElement(HostMapView as never, props);
  MapView.displayName = 'MapboxMapView';

  const module: NativeMapModule = {
    // hybridRef's wrapper type only exists in the library.
    MapView: MapView as unknown as NativeMapModule['MapView'],
    callback,
    supportsLocationPuck: maps.MapboxMaps.capabilities.supportsLocationPuck,
  };
  registerNativeMap(module);
}
