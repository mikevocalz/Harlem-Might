import { baseConfig } from '@acme/config/eslint/base.mjs';

// This package owns the Payload server integration, so Payload SDK imports
// are expected here while remaining restricted elsewhere in the workspace.
export default [...baseConfig(), { rules: { 'no-restricted-imports': 'off' } }];
