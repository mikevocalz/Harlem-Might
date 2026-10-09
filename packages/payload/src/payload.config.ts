import { postgresAdapter } from '@payloadcms/db-postgres';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { betterAuthCollections, createBetterAuthPlugin, payloadAdapter } from '@delmaredigital/payload-better-auth';
import { betterAuth } from 'better-auth';
import { buildConfig } from 'payload';
import type { PayloadRequest } from 'payload';
import { mcpPlugin } from '@payloadcms/plugin-mcp';
import { bunnyStorage } from '@seshuk/payload-storage-bunny';
import { Users } from './collections/Users';
import { Media } from './collections/Media';
import { Pages } from './collections/Pages';
import { Places } from './collections/Places';
import { Members } from './collections/Members';
import { SavedPlaces } from './collections/SavedPlaces';
import { Walks } from './collections/Walks';
import { Stories } from './collections/Stories';
import { Events } from './collections/Events';
import { AUTH_BASE_PATH, AUTH_ORIGINS, PAYLOAD_API_ROUTE, betterAuthOptions } from './auth/options';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const serverURL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const webViteURL = process.env.WEB_VITE_URL || 'http://localhost:5173';
const allowedOrigins = [...new Set([serverURL, webViteURL, ...AUTH_ORIGINS])];

/**
 * Per-tool MCP access, MoyoLearn's fail-closed posture. Harlem has no admin
 * subdomain — admin lives on the site host — so the guard is the caller being
 * a signed-in Payload `users` (curator) member rather than a host check. Even
 * that only matters when `PAYLOAD_MCP_ENABLED=true`; without it the endpoint
 * is never registered.
 */
const curatorMcpAccess = ({ req }: { req: PayloadRequest }): boolean =>
  req.user?.collection === 'users';

const curatorMcpTools = {
  count: { access: curatorMcpAccess },
  countVersions: { access: curatorMcpAccess },
  create: { access: curatorMcpAccess },
  delete: { access: curatorMcpAccess },
  duplicate: { access: curatorMcpAccess },
  find: { access: curatorMcpAccess },
  findDistinct: { access: curatorMcpAccess },
  findVersionByID: { access: curatorMcpAccess },
  findVersions: { access: curatorMcpAccess },
  getCollectionSchema: { access: curatorMcpAccess },
  restoreVersion: { access: curatorMcpAccess },
  update: { access: curatorMcpAccess },
};

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: dirname,
      importMapFile: path.resolve(dirname, '../../../apps/web/app/(payload)/admin/importMap.js'),
    },
  },
  routes: {
    api: PAYLOAD_API_ROUTE,
  },
  collections: [Users, Members, Media, Pages, Places, SavedPlaces, Walks, Stories, Events],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
      max: 8,
      connectionTimeoutMillis: 10_000,
      query_timeout: 30_000,
    },
    push: process.env.PAYLOAD_PUSH === 'true',
    schemaName: 'payload',
  }),
  cors: allowedOrigins,
  csrf: allowedOrigins,
  secret: process.env.PAYLOAD_SECRET || '',
  plugins: [
    betterAuthCollections({
      betterAuthOptions,
      skipCollections: ['user'],
      firstUserAdmin: false,
      acknowledgeRoleGuardDisabled: true,
    }),
    createBetterAuthPlugin({
      authBasePath: AUTH_BASE_PATH,
      // Better Auth is consumer identity only. Payload `users` remains the
      // curator/admin login and keeps the stock Payload admin surface.
      autoInjectAdminComponents: false,
      createAuth: (payload) =>
        betterAuth({
          ...betterAuthOptions,
          database: payloadAdapter({ payloadClient: payload }),
        }),
    }),
    ...(process.env.BUNNY_STORAGE_ACCESS_KEY
      ? [
          bunnyStorage({
            collections: {
              media: {
                prefix: (process.env.BUNNY_MEDIA_PREFIX ?? 'harlem/').replace(/\/$/, ''),
                disablePayloadAccessControl: true,
              },
            },
            storage: {
              apiKey: process.env.BUNNY_STORAGE_ACCESS_KEY,
              hostname: new URL(
                process.env.NEXT_PUBLIC_BUNNY_CDN_BASE_URL ?? 'https://example.b-cdn.net',
              ).host,
              zoneName: process.env.BUNNY_STORAGE_ZONE_NAME ?? '',
              region: process.env.BUNNY_STORAGE_REGION,
            },
          }),
        ]
      : []),
    mcpPlugin({
      // `users`, `members`, `saved-places` and the better-auth collections are
      // deliberately absent: identity and member-owned rows stay off the
      // machine-readable surface.
      collections: {
        media: {
          tools: {
            ...curatorMcpTools,
            getUploadInstructions: { access: curatorMcpAccess },
          },
        },
        pages: { tools: curatorMcpTools },
        places: { tools: curatorMcpTools },
        walks: { tools: curatorMcpTools },
        stories: { tools: curatorMcpTools },
        events: { tools: curatorMcpTools },
      },
      // Off unless switched on — the plugin's default access is
      // `Boolean(req.user)`, which would hand the whole tool surface to any
      // authenticated account.
      disabled: process.env.PAYLOAD_MCP_ENABLED !== 'true',
    }),
  ],
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
});
