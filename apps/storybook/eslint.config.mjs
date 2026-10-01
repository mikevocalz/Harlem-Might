import { baseConfig } from '@acme/config/eslint/base.mjs';

export default [...baseConfig(), { ignores: ['storybook-static/**', 'public/canvaskit/**'] }];
