import { postgresAdapter } from '@payloadcms/db-postgres';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBetterAuthPlugin, payloadAdapter } from '@delmaredigital/payload-better-auth';
import { betterAuth } from 'better-auth';
import { buildConfig } from 'payload';
import { bunnyStorage } from '@seshuk/payload-storage-bunny';
import { editorialMcpPlugin } from './plugins/editorial-mcp';
import { withMemberAvatarStorage } from './plugins/member-avatar-storage';
import { Users } from './collections/Users';
import { Media } from './collections/Media';
import { Pages } from './collections/Pages';
import { Places } from './collections/Places';
import { Members } from './collections/Members';
import { SavedPlaces } from './collections/SavedPlaces';
import { Walks } from './collections/Walks';
import { WalkSessions } from './collections/WalkSessions';
import { walkSessionEndpoints } from './walk-sessions/endpoints';
import { Stories } from './collections/Stories';
import { Events } from './collections/Events';
import { MusicArtists } from './collections/MusicArtists';
import { AUTH_BASE_PATH, AUTH_ORIGINS, PAYLOAD_API_ROUTE, betterAuthOptions } from './auth/options';
import { memberAuthCollections } from './auth/member-collections';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const serverURL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const webViteURL = process.env.WEB_VITE_URL || 'http://localhost:5173';
const allowedOrigins = [...new Set([serverURL, webViteURL, ...AUTH_ORIGINS])];

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
  collections: [Users, Members, Media, Pages, Places, SavedPlaces, Walks, WalkSessions, Stories, Events, MusicArtists],
  endpoints: walkSessionEndpoints,
  db: postgresAdapter({
    migrationDir: path.resolve(dirname, 'migrations'),
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
    memberAuthCollections(),
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
          withMemberAvatarStorage(bunnyStorage({
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
          })),
        ]
      : []),
    editorialMcpPlugin({ enabled: process.env.PAYLOAD_MCP_ENABLED === 'true' }),
  ],
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
});
