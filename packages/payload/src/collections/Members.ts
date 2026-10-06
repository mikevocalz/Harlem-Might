import { betterAuthStrategy } from '@delmaredigital/payload-better-auth';
import type { CollectionConfig } from 'payload';

const isMember = (user: unknown): user is { id: number | string; collection: 'members' } =>
  Boolean(
    user &&
      typeof user === 'object' &&
      'id' in user &&
      'collection' in user &&
      (user as { collection?: string }).collection === 'members',
  );

export const Members: CollectionConfig = {
  slug: 'members',
  auth: {
    disableLocalStrategy: true,
    strategies: [betterAuthStrategy()],
  },
  admin: {
    useAsTitle: 'email',
  },
  access: {
    admin: () => false,
    // Better Auth writes through the Payload adapter with overrideAccess.
    // Direct anonymous creation through /members is intentionally closed.
    create: () => false,
    read: ({ req: { user } }) =>
      isMember(user) ? { id: { equals: user.id } } : false,
    update: ({ req: { user } }) =>
      isMember(user) ? { id: { equals: user.id } } : false,
    delete: ({ req: { user } }) =>
      isMember(user) ? { id: { equals: user.id } } : false,
  },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true },
    { name: 'emailVerified', type: 'checkbox', defaultValue: false },
    { name: 'name', type: 'text', required: true, maxLength: 80 },
    { name: 'image', type: 'text' },
    {
      name: 'avatar',
      type: 'relationship',
      relationTo: 'media',
    },
    {
      name: 'preferences',
      type: 'group',
      fields: [
        {
          name: 'reducedMotion',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'stepFreeDefault',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
    },
  ],
};
