import type { BetterAuthOptions } from 'better-auth';

export const PAYLOAD_API_ROUTE = '/payload-api';
export const AUTH_BASE_PATH = '/auth';

const siteURL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const webViteURL = process.env.WEB_VITE_URL || 'http://localhost:5173';

export const AUTH_ORIGINS = [...new Set([
  siteURL,
  webViteURL,
  ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
])];

export const betterAuthOptions = {
  appName: 'Harlem Might',
  baseURL: siteURL,
  basePath: `${PAYLOAD_API_ROUTE}${AUTH_BASE_PATH}`,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: AUTH_ORIGINS,
  advanced: {
    database: { generateId: 'serial' },
  },
  user: {
    // Keep consumer identity in the existing Payload `members` collection.
    // Payload `users` remains curator/admin-only.
    modelName: 'member',
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },
} satisfies BetterAuthOptions;
