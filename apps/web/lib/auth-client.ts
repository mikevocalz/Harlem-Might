import { createHarlemAuthClient } from '@acme/auth/client';

export const authClient = createHarlemAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
});
