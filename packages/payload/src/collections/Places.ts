import type { CollectionConfig } from 'payload';

export const Places: CollectionConfig = {
  slug: 'places',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'lifecycle', 'primaryCategory', 'updatedAt'],
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'name', type: 'text', required: true, index: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'business',
      options: [
        { label: 'Business', value: 'business' },
        { label: 'Culture', value: 'culture' },
        { label: 'Historic site', value: 'historic' },
        { label: 'Park / outdoors', value: 'outdoors' },
        { label: 'Public art', value: 'public-art' },
        { label: 'Community', value: 'community' },
      ],
    },
    {
      name: 'lifecycle',
      type: 'select',
      required: true,
      defaultValue: 'open',
      index: true,
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Temporarily closed', value: 'temporarily_closed' },
        { label: 'Seasonal', value: 'seasonal' },
        { label: 'Permanently closed', value: 'permanently_closed' },
        { label: 'Historical only', value: 'historical_only' },
        { label: 'Unknown', value: 'unknown' },
      ],
    },
    { name: 'primaryCategory', type: 'text', index: true },
    { name: 'primaryArea', type: 'text', index: true },
    {
      name: 'logo',
      type: 'relationship',
      relationTo: 'media',
    },
    { name: 'summary', type: 'textarea' },
    { name: 'location', type: 'point' },
    {
      name: 'address',
      type: 'group',
      fields: [
        { name: 'formatted', type: 'text' },
        { name: 'neighborhood', type: 'text' },
        { name: 'postalCode', type: 'text' },
      ],
    },
    { name: 'website', type: 'text' },
    { name: 'phone', type: 'text' },
    {
      name: 'dataQuality',
      type: 'group',
      fields: [
        {
          name: 'state',
          type: 'select',
          defaultValue: 'unverified',
          options: [
            { label: 'Unverified', value: 'unverified' },
            { label: 'Partially verified', value: 'partially_verified' },
            { label: 'Verified', value: 'verified' },
            { label: 'Needs review', value: 'needs_review' },
          ],
        },
        { name: 'lastReviewedAt', type: 'date' },
      ],
    },
    { name: 'featured', type: 'checkbox', defaultValue: false, index: true },
  ],
};
