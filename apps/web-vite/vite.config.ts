/**
 * Harlem Might site build — TanStack Start on Vite, prerendering the public
 * routes to real HTML so the kit renders server-side through react-native-web.
 * Content comes from the Payload REST API that apps/web serves at
 * /payload-api; this app only reads, it never mounts the CMS.
 *
 * Plugin order is load-bearing: `reactNativeWeb` declares itself
 * `enforce:'pre'` and must strip Flow types off React Native's own `.js`
 * sources before any other transform reads them; `tanstackStart` then owns
 * routing/SSR and `viteReact` compiles our JSX last.
 *
 * SOT: node_modules/@tanstack/react-start/dist/esm/plugin/vite.d.ts:tanstackStart
 * SOT-KEYWORDS: web-vite vite config tanstack start ssr prerender react-native-web
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
// eslint-disable-next-line import/no-named-as-default -- published types declare only the default export
import reactNativeWeb from 'vite-plugin-react-native-web';
import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';

const src = fileURLToPath(new URL('./src', import.meta.url));

/*
 * @legendapp/motion is a peer-bearing variant, so pnpm keeps it out of the
 * root node_modules — a literal `../../node_modules/…` path is not stable.
 * Resolving its package.json from @acme/ui's own dependency context (the only
 * package that imports it) gives the real install location regardless of
 * where the layout puts it. `./package.json` is the one exports-listed
 * subpath; the ESM entry is reached by path from the package root.
 */
const acmeUiRequire = createRequire(
  fileURLToPath(new URL('../../packages/ui/package.json', import.meta.url)),
);
const legendMotionEsm = join(
  dirname(acmeUiRequire.resolve('@legendapp/motion/package.json')),
  'lib/module/index.js',
);

/*
 * @shopify/react-native-skia's web build `require`s
 * `react-native/Libraries/Image/AssetRegistry`; the RNW plugin rewrites it to
 * `react-native-web/Libraries/Image/AssetRegistry`, a path that does not
 * exist (RNW's module tree lives under dist/modules, not Libraries). The
 * absolute path mirrors the alias apps/web carries in next.config.ts and
 * keeps the optimizer from duplicating the module.
 */
const rnwRequire = createRequire(
  fileURLToPath(new URL('./package.json', import.meta.url)),
);
const rnwAssetRegistry = join(
  dirname(rnwRequire.resolve('react-native-web/package.json')),
  'dist/modules/AssetRegistry/index.js',
);

/**
 * The CommonJS members of react-native-web's dependency closure, plus
 * @legendapp/motion's. Vite's dev pipelines evaluate modules as ESM with no
 * CommonJS interop, so each of these has to be pre-bundled or the first
 * `module.exports =` throws — `exports is not defined` in the SSR runner, or
 * "does not provide an export named 'default'" in the browser.
 */
const CJS_DEPS = [
  '@legendapp/tools',
  '@legendapp/tools/react',
  '@react-native/normalize-colors',
  'fbjs/lib/invariant',
  'fbjs/lib/warning',
  'inline-style-prefixer/lib/createPrefixer',
  'inline-style-prefixer/lib/plugins/crossFade',
  'inline-style-prefixer/lib/plugins/imageSet',
  'inline-style-prefixer/lib/plugins/logical',
  'inline-style-prefixer/lib/plugins/position',
  'inline-style-prefixer/lib/plugins/sizing',
  'inline-style-prefixer/lib/plugins/transition',
  'memoize-one',
  'nullthrows',
  'postcss-value-parser',
  'styleq',
  'styleq/transform-localize-style',
];

/**
 * Re-asserts `global` → `globalThis` AFTER every other plugin has had its say.
 *
 * `vite-plugin-react-native-web` defines `global` as `self`, a browser-only
 * identifier that is wrong in the SSR/prerender pass running in Node. Vite
 * merges each plugin's `config()` result OVER the user config, so a top-level
 * `define.global` does not win — the plugin does. `enforce: 'post'` lands this
 * after RNW's `pre`.
 */
const globalAsGlobalThis: Plugin = {
  name: 'harlem:global-is-globalthis',
  enforce: 'post',
  config: () => ({ define: { global: 'globalThis' } }),
};

/*
 * `resolve.alias` never sees this specifier: the RNW plugin rewrites the
 * import to `react-native-web/Libraries/Image/AssetRegistry` itself and the
 * dep optimizer resolves that rewritten form without consulting the alias
 * table. A `pre` resolveId catches both spellings and hands back the real
 * file.
 */
