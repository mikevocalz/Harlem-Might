import type { Endpoint, PayloadRequest } from 'payload';
import type { PostgresAdapter } from '@payloadcms/db-postgres';
import { AUTH_ORIGINS } from '../auth/options.ts';
import { verifyWalkMember } from './auth.ts';
import type { WalkAuth } from './auth.ts';
import { createWalkSessionRepository } from './repository.ts';
import type { WalkSessionDependencies } from './service.ts';
import { handleReadWalkSession, handleWalkCommand, unsupportedWatchSession } from './http.ts';

function dependencies(req: PayloadRequest): WalkSessionDependencies {
  const database: Pick<PostgresAdapter, 'pool'> = req.payload.db;
  const auth = (req.payload as unknown as { betterAuth?: WalkAuth }).betterAuth;
  return {
    authenticate: () => verifyWalkMember(auth, req.headers),
    repository: createWalkSessionRepository(database.pool),
    now: () => new Date().toISOString(),
    async loadPublishedWalk(walkId) {
      const { docs } = await req.payload.find({
        collection: 'walks', draft: false, depth: 0, limit: 1, overrideAccess: false, req,
        where: { and: [{ id: { equals: walkId } }, { _status: { equals: 'published' } }] },
      });
      const walk = docs[0];
      if (!walk || walk._status !== 'published') return null;
      return {
        id: String(walk.id), slug: walk.slug, title: walk.title, published: true,
        stopIds: walk.stops.map(stop => String(typeof stop.place === 'object' ? stop.place.id : stop.place)),
        sourceUrl: walk.sources?.find(source => source.url)?.url ?? '',
      };
    },
  };
}

// Global endpoints are deliberate: the private collection has no generated REST/GraphQL API.
export const walkSessionEndpoints: Endpoint[] = [
  {
    path: '/walk-sessions/command', method: 'post',
    handler: req => handleWalkCommand(req, dependencies(req), AUTH_ORIGINS),
  },
  {
    path: '/walk-sessions/:sessionId', method: 'get',
    handler: req => handleReadWalkSession(dependencies(req), req.routeParams?.sessionId),
  },
  { path: '/watch-walk-sessions', method: 'get', handler: unsupportedWatchSession },
  { path: '/watch-walk-sessions', method: 'post', handler: unsupportedWatchSession },
];
