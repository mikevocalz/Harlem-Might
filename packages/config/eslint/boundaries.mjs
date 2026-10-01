/**
 * Dependency-direction rules, enforced as CI-failing lint.
 * Compose into a flat config: `boundaries()` for the workspace-wide baseline,
 * or `boundaries(FORBID_DOMAIN_FROM_UI)` etc. for stricter packages.
 */

// Browser motion/rendering systems must not enter the native app or shared
// package code that Metro can resolve.
export const FORBID_WEB_RENDERING_FROM_NATIVE = [
  {
    group: [
      'gsap',
      'gsap/*',
      'framer-motion',
      'framer-motion/*',
      'lenis',
      'lenis/*',
      '@react-three/fiber',
      '@react-three/fiber/*',
      '@react-three/drei',
      '@react-three/drei/*',
    ],
    message:
      'Browser-only animation/rendering libraries stay in apps/web or *.web files; native uses Reanimated and Gesture Handler.',
  },
];

// Backend SDKs are only touched through @acme/payload,
// and only from repositories inside packages/app/<domain>.
export const FORBID_BACKEND_DIRECT = [
  {
    group: ['payload', '@payloadcms/*'],
    message:
      'Payload is accessed via @acme/payload (client) or the web app server code only.',
  },
];

// Package boundaries: consume the index, never internals.
export const FORBID_DEEP_IMPORTS = [
  {
    group: ['@acme/*/src/*'],
    message: 'Deep imports bypass the package public API — import from the package index.',
  },
];

// Feature/app code consumes the workspace UI contract. Platform UI packages
// belong behind packages/ui so native/web implementations cannot drift.
export const FORBID_DIRECT_PLATFORM_UI = [
  {
    group: ['@expo/ui', '@expo/ui/*', '@expo/html-elements'],
    message: 'Platform UI belongs in @acme/ui. Import @acme/ui, @acme/ui/html, or @acme/ui/native instead.',
  },
];

export const FORBID_REACT_NATIVE_VISUAL_PATH = {
  name: 'react-native',
  importNames: [
    'View', 'Text', 'Pressable', 'TextInput', 'Button', 'Switch', 'Modal',
    'ScrollView', 'FlatList', 'SectionList', 'Image',
  ],
  message: 'Visual primitives must come from @acme/ui; React Native is reserved here for non-visual platform APIs/hooks.',
};

// packages/ui is pure presentation: no domains, no backends, no navigation.
export const FORBID_DOMAIN_FROM_UI = [
  {
    group: ['@acme/app', '@acme/app/*', '@acme/payload*'],
    message: 'packages/ui depends only on @acme/theme.',
  },
];

export function boundaries(extraPatterns = []) {
  return {
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...FORBID_BACKEND_DIRECT, ...FORBID_DEEP_IMPORTS, ...extraPatterns] },
      ],
    },
  };
}
