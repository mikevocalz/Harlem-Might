import type { NextConfig } from 'next'
import { withPayload } from '@payloadcms/next/withPayload'

// Turbopack (Next 16 default). webpack is unusable in this workspace — its
// FileSystemInfo snapshot walker dies with RangeError on the pnpm symlink
// forest. RN globals (__DEV__) come from a runtime shim imported in the root
// layout instead of DefinePlugin.
const nextConfig: NextConfig = {
  // Dev-only: the browser preview proxies localhost:3000 through 127.0.0.1,
  // which trips the dev-resource origin check and breaks HMR in that iframe.
  allowedDevOrigins: ['127.0.0.1'],
  // React Compiler — auto-memoization, same as the mobile app's
  // experiments.reactCompiler in app.config.ts.
  reactCompiler: true,
  experimental: {
    // NOTE: `viewTransition` was removed in Next 16.3 stable — React's
    // <ViewTransition> now works in the App Router with no configuration
    // (node_modules/next/dist/docs/01-app/02-guides/view-transitions.md).
    // Native Rust port of the compiler inside Turbopack (faster than the
    // Babel transform); experimental — remove if it misbehaves.
    turbopackRustReactCompiler: true,

    // Barrel-file tree shaking. `lucide-react` is already in Next's built-in
    // list (node_modules/next/dist/server/config.js) and the user list is
    // merged with it, so only the workspace barrels are named here — both
    // re-export their whole surface from a single index.
    optimizePackageImports: [
      '@acme/ui',
      '@acme/app',
      '@acme/spatial',
      '@tanstack/react-table',
      '@tanstack/react-form',
      '@tanstack/react-virtual',
    ],

    // Emit <style> instead of a render-blocking <link>, killing the CSS
    // request waterfall. The docs call out atomic CSS (Tailwind) as the case
    // where this pays off, which is exactly this app. Production-only — dev
    // still serves a stylesheet. TRADE-OFF: inlined CSS can't be cached
    // separately from the HTML, so returning visitors re-download it each
    // navigation; drop this if the audience is repeat-visit heavy.
    inlineCss: true,
  },

  // Dev DX: forwards browser console output into the terminal. Lived at
  // `experimental.browserDebugInfoInTerminal` until 16.3.1 moved it here.
  logging: {
    browserToTerminal: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // DO NOT add `experimental.scrollRestoration` here. It still exists in the
  // 16.3 config schema (config-shared.d.ts) so it looks available, but its only
  // consumer is shared/lib/router/router.js — the PAGES router. This app is App
  // Router, where scroll restoration on back/forward is built in and cannot be
  // toggled. To stop a navigation scrolling to top, pass `scroll={false}` on the
  // link or `router.push(href, { scroll: false })` instead.
  transpilePackages: [
    '@acme/ui',
    '@acme/app',
    '@acme/payload',
    '@expo/html-elements',
    'expo-paste-input',
    'expo-drag-drop-content-view',
    '@legendapp/motion',
    '@expo/ui',
    'expo-image',
    'expo-modules-core',
    'expo',
    'react-native',
    'react-native-web',
    'react-native-enriched-html',
    'react-native-gesture-handler',
    '@reactvision/react-viro',
    '@reactvision/viro-web-renderer',
    '@shopify/react-native-skia',
    '@rive-app/react-webgl2',
    'solito',
  ],
  turbopack: {
    resolveAlias: {
      // React Native Skia's web bundle retains guarded Node/Metro branches.
      // Turbopack needs the browser-only aliases that Skia documents for
      // webpack expressed with its conditional alias syntax.
      fs: { browser: './lib/skia-empty.ts' },
      path: { browser: './lib/skia-empty.ts' },
      os: { browser: './lib/skia-empty.ts' },
      'react-native/Libraries/Image/AssetRegistry': 'react-native-web/dist/modules/AssetRegistry',
      'react-native': 'react-native-web',
      // RNGH's compiled ESM uses explicit .js imports, which bypass platform
      // extension selection and pull native Fabric specs into Turbopack.
      // Resolve the package root to source so .web.ts/.web.tsx wins normally.
      'react-native-gesture-handler': 'react-native-gesture-handler/src/index.ts',
    },
    resolveExtensions: [
      '.web.tsx', '.web.ts', '.web.js',
      '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json',
    ],
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
