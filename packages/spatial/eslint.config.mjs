import { baseConfig } from '@acme/config/eslint/base.mjs';
import { FORBID_WEB_RENDERING_FROM_NATIVE } from '@acme/config/eslint/boundaries.mjs';

export default [
  ...baseConfig(),
  {
    files: ['**/*.native.ts', '**/*.native.tsx'],
    rules: {
      'no-restricted-imports': ['error', { patterns: FORBID_WEB_RENDERING_FROM_NATIVE }],
    },
  },
];
