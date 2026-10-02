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
      name: 'menus',
      type: 'array',
      admin: {
        description:
          'Restaurant/bar menus. Keep image galleries, PDFs, and official menu webpages as separate menu records.',
      },
      fields: [
        { name: 'label', type: 'text', required: true },
        {
          name: 'format',
          type: 'select',
          required: true,
          options: [
            { label: 'Image gallery', value: 'image_gallery' },
            { label: 'PDF', value: 'pdf' },
            { label: 'Official webpage', value: 'web' },
          ],
        },
        {
          name: 'mealPeriod',
          type: 'select',
          options: [
            { label: 'All day', value: 'all_day' },
            { label: 'Breakfast', value: 'breakfast' },
            { label: 'Brunch', value: 'brunch' },
            { label: 'Lunch', value: 'lunch' },
            { label: 'Dinner', value: 'dinner' },
            { label: 'Drinks', value: 'drinks' },
            { label: 'Dessert', value: 'dessert' },
            { label: 'Happy hour', value: 'happy_hour' },
            { label: 'Seasonal', value: 'seasonal' },
          ],
        },
        { name: 'language', type: 'text', defaultValue: 'en' },
        {
          name: 'images',
          type: 'relationship',
          relationTo: 'media',
          hasMany: true,
          admin: {
            description: 'Rights-cleared or venue-supplied menu images uploaded to Harlem Mights.',
          },
        },
        {
          name: 'remoteImages',
          type: 'array',
          admin: {
            description:
              'Official remote menu images when we should not re-host the source file.',
          },
          fields: [
            { name: 'url', type: 'text', required: true },
            { name: 'alt', type: 'text' },
            { name: 'sourceUrl', type: 'text' },
          ],
        },
        {
          name: 'pdf',
          type: 'relationship',
          relationTo: 'media',
          admin: {
            description: 'Uploaded PDF copy when rights/persistence allow it.',
          },
        },
        {
          name: 'url',
          type: 'text',
          admin: {
            description:
              'Official remote PDF or menu webpage URL. HTTPS strongly preferred.',
          },
        },
        {
          name: 'allowedOrigins',
          type: 'array',
          admin: {
            description:
              'Extra exact HTTPS origins the secure in-app browser may follow. The initial URL origin is always added automatically. No wildcards.',
          },
          fields: [{ name: 'origin', type: 'text', required: true }],
        },
        { name: 'sourceUrl', type: 'text' },
        { name: 'lastVerifiedAt', type: 'date' },
        { name: 'effectiveFrom', type: 'date' },
        { name: 'effectiveUntil', type: 'date' },
        { name: 'active', type: 'checkbox', defaultValue: true },
      ],
    },
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
