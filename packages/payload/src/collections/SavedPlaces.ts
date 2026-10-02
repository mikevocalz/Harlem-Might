import type { CollectionConfig } from 'payload';

const memberIdentity = (user: unknown) => {
  if (
    user &&
    typeof user === 'object' &&
    'id' in user &&
    'collection' in user &&
    (user as { collection?: string }).collection === 'members'
  ) {
    return (user as { id: number | string }).id;
  }

  return null;
};

export const SavedPlaces: CollectionConfig = {
  slug: 'saved-places',
  admin: {
    defaultColumns: ['member', 'place', 'createdAt'],
  },
  access: {
    create: ({ req: { user } }) => memberIdentity(user) !== null,
    read: ({ req: { user } }) => {
      const member = memberIdentity(user);
      return member === null ? false : { member: { equals: member } };
    },
    update: ({ req: { user } }) => {
      const member = memberIdentity(user);
      return member === null ? false : { member: { equals: member } };
    },
    delete: ({ req: { user } }) => {
      const member = memberIdentity(user);
      return member === null ? false : { member: { equals: member } };
    },
  },
  hooks: {
    beforeChange: [
      ({ req, data }) => {
        const member = memberIdentity(req.user);
        return member === null ? data : { ...data, member };
      },
    ],
  },
  fields: [
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'members',
      required: true,
      index: true,
    },
    {
      name: 'place',
      type: 'relationship',
      relationTo: 'places',
      required: true,
      index: true,
    },
  ],
};
