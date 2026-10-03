// @acme/auth/client — the Better Auth React client. Kept separate from the
// server entry so no bundle ever pulls in the pg Pool.

import { createAuthClient } from 'better-auth/react';

export function createHarlemAuthClient(options: { baseURL: string }) {
  return createAuthClient({ baseURL: options.baseURL });
}

export type HarlemAuthClient = ReturnType<typeof createHarlemAuthClient>;
