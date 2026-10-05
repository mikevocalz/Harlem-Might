import type { CollectionConfig } from 'payload';

export const Media: CollectionConfig = {
  slug: 'media',
  access: { read: () => true },
  upload: {
    adminThumbnail: ({ doc }) => (typeof doc.url === 'string' ? doc.url : ''),
    bulkUpload: true,
  },
  fields: [
    { name: 'alt', type: 'text', required: true },
  ],
};
