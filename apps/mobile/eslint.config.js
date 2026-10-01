// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const reactNativeVisuals = {
  name: 'react-native',
  importNames: [
    'View', 'Text', 'Pressable', 'TextInput', 'Button', 'Switch', 'Modal',
    'ScrollView', 'FlatList', 'SectionList', 'Image',
  ],
  message:
    'Visual primitives belong in @acme/ui. Direct react-native imports are reserved for non-visual platform APIs and hooks.',
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'public/canvaskit/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [reactNativeVisuals],
          patterns: [
            {
              group: ['@expo/ui', '@expo/ui/*', '@expo/html-elements'],
              message:
                'Expo UI is wrapped by @acme/ui. Consume the workspace UI contract instead of importing platform UI directly.',
            },
            {
              group: [
                'gsap', 'gsap/*', 'framer-motion', 'framer-motion/*', 'lenis', 'lenis/*',
                '@studio-freight/lenis', '@studio-freight/lenis/*',
                '@react-three/fiber', '@react-three/fiber/*',
                '@react-three/drei', '@react-three/drei/*',
              ],
              message:
                'Browser-only animation/rendering libraries stay out of apps/mobile; use Reanimated, Gesture Handler, Legend Motion, and Skia.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Browser globals are not available in the native app.' },
        { name: 'document', message: 'DOM APIs are not available in the native app.' },
      ],
    },
  },
]);
