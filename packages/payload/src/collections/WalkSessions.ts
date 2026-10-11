import type { CollectionConfig } from 'payload';

/** All reads/writes go through verified-owner command endpoints, never generic CRUD. */
export const WalkSessions: CollectionConfig = {
  slug: 'walk-sessions',
  dbName: 'walk_sessions',
  admin: { hidden: true },
  endpoints: false,
  graphQL: false,
  authorship: false,
  lockDocuments: false,
  timestamps: false,
  versions: false,
  trash: false,
  access: {
    admin: () => false, create: () => false, read: () => false,
    update: () => false, delete: () => false,
  },
  fields: [
    { name: 'ownerKey', type: 'text', required: true, unique: true },
    // Payload uses ON DELETE SET NULL. Keep the FK nullable so account deletion
    // is never blocked; the service requires a verified owner on every operation.
    { name: 'member', type: 'relationship', relationTo: 'members', index: true },
    { name: 'snapshot', type: 'json', required: true },
    { name: 'generation', type: 'number', required: true, min: 0 },
    { name: 'receipts', type: 'json', required: true },
  ],
};
