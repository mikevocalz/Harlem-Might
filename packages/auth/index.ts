// @acme/auth — Better Auth integration. Server and client are separate
// entrypoints ('@acme/auth/server', '@acme/auth/client') so app code never
// pulls the pg Pool into a bundle.

export { createHarlemAuthClient } from './src/client';
export type { HarlemAuthClient } from './src/client';
