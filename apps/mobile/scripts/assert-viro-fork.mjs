import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

let packageJsonPath;
try {
  packageJsonPath = require.resolve('@reactvision/react-viro/package.json');
} catch {
  console.error('[Viro] @reactvision/react-viro is not installed.');
  process.exit(1);
}

const root = dirname(packageJsonPath);
const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const platformSource = join(root, 'components/Utilities/ViroPlatform.ts');
const openXRSource = join(root, 'components/Utilities/VRModuleOpenXR.ts');
const metaTargetingSource = join(root, 'plugins/metaTargeting.ts');

const platformBody = existsSync(platformSource)
  ? readFileSync(platformSource, 'utf8')
  : '';
const openXRBody = existsSync(openXRSource)
  ? readFileSync(openXRSource, 'utf8')
  : '';

const hasPico = platformBody.includes('isPico');
const hasMetaHorizonRuntime = platformBody.includes('isMetaHorizonXR');
const hasRivePanel = existsSync(join(root, 'components/ViroRivePanel.tsx'));
const hasSpatialLayout = existsSync(
  join(root, 'components/Spatial/ViroSpatialLayout.tsx'),
);
const hasOpenXRBridge = existsSync(openXRSource);
const hasOpenXRCapabilityProbe =
  openXRBody.includes('getOpenXRRuntimeCapabilities');
const hasMetaVrGlassesTargeting =
  existsSync(metaTargetingSource) &&
  readFileSync(metaTargetingSource, 'utf8').includes(
    'metaVrGlassesCompatible',
  );

let nitroPackageJsonPath = null;
try {
  nitroPackageJsonPath = require.resolve('nitro-canvas-in-Vision/package.json');
} catch {
  // Checked after the Viro fork so the error tells the developer the complete
  // native/headset dependency set in one place.
}

const nitroRoot = nitroPackageJsonPath ? dirname(nitroPackageJsonPath) : null;
const nitroRiveBridgePath = nitroRoot
  ? join(
      nitroRoot,
      'android/src/main/java/com/margelo/nitro/nitrocanvasinVision/RiveCanvasBridge.kt',
    )
  : null;
const nitroRiveModulePath = nitroRoot
  ? join(
      nitroRoot,
      'android/src/main/java/com/margelo/nitro/nitrocanvasinVision/RiveCanvasModule.kt',
    )
  : null;
const nitroIndexPath = nitroRoot ? join(nitroRoot, 'src/index.ts') : null;

const hasNitroRiveGpuBridge =
  Boolean(nitroRiveBridgePath) &&
  existsSync(nitroRiveBridgePath) &&
  readFileSync(nitroRiveBridgePath, 'utf8').includes('RiveCanvasSession') &&
  readFileSync(nitroRiveBridgePath, 'utf8').includes('presentRiveFrame');

const hasNitroRiveNativeModule =
  Boolean(nitroRiveModulePath) &&
  existsSync(nitroRiveModulePath) &&
  readFileSync(nitroRiveModulePath, 'utf8').includes('NitroRiveCanvas');

const hasNitroRiveJsRuntime =
  Boolean(nitroIndexPath) &&
  existsSync(nitroIndexPath) &&
  readFileSync(nitroIndexPath, 'utf8').includes('createRiveCanvasRuntime');

const expoPeers = String(pkg.peerDependencies?.expo ?? '');
const rnPeers = String(pkg.peerDependencies?.['react-native'] ?? '');
const sdk58PeerLane =
  expoPeers.includes('<59') &&
  rnPeers.includes('<0.89');

const forkCompatible =
  sdk58PeerLane &&
  hasPico &&
  hasMetaHorizonRuntime &&
  hasRivePanel &&
  hasSpatialLayout &&
  hasOpenXRBridge &&
  hasOpenXRCapabilityProbe &&
  hasMetaVrGlassesTargeting;

if (!forkCompatible) {
  console.error(`
[Viro] Native/headset development requires the mikevocalz SDK-58 fork.

Resolved package:
  ${packageJsonPath}
Resolved version:
  ${pkg.version ?? 'unknown'}

The public @reactvision/react-viro package remains installed only so public
clones, web, Storybook and CI can resolve Viro without access to the private
fork. It is intentionally NOT accepted for Expo SDK 58 native/headset builds.

Enable the fork, reinstall, then retry:

  overrides:
    "@reactvision/react-viro": "github:mikevocalz/viro#decax9-three-panel"

  pnpm install

Required fork capabilities:
  Expo <59 peer lane
  React Native <0.89 peer lane
  PICO platform detection
  generalized Meta Horizon runtime detection
  Meta VR Glasses Store targeting
  ViroRivePanel
  ViroSpatialLayout
  VRModuleOpenXR
  typed OpenXR runtime capability probe
`);
  process.exit(1);
}

if (
  !nitroPackageJsonPath ||
  !hasNitroRiveGpuBridge ||
  !hasNitroRiveNativeModule ||
  !hasNitroRiveJsRuntime
) {
  console.error(`
[Spatial] Native/headset Rive panels require the private Nitro canvas package.

The Viro fork is present, but ViroRivePanel loads nitro-canvas-in-Vision lazily;
it is not bundled transitively by @reactvision/react-viro.

Install/link the current private package before running a native/headset build:

  pnpm --filter mobile add "nitro-canvas-in-Vision@github:mikevocalz/nitro-canvas-in-Vision#decax9-three-panel"

Required Nitro capabilities:
  createRiveCanvasRuntime
  Rive 11 RiveCanvasSession bridge
  NitroRiveCanvas native control module
  GPU frame presentation into the AHardwareBuffer Viro samples

Public web/CI clones do not need this private package unless they invoke a
native/headset command.
`);
  process.exit(1);
}

console.log(
  `[Viro] Native fork verified: ${pkg.version} (${packageJsonPath})`,
);
console.log(
  `[Spatial] Nitro Rive GPU bridge verified: ${nitroPackageJsonPath}`,
);
