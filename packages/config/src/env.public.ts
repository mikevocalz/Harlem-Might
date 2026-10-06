// Browser-safe environment for apps/web. Each NEXT_PUBLIC_ key is read by its
// literal name: Next only inlines `process.env.NEXT_PUBLIC_X` written out in
// full, never a dynamic lookup.

import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().startsWith('pk.').optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith('sb_publishable_').optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
});

const blankToUndefined = (value: string | undefined) => (value === '' ? undefined : value);

export const publicEnv = schema.parse({
  NEXT_PUBLIC_SITE_URL: blankToUndefined(process.env.NEXT_PUBLIC_SITE_URL),
  NEXT_PUBLIC_MAPBOX_TOKEN: blankToUndefined(process.env.NEXT_PUBLIC_MAPBOX_TOKEN),
  NEXT_PUBLIC_SUPABASE_URL: blankToUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: blankToUndefined(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  NEXT_PUBLIC_SENTRY_DSN: blankToUndefined(process.env.NEXT_PUBLIC_SENTRY_DSN),
});
