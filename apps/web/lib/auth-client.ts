import { createAuthClient } from 'better-auth/react';

// Auth is served by the Payload Better Auth plugin under the Payload API route
// (/payload-api/auth), not Better Auth's default /api/auth.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  basePath: '/payload-api/auth',
});
