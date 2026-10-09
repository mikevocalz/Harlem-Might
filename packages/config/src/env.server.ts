// Server-only environment, parsed once with Zod. Nothing outside this module
// reads process.env directly for these keys. Optional keys disable the feature
// that needs them; they never leave it half-configured.
//
// Keep names in step with the root .env.example.

import { z } from 'zod';

const optional = z.string().min(1).optional();
const optionalUrl = z.url().optional();

const schema = z.object({
  APP_ENV: z.enum(['development', 'preview', 'production']).default('development'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // ---- Site ----
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
  WEB_VITE_URL: z.url().default('http://localhost:5173'),

  // ---- Database (Payload, Better Auth, events) ----
  DATABASE_URL: z.url(),
  DATABASE_DIRECT_URL: optionalUrl,

  // ---- Payload ----
  PAYLOAD_SECRET: z.string().min(32),
  PAYLOAD_PUSH: z.stringbool().default(false),
  PAYLOAD_MCP_ENABLED: z.stringbool().default(false),

  // ---- Better Auth ----
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),

  // ---- Supabase (2026 key format). Optional until the project exists. ----
  SUPABASE_URL: optionalUrl,
  SUPABASE_PUBLISHABLE_KEY: z.string().startsWith('sb_publishable_').optional(),
  SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_').optional(),
  SUPABASE_PROJECT_REF: optional,

  // ---- Event providers ----
  TICKETMASTER_API_KEY: optional,
  SEATGEEK_CLIENT_ID: optional,
  SEATGEEK_CLIENT_SECRET: optional,
  PREDICTHQ_API_TOKEN: optional,
  NYC_OPEN_DATA_APP_TOKEN: optional,
  EVENTS_SCRAPER_USER_AGENT: z.string().min(1).default('HarlemMightBot/1.0 (+https://harlemmight.com/bot)'),

  // ---- Geo ----
  GEOSEARCH_BASE_URL: z.url().default('https://geosearch.planninglabs.nyc/v2'),
  HARLEM_NTA_SOURCE_URL: z
    .url()
    .default('https://data.cityofnewyork.us/api/v3/views/9nt8-h7nd/query.geojson'),
  MAP_SERVER_TOKEN: optional,

  // ---- Jobs ----
  CRON_SECRET: z.string().min(32).optional(),
  EVENTS_INGEST_ENABLED: z.stringbool().default(false),
  EVENTS_PROVIDERS_ENABLED: optional,
  EVENTS_RUN_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),

  // ---- Mail (auth verification + alerts) ----
  RESEND_API_KEY: optional,
  EMAIL_FROM: z.email().optional(),
  ALERT_EMAIL_TO: z.email().optional(),

  // ---- Observability ----
  SENTRY_DSN: optionalUrl,
  SENTRY_ENVIRONMENT: optional,
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type ServerEnv = z.infer<typeof schema>;

/** `KEY=` in a .env file arrives as "", which must mean unset, not invalid. */
function withoutBlanks(source: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
}

function parse(): ServerEnv {
  const result = schema.safeParse(withoutBlanks(process.env));
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid server environment:\n${problems}`);
  }
  return result.data;
}

export const env = parse();

/** Adapters whose credentials are present. Pipelines read this, never process.env. */
export const providerAvailability = {
  ticketmaster: Boolean(env.TICKETMASTER_API_KEY),
  seatgeek: Boolean(env.SEATGEEK_CLIENT_ID),
  predicthq: Boolean(env.PREDICTHQ_API_TOKEN),
  nycPermittedEvents: true,
  nycParks: true,
  nypl: true,
} as const;

export const supabaseConfigured = Boolean(
  env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY && env.SUPABASE_SECRET_KEY,
);
