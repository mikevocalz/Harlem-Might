import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const spatialEntry = join(root, 'packages/spatial/index.ts');
const spatialRequire = createRequire(spatialEntry);
const failures = [];

let typegpuBabel = null;
try {
  typegpuBabel = spatialRequire.resolve('unplugin-typegpu/babel');
  if (!existsSync(typegpuBabel)) {
    failures.push(`resolved TypeGPU Babel plugin does not exist: ${typegpuBabel}`);
  }
} catch (error) {
  failures.push(
    `@acme/spatial cannot resolve unplugin-typegpu/babel: ${error instanceof Error ? error.message : String(error)}`,
  );
}

for (const [label, configPath] of [
  ['Next', join(root, 'apps/web/babel.config.js')],
  ['Expo/Metro', join(root, 'apps/mobile/babel.config.js')],
]) {
  try {
    const configRequire = createRequire(configPath);
    const factory = configRequire(configPath);
    if (typeof factory !== 'function') {
      failures.push(`${label} Babel config does not export a function`);
      continue;
    }

    const config = factory({
      cache() {},
    });

    const plugins = Array.isArray(config?.plugins) ? config.plugins : [];
    const resolved = plugins.map((plugin) =>
      Array.isArray(plugin) ? plugin[0] : plugin,
    );

    if (
      typegpuBabel &&
      !resolved.some((plugin) => plugin === typegpuBabel)
    ) {
      failures.push(
        `${label} Babel config is not using the canonical TypeGPU compiler resolved from @acme/spatial`,
      );
    }
  } catch (error) {
    failures.push(
      `${label} Babel config cannot load: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

if (failures.length) {
  console.error('[spatial:verify-typegpu] TypeGPU toolchain drift detected:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  `[spatial:verify-typegpu] TypeGPU compiler resolves for Next + Metro: ${typegpuBabel}`,
);
