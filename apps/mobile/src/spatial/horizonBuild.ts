import { requireOptionalNativeModule } from 'expo';

type HorizonModule = { isHorizonBuild?: boolean };

/**
 * True only in the `quest` flavor, from expo-horizon-core's `ExpoHorizon`
 * module. This is a build fact, not a device check: it decides whether Meta's
 * spatial window view manager was compiled in. `@expo-pico/core`'s
 * `metaLayoutSdk` strips the SDK from the pico and mobile flavors, so
 * rendering Meta's components there would fail.
 *
 * Read through `requireOptionalNativeModule` because the package's default
 * export throws on targets that do not link the module (iOS, web, node:test).
 */
export const isHorizonBuild: boolean =
  requireOptionalNativeModule<HorizonModule>('ExpoHorizon')?.isHorizonBuild ?? false;
