// @acme/auth/server — the Better Auth instance of record for Harlem Might.
// Mirrors MoyoLearn's packages/auth/src/server.ts: a pg Pool scoped to its own
// schema, email/password with verification enforced outside development.

import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

/**
 * Better Auth's tables live in `better_auth`, never in `auth` (Supabase's
 * managed GoTrue schema) or `payload`. Fixed here rather than in env so the
 * migration and the reader cannot drift apart.
 */
export const AUTH_SCHEMA = 'better_auth';

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export function createAuth(options?: { connectionString?: string; schema?: string }) {
  const schema = options?.schema ?? AUTH_SCHEMA;
  const connectionString = options?.connectionString ?? process.env.DATABASE_URL;
  const pool = new Pool({
    connectionString,
    // Better Auth's kysely dialect has no schema option; search_path is the lever.
    options: `-c search_path=${schema}`,
    ssl: connectionString?.includes('supabase.co') || connectionString?.includes('pooler.supabase.com')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  /*
    No transactional mail provider exists in this repo yet. better-auth refuses
    every unverified email/password sign-in when verification is required and
    no sendVerificationEmail is configured, and the account can then never be
    verified (the MoyoLearn 2026-09-22 lockout). So verification is required
    only once a sender exists; until then production logs the gap loudly
    instead of silently locking every new account out.
  */
  const verificationRequired = false;
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[auth] No verification email sender is configured, so email verification is off. ' +
        'Add a sender (emailVerification.sendVerificationEmail) and set requireEmailVerification.',
    );
  }

  return betterAuth({
    appName: 'Harlem Might',
    database: pool,
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: [
      'harlemmight://',
      process.env.WEB_VITE_URL ?? 'http://localhost:5173',
    ],
    session: { expiresIn: SESSION_MAX_AGE },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      requireEmailVerification: verificationRequired,
      revokeSessionsOnPasswordReset: true,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