const assetRegistryAlias: Plugin = {
  name: 'harlem:rnw-asset-registry',
  enforce: 'pre',
  resolveId(source) {
    if (
      source === 'react-native/Libraries/Image/AssetRegistry' ||
      source === 'react-native-web/Libraries/Image/AssetRegistry'
    ) {
      return rnwAssetRegistry;
    }
    return null;
  },
};

export default defineConfig({

  plugins: [
    /*
      Tailwind's own Vite plugin rather than the PostCSS one — with
      `node-linker=hoisted` the package sits at the workspace root and PostCSS
      resolution of the bare `@import 'tailwindcss'` misses it.
    */
    tailwindcss(),
    reactNativeWeb(),
    tanstackStart({
      // Every public route prerenders; the Payload reads are resilient, so a
      // build with the CMS down still emits real HTML with the offline state.
      prerender: { enabled: true, crawlLinks: true, failOnError: true },
      pages: [{ path: '/' }, { path: '/pages' }],
    }),
    /*
      Nitro compiles the server and emits the platform-native output. Left
      unconfigured — it detects the deploy target itself.
    */
    nitro(),
    viteReact(),
    assetRegistryAlias,
    globalAsGlobalThis,
  ],
  resolve: {
    alias: {
      '@': src,
      /*
       * @legendapp/motion's `exports["."]` points BOTH `import` and `require`
       * at a CJS index, so Vite's dev SSR module runner evaluates it raw and
       * dies on `exports is not defined`. The package ships an ESM build at
       * lib/module; point at it directly.
       */
      '@legendapp/motion': legendMotionEsm,
      'react-native/Libraries/Image/AssetRegistry': rnwAssetRegistry,
      'react-native-web/Libraries/Image/AssetRegistry': rnwAssetRegistry,
    },
  },
  ssr: {
    /*
     * These must be transformed rather than handed to Node's loader.
     *
     * The @acme/* packages are raw TypeScript. The expo/react-native families
     * are published for Metro, which resolves extensionless relative imports
     * and platform forks; Node's ESM loader does neither, so an externalised
     * module dies at prerender time. `react-native` itself MUST be listed —
     * externalised it bypasses the react-native-web alias and Node parses the
     * real package's Flow sources (`Unexpected token 'typeof'`).
     * react-native-web additionally ships no `exports` map, so Node would take
     * the CJS build and lose the named exports.
     */
    noExternal: [
      /^@acme\//,
      /^@shopify\//,
      'react-native',
      'react-native-web',
      /^@expo\//,
      /^expo(-|$)/,
      /^react-native-/,
      /^@legendapp\//,
      'solito',
      /*
       * react-native-web's own dependency closure. These CJS modules set
       * `exports.default` WITHOUT reassigning `module.exports`, so an
       * externalised ESM default import binds the namespace object rather
       * than the function. Rolled into the bundle, Rollup applies the interop.
       */
      '@react-native/normalize-colors',
      'fbjs',
      'inline-style-prefixer',
      'css-in-js-utils',
      'hyphenate-style-name',
      'memoize-one',
      'nullthrows',
      'postcss-value-parser',
      'styleq',
      'react-native-css',
      'use-sync-external-store',
      'lucide-react-native',
      'sonner-native',
      'uniwind',
      'tailwind-merge',
      'tailwind-variants',
    ],
    optimizeDeps: {
      include: CJS_DEPS,
      exclude: ['@shopify/react-native-skia', 'canvaskit-wasm'],
      rolldownOptions: { tsconfig: false },
    },
  },
  /*
   * Skia's web build cannot be dep-optimized: the RNW plugin rewrites its
   * `react-native/Libraries/Image/AssetRegistry` require to a path that only
   * the serve-time resolver (harlem:rnw-asset-registry) can map back to a real
   * file — the rolldown optimizer never consults it. canvaskit-wasm rides
   * along: its Emscripten bundle feature-detects Node with `require("fs")`,
   * which rolldown lowers to a `createRequire` import that does not exist in
   * a browser chunk. Both stay on the normal transform pipeline.
   */
  optimizeDeps: {
    include: CJS_DEPS,
    exclude: ['@shopify/react-native-skia', 'canvaskit-wasm'],
    rolldownOptions: { tsconfig: false },
  },
});
