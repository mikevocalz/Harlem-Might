import { baseConfig } from '@acme/config/eslint/base.mjs';
import {
  FORBID_DOMAIN_FROM_UI,
  FORBID_WEB_RENDERING_FROM_NATIVE,
} from '@acme/config/eslint/boundaries.mjs';

export default baseConfig([
  ...FORBID_DOMAIN_FROM_UI,
  ...FORBID_WEB_RENDERING_FROM_NATIVE,
]);
