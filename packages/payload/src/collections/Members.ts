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
    tokenExpiration: 60 * 60 * 24 * 30,
  },
  admin: {
    useAsTitle: 'email',
  },
  access: {
    admin: () => false,
    create: () => true,
    read: ({ req: { user } }) =>
      isMember(user) ? { id: { equals: user.id } } : false,
    update: ({ req: { user } }) =>
      isMember(user) ? { id: { equals: user.id } } : false,
    delete: ({ req: { user } }) =>
      isMember(user) ? { id: { equals: user.id } } : false,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 80,
    },
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
