import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// pnpm 12 is strict: the root package cannot resolve a dependency that belongs
// to apps/web. Resolve from the actual workspace that declares the renderer.
const webRequire = createRequire(join(root, 'apps/web/package.json'));

let rendererRoot;
try {
  rendererRoot = dirname(webRequire.resolve('@reactvision/viro-web-renderer/package.json'));
} catch {
  process.exit(0);
}

/**
 * Viro Web Renderer 1.0.0 supports explicit assetBaseUrl/slamBaseUrl, but its
 * unused fallbacks are static new URL("../wasm|slam/", import.meta.url)
 * expressions. Turbopack eagerly resolves those directories as JavaScript
 * modules before runtime options exist.
 *
 * This starter always copies the sidecars into /public/viro, so make the
 * renderer's fallbacks match those public URLs. Exact-match guards make this a
 * no-op as soon as an upstream release changes the implementation.
 */
async function patchRuntimeAssetFallbacks() {
  const patches = [
    {
      file: join(rendererRoot, 'dist/loader.js'),
      from: 'new URL("../wasm/", import.meta.url).href',
      to: '"/viro/wasm/"',
    },
    {
      file: join(rendererRoot, 'dist/slamLoader.js'),
      from: 'new URL("../slam/", import.meta.url).href',
      to: '"/viro/slam/"',
    },
  ];

  for (const patch of patches) {
    try {
      const source = await readFile(patch.file, 'utf8');
      if (!source.includes(patch.from)) continue;
      await writeFile(patch.file, source.replaceAll(patch.from, patch.to));
    } catch {
      // A future renderer layout can move these files. CI will expose the
      // unsupported package shape instead of silently rewriting unknown code.
    }
  }
}

await patchRuntimeAssetFallbacks();

const targets = [
  join(root, 'apps/web/public/viro'),
  join(root, 'apps/mobile/public/viro'),
];

for (const target of targets) {
  await mkdir(target, { recursive: true });
  for (const folder of ['wasm', 'slam']) {
    const source = join(rendererRoot, folder);
    try {
      await access(source);
      await cp(source, join(target, folder), { recursive: true, force: true });
    } catch {
      // A renderer release may omit an optional sidecar family.
    }
  }
}
