import assert from 'node:assert/strict';
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CLICommand } from 'payload';
import ts from 'typescript';

const maintenanceDirectory = fileURLToPath(new URL('.', import.meta.url));
const packageDirectory = path.resolve(maintenanceDirectory, '../..');
const packageJson = JSON.parse(readFileSync(path.join(packageDirectory, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
  exports: Record<string, string>;
};
const commands: Record<string, string> = {
  'seed:events': 'seed-events.ts',
  'seed:media': 'seed-media.ts',
  'seed:places': 'seed-places.ts',
  'patch:place-slugs': 'patch-place-slugs.ts',
  'seed:places-nyc': 'seed-places-nyc.ts',
  'seed:stories': 'seed-stories.ts',
  'seed:walks': 'seed-walks.ts',
  'publish:walks': 'publish-walks.ts',
  'publish:music-artists': 'publish-music-artists.ts',
  'enrich:osm': 'enrich-places-osm.ts',
  'enrich:menus': 'enrich-places-menus.ts',
  'link:media': 'link-place-media.ts',
  'seed:story-images': 'seed-story-lead-images.ts',
};
// These existing direct tools intentionally have no package-script alias.
const directCommands = ['fix-place-coords.ts', 'patch-place-locations.ts', 'purge-offtopic-media.ts'];

// Use the installed Payload CLI's own run handler and TypeScript resolver.
// Resolving a path must never initialize Payload or evaluate a maintenance tool.
const { createRunCommand } = await import(new URL('./cli/commands/run.js', import.meta.resolve('payload')).href) as {
  createRunCommand: CLICommand;
};
const { require: tsxRequire } = createRequire(import.meta.resolve('payload'))('tsx/cjs/api') as {
  require: { resolve: (specifier: string, fromFile: string, options: { paths: string[] }) => string };
};
const resolveModule = (specifier: string, fromFile: string) =>
  tsxRequire.resolve(specifier, fromFile, { paths: [path.dirname(fromFile)] });
// tsx appends a cache namespace to local TypeScript resolutions.
const physicalPath = (resolved: string) => realpathSync(resolved.split('?')[0]!);
const forbidden = () => { throw new Error('Config, database and network access are forbidden in command-path tests'); };

test('maintenance command names and the public runtime exports remain stable', () => {
  assert.deepEqual(Object.keys(packageJson.scripts).filter((name) => packageJson.scripts[name]!.includes('payload run ')).sort(), Object.keys(commands).sort());
  for (const [name, filename] of Object.entries(commands)) {
    assert.equal(packageJson.scripts[name], `PAYLOAD_CONFIG_PATH=src/payload.config.ts payload run src/maintenance/${filename}`);
  }
  assert.deepEqual(packageJson.exports, {
    '.': './index.ts',
    './server': './server.ts',
    './config': './src/payload.config.ts',
    './artist-photo-fetch': './src/artist-photo-fetch.ts',
  });
  for (const [subpath, target] of Object.entries(packageJson.exports)) {
    const specifier = subpath === '.' ? '@acme/payload' : `@acme/payload/${subpath.slice(2)}`;
    assert.equal(physicalPath(resolveModule(specifier, fileURLToPath(import.meta.url))), path.resolve(packageDirectory, target));
  }
});

test('Payload resolves every maintenance command and forwards arguments without executing its source', async (t) => {
  t.mock.method(globalThis, 'fetch', forbidden);
  const originalDirectory = process.cwd();
  const originalArgv = process.argv;
  process.chdir(packageDirectory);
  try {
    const scriptPaths = [
      ...Object.keys(commands).map((name) => packageJson.scripts[name]!.split('payload run ')[1]!),
      ...directCommands.map((filename) => `src/maintenance/${filename}`),
    ];
    for (const scriptPath of scriptPaths) {
      const filename = path.basename(scriptPath);
      const expectedUrl = pathToFileURL(path.join(packageDirectory, scriptPath)).href;
      const resolvedPaths: string[] = [];
      const resolver = registerHooks({
        resolve(specifier, context, nextResolve) {
          // Run Node's real file resolution first, then substitute an inert
          // module. None of the tool's imports or top-level code can execute.
          const resolved = nextResolve(specifier, context);
          assert.equal(resolved.url, expectedUrl, 'the run handler must load only the requested script');
          resolvedPaths.push(resolved.url);
          assert.deepEqual(process.argv, [process.execPath, fileURLToPath(expectedUrl), '--apply', '--limit=2']);
          return { ...resolved, url: `data:text/javascript,export {};#${filename}` };
        },
      });
      try {
        await createRunCommand.handler({
          args: { scriptPath, scriptArgs: ['--apply', '--limit=2'] },
          getConfig: forbidden, getPayload: forbidden, help: { commands: [], globalOptions: [], output: forbidden }, isJSON: false,
        });
      } finally {
        resolver.deregister();
      }
      assert.deepEqual(resolvedPaths, [expectedUrl]);
      assert.equal(process.argv, originalArgv);
    }
  } finally {
    process.chdir(originalDirectory);
  }
});

test('every moved module and its imports resolve through Payload’s TypeScript loader without evaluation', () => {
  const files = readdirSync(maintenanceDirectory, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
  assert.equal(files.length, 26, 'all 16 tools, nine helpers and the catalogue remain discoverable');
  for (const filename of files) {
    const absolutePath = path.join(maintenanceDirectory, filename);
    assert.equal(physicalPath(resolveModule(`./${filename}`, fileURLToPath(import.meta.url))), absolutePath);
    const source = ts.createSourceFile(absolutePath, readFileSync(absolutePath, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier.text;
      const resolved = resolveModule(specifier, absolutePath);
      assert.ok(resolved, `${filename}: ${specifier}`);
      if (specifier.startsWith('.')) {
        assert.ok(physicalPath(resolved).startsWith(`${packageDirectory}${path.sep}`), `${filename}: ${specifier}`);
      }
    }
  }
});
