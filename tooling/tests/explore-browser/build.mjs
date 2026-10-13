import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
export const defaultSource = path.resolve(here, '../../..');
export const mutations = ['focus-before-commit', 'ignore-guidance', 'old-modal-policy'];

export async function buildFixture({ source = defaultSource, output, mutation } = {}) {
  if (mutation && !mutations.includes(mutation)) throw new Error(`Unknown mutation: ${mutation}`);
  const packageJson = JSON.parse(readFileSync(path.join(here, 'package.json'), 'utf8'));
  const catalog = readFileSync(path.join(source, 'pnpm-workspace.yaml'), 'utf8');
  for (const [name, version] of Object.entries(packageJson.dependencies)) {
    if (name === 'esbuild') continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`^  ["']?${escaped}["']?: ${version.replaceAll('.', '\\.')}\\s*$`, 'm').test(catalog)) {
      throw new Error(`Browser fixture pin drifted from the production catalog: ${name}@${version}`);
    }
  }
  const deps = path.join(here, 'node_modules');
  const reactFile = require.resolve('react');
  const aliases = {
    'actual-react': reactFile,
    'react-native': require.resolve('react-native-web'),
    '@acme/ui/tw': path.join(source, 'packages/ui/tw.tsx'),
    '@acme/ui/icons': path.join(source, 'packages/ui/icons.web.ts'),
    '@acme/theme': path.join(source, 'packages/theme/index.ts'),
  };
  let applied = !mutation;
  const result = await build({
    entryPoints: [path.join(here, 'fixture.tsx')], bundle: true, write: false,
    platform: 'browser', format: 'iife', jsx: 'automatic', target: 'chrome120',
    tsconfigRaw: { compilerOptions: { jsx: 'react-jsx', target: 'ES2022' } },
    nodePaths: [deps], preserveSymlinks: true, metafile: true,
    resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
    define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_MAPBOX_TOKEN': 'undefined', 'process.env.EXPO_PUBLIC_MAPBOX_TOKEN': 'undefined', __DEV__: 'true' },
    plugins: [{ name: 'bounded-production-browser-fixture', setup(api) {
      api.onResolve({ filter: /^(react|actual-react|solito\/.*|@acme\/.*|react-native)$/ }, (args) => {
        if (args.path === 'react') {
          // ReactDOM itself sees the original React object, avoiding any second
          // renderer/React copy. Product/hooks use the pass-through observer.
          return { path: /node_modules[\\/](react|react-dom)[\\/]/.test(args.importer) ? reactFile : path.join(here, 'observe-react.ts') };
        }
        if (aliases[args.path]) return { path: aliases[args.path] };
        if (args.path.startsWith('@acme/app/')) return { path: path.join(source, 'packages/app', args.path.slice('@acme/app/'.length)) };
        if (args.path === '@acme/ui') return { path: 'ui', namespace: 'real-ui' };
        if (args.path === '@acme/ui/mights') return { path: 'mights', namespace: 'real-mights' };
        if (['solito/navigation', 'solito/link', 'solito/image'].includes(args.path)) return { path: path.join(here, 'platform.tsx') };
        throw new Error(`Unexpected platform dependency: ${args.path}`);
      });
      api.onResolve({ filter: /^\.\/ExploreMap$/ }, ({ importer }) => {
        if (importer.endsWith('/MapRegion.tsx')) return { path: path.join(here, 'platform.tsx') };
      });
      api.onLoad({ filter: /.*/, namespace: 'real-ui' }, () => ({
        contents: `export { MotionView } from ${JSON.stringify(path.join(source, 'packages/ui/motion.tsx'))}; export { transitionFor, useReducedMotion } from ${JSON.stringify(path.join(source, 'packages/ui/reduced-motion.ts'))};`,
        loader: 'ts', resolveDir: source,
      }));
      api.onLoad({ filter: /.*/, namespace: 'real-mights' }, () => ({
        contents: ['MightsButton', 'MightsType', 'MightsLocationStamp', 'MightsMapImage', 'routes'].map((name) => `export * from ${JSON.stringify(path.join(source, 'packages/ui/mights', `${name}.${name === 'routes' ? 'ts' : 'tsx'}`))};`).join('\n'),
        loader: 'ts', resolveDir: source,
      }));
      api.onResolve({ filter: /^harlem-source\// }, ({ path: id }) => ({ path: path.join(source, id.slice('harlem-source/'.length)) }));
      // Always resolve public runtime packages from this lockfile, never from a
      // half-installed monorepo graph. Workspace imports remain production code.
      api.onResolve({ filter: /^(react-dom(?:\/.*)?|react\/.*|zustand(?:\/.*)?|react-native-web(?:\/.*)?|react-native-css|@expo\/html-elements|tailwind-variants|tailwind-merge|lucide-react|@legendapp\/motion)$/ }, ({ path: id }) => ({ path: require.resolve(id) }));
      if (mutation) api.onLoad({ filter: /(?:SheetRegion\.tsx|navigation\/ui\/hooks\.ts)$/ }, async ({ path: file }) => {
        let contents = readFileSync(file, 'utf8');
        if (mutation === 'old-modal-policy') {
          const statement = contents.match(/const modal = [^;]+;/)?.[0];
          if (file.endsWith('SheetRegion.tsx') && statement?.includes('phone') && statement.includes("detent === 'full'")) {
            contents = contents.replace(statement, "const modal = !!selected && phone && detent === 'full';"); applied = true;
          }
          return { contents, loader: file.endsWith('tsx') ? 'tsx' : 'ts', resolveDir: path.dirname(file) };
        }
        const before = mutation === 'focus-before-commit'
          ? ': () => requestDetailsFocus({ placeId: selected.id })'
          : "return useNavigationStore((s) => 'activeRoute' in s.session);";
        const after = mutation === 'focus-before-commit'
          ? ': () => document.getElementById(SHEET_TITLE_ID)?.focus()'
          : 'return false;';
        if (contents.includes(before)) { contents = contents.replace(before, after); applied = true; }
        return { contents, loader: file.endsWith('tsx') ? 'tsx' : 'ts', resolveDir: path.dirname(file) };
      });
    } }],
  });
  if (!applied) throw new Error(`Mutation did not apply: ${mutation}`);
  const inputs = Object.keys(result.metafile.inputs);
  for (const required of ['MapRegion.tsx', 'navigation/ui/NavigationHud.tsx', 'ui/motion.tsx', 'SheetRegion.tsx', 'explore-actions.ts', 'use-media-query.ts', 'navigation/ui/hooks.ts', 'navigation/ui/DirectionsPanel.tsx', 'ui/tw.tsx', 'ui/html/dom.web.tsx', 'ui/html/css.web.tsx', 'ui/mights/MightsButton.tsx', 'ui/mights/MightsType.tsx']) {
    if (!inputs.some((file) => file.endsWith(required))) throw new Error(`Missing production module: ${required}`);
  }
  const html = '<!doctype html><html lang="en"><meta charset="utf-8"><title>Harlem real browser contracts</title><body><h1>Harlem real browser contracts</h1><pre id="browser-results" data-status="running">Running</pre><script>' + result.outputFiles[0].text.replaceAll('</script', '<\\/script') + '</script></body></html>';
  if (output) {
    mkdirSync(output, { recursive: true });
    writeFileSync(path.join(output, 'fixture.html'), html);
    writeFileSync(path.join(output, 'metafile.json'), JSON.stringify(result.metafile, null, 2));
  }
  return html;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildFixture({ source: process.env.HARLEM_SOURCE_ROOT ?? defaultSource, output: process.env.HARLEM_BROWSER_OUTPUT ?? path.join(here, 'dist'), mutation: process.env.HARLEM_BROWSER_MUTATION });
  console.log('Compiled actual production SheetRegion, DirectionsPanel, hooks and shared UI with pinned React/ReactDOM. Browser execution is a separate required stage.');
}
