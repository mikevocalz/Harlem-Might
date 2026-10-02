import { access, cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const targets = [
  ['apps/web/package.json', 'apps/web/public/canvaskit'],
  ['apps/storybook/package.json', 'apps/storybook/public/canvaskit'],
  ['apps/mobile/package.json', 'apps/mobile/public/canvaskit'],
  ['apps/web-vite/package.json', 'apps/web-vite/public/canvaskit'],
];

for (const [manifest, destination] of targets) {
  const req = createRequire(join(root, manifest));
  let source;
  try {
    source = dirname(req.resolve('canvaskit-wasm/bin/full/canvaskit.wasm'));
    await access(source);
  } catch {
    continue;
  }

  const target = join(root, destination);
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true, force: true });
}
