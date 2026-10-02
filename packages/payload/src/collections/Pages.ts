import type { CollectionConfig } from 'payload';

// Public content for the site (apps/web-vite reads it over REST at
// /payload-api). Anonymous read is intentional — this is published material,
// not user data.
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'title' },
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'summary', type: 'textarea' },
    { name: 'body', type: 'textarea' },
    { name: 'published', type: 'checkbox', defaultValue: false },
  ],
};
