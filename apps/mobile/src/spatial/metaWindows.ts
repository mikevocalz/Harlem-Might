import { isHorizonBuild } from './horizonBuild';
import { createMetaWindows, type MetaLayoutModules } from './metaWindowsCore';

/**
 * The app's single Meta VR Layout SDK facade. Live in the quest flavor only;
 * elsewhere the requires below never run and every window renders inline.
 *
 * Live since S18: the navigation rail is a promoted window on quest builds
 * (`AppTabBarHost`, ADR 0005). Every window renders from
 * `SpatialWindowHost` at the main surface's origin; `ExploreWorkspaceWindow`
 * routes through the same host for the deferred "Open in new window".
 */
export const metaWindows = createMetaWindows(isHorizonBuild, () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const layout = require('@metavr/layout-compat');
  const window = require('@metavr/layout-window-compat');
  const owners = require('../../modules/spatial-window-owners');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    layout: {
      SpatialSceneProvider: layout.SpatialSceneProvider,
      useSpatialScene: layout.useSpatialScene,
    },
    window: {
      SpatialWindow: window.SpatialWindow,
      createWindowScene: window.createWindowScene,
      useSpatialWindowState: window.useSpatialWindowState,
    },
    windowOwners: owners.SpatialWindowOwners,
  } as MetaLayoutModules;
});
