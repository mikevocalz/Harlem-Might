import { isHorizonBuild } from './horizonBuild';
import { createMetaWindows, type MetaLayoutModules } from './metaWindowsCore';

/**
 * The app's single Meta VR Layout SDK facade. Live in the quest flavor only;
 * elsewhere the requires below never run and every window renders inline.
 *
 * Kept on purpose although no Explore surface asks for a window since S17
 * (docs/spatial-layout/adr/0004-detail-in-window.md). The scene provider in
 * `app/_layout.tsx` costs one scene initializer and creates no window by
 * itself; `ExploreWorkspaceWindow` and `modules/spatial-window-owners` are
 * still on the render path and pass content through unchanged while the
 * workspace resolves every surface inline. Removing them would mean
 * re-proving the provider, the Compose view-tree owners and the
 * `useSpatialWindowState` wiring when the deferred "Open in new window"
 * returns.
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
