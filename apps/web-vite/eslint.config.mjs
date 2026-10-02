import { baseConfig } from '@acme/config/eslint/base.mjs';
import { FORBID_DEEP_IMPORTS } from '@acme/config/eslint/boundaries.mjs';

export default [
  ...baseConfig(),
  /*
    FORBID_BACKEND_DIRECT (packages/config/eslint/boundaries.mjs:30) bans
    `payload`-shaped imports outside "the web app server code". This app IS
    that server code — the site renders CMS content through the @acme/payload
    client, and its boundary file is src/lib/payload.ts. The stock pattern
    also substring-matches '@/lib/payload', so the rule is redeclared here
    with an exact-name `paths` entry (payload SDK stays banned; the internal
    client and alias do not trip it) plus the deep-import guard.
  */
  {
    files: ['src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'payload',
              message:
                'Payload is accessed via @acme/payload (client) or the web app server code only.',
            },
          ],
          patterns: FORBID_DEEP_IMPORTS,
        },
      ],
    },
  },
  /*
    routeTree.gen.ts is written by the router plugin on every dev/build;
    public/canvaskit is vendored Emscripten output copied by postinstall.
  */
  {
    ignores: [
      'dist/**',
      '.output/**',
      '.vercel/**',
      '.tanstack/**',
      'public/**',
      'src/routeTree.gen.ts',
    ],
  },
];
