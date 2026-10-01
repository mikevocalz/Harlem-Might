import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

const rawSemanticTags = [
  'div', 'span', 'button', 'input', 'textarea', 'select',
  'main', 'section', 'header', 'footer', 'nav', 'p',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'li',
]

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['components/site/Landing.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: [
                'View', 'Text', 'Pressable', 'TextInput', 'Button', 'Switch',
                'Modal', 'ScrollView', 'FlatList', 'SectionList', 'Image',
              ],
              message: 'Visual primitives belong in @acme/ui.',
            },
          ],
          patterns: [
            {
              group: ['@expo/ui', '@expo/ui/*', '@expo/html-elements'],
              message: 'Platform UI belongs behind @acme/ui.',
            },
            {
              group: ['gsap', 'gsap/*'],
              message: 'GSAP is scoped to components/site/Landing.tsx for the public landing experience.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['app/(site)/**/*.tsx', 'components/site/**/*.tsx'],
    ignores: ['components/site/Landing.tsx', 'app/Document.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...rawSemanticTags.map((tag) => ({
          selector: `JSXOpeningElement[name.name='${tag}']`,
          message: `Raw <${tag}> is forbidden here. Use @acme/ui/html or an @acme/ui component.`,
        })),
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'public/viro/**',
    'public/canvaskit/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
