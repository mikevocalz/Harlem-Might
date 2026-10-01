import { baseConfig } from '@acme/config/eslint/base.mjs';
import {
  FORBID_BACKEND_DIRECT,
  FORBID_DEEP_IMPORTS,
  FORBID_DIRECT_PLATFORM_UI,
  FORBID_REACT_NATIVE_VISUAL_PATH,
  FORBID_WEB_RENDERING_FROM_NATIVE,
} from '@acme/config/eslint/boundaries.mjs';

const sharedPatterns = [
  ...FORBID_BACKEND_DIRECT,
  ...FORBID_DEEP_IMPORTS,
  ...FORBID_DIRECT_PLATFORM_UI,
];

export default [
  ...baseConfig(FORBID_DIRECT_PLATFORM_UI),
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [FORBID_REACT_NATIVE_VISUAL_PATH],
          patterns: sharedPatterns,
        },
      ],
    },
  },
  {
    files: ['**/*.native.ts', '**/*.native.tsx', '**/*.shared.ts', '**/*.shared.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [FORBID_REACT_NATIVE_VISUAL_PATH],
          patterns: [...sharedPatterns, ...FORBID_WEB_RENDERING_FROM_NATIVE],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'Use a *.web file for browser globals; shared/native code must run under Metro.',
        },
        {
          name: 'document',
          message: 'Use a *.web file for DOM APIs; shared/native code must run under Metro.',
        },
      ],
    },
  },
];
