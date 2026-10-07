import type { Access } from 'payload';

// Curators sign in to the Payload admin through the `users` collection.
// `members` (Better Auth consumers) also authenticate against Payload, so
// "any logged-in user" is not a safe write rule for editorial content.
const isCurator = (user: unknown): boolean =>
  Boolean(
    user &&
      typeof user === 'object' &&
      'collection' in user &&
      (user as { collection?: string }).collection === 'users',
  );

/** Curators see drafts; everyone else sees published documents only. */
export const publishedOrCurator: Access = ({ req: { user } }) =>
  isCurator(user) ? true : { _status: { equals: 'published' } };

export const curatorOnly: Access = ({ req: { user } }) => isCurator(user);
