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

  const module: NativeMapModule = {
    // HostComponent's class statics (defaultProps) do not line up with a plain
    // ComponentType, and hybridRef's wrapper type only exists in the library.
    MapView: maps.MapboxMapView as unknown as NativeMapModule['MapView'],
    callback,
    supportsLocationPuck: maps.MapboxMaps.capabilities.supportsLocationPuck,
  };
  registerNativeMap(module);
}
