import type { CollectionConfig, TextFieldSingleValidation } from 'payload';
import { isHttpUrl, validateOptionalUrl } from '../fields/provenance';

const requireEntranceSource: TextFieldSingleValidation = (value, { siblingData }) => {
  const entrance = siblingData as { note?: string | null; location?: unknown } | undefined;
  if ((entrance?.note || entrance?.location) && !value) {
    return 'An entrance claim needs a source URL.';
  }
  return !value || isHttpUrl(value) ? true : 'Enter a full http(s) URL.';
};

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
      name: 'legacySlugs',
      type: 'array',
      admin: {
        description: 'Old generated public paths. These stay resolvable and redirect to the current name-led slug.',
      },
      fields: [{ name: 'slug', type: 'text', required: true, index: true }],
    },
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
    {
      name: 'images',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      admin: { description: 'Editorial images. Each image must include a verified source, license, credit and attribution before it can render.' },
    },
    { name: 'summary', type: 'textarea' },
    { name: 'location', type: 'point' },
    // Audit §7: be honest about how good the pin is. `pending` keeps the
    // shipped "Location pending verification" behaviour.
    {
      name: 'locationAccuracy',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Verified (survey or entrance check)', value: 'verified' },
        { label: 'Approximate (geocoded)', value: 'approx' },
        { label: 'Pending', value: 'pending' },
      ],
    },
    {
      name: 'locationSource',
      type: 'group',
      fields: [
        { name: 'url', type: 'text', validate: validateOptionalUrl, admin: { description: 'OSM node/way URL, survey note, or other source for the point.' } },
        { name: 'verifiedAt', type: 'date' },
      ],
    },
    // Audit §7: no "real entrance" copy ships until this group is filled with
    // a source. Apollo alone has two entrances (253 and 233 W 125th).
    {
      name: 'entrance',
      type: 'group',
      fields: [
        { name: 'note', type: 'text', admin: { description: 'e.g. "Box office door, 253 W 125th St".' } },
        { name: 'location', type: 'point' },
        { name: 'sourceUrl', type: 'text', validate: requireEntranceSource },
        { name: 'verifiedAt', type: 'date' },
      ],
    },
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
      name: 'openingHours',
      type: 'group',
      admin: {
        description:
          'Hours as published by the source. `osm` holds the raw OpenStreetMap opening_hours value; never transcribe it by hand.',
      },
      fields: [
        { name: 'osm', type: 'text', admin: { description: 'Raw opening_hours tag, e.g. "Mo-Fr 11:00-23:00; Sa 12:00-24:00".' } },
        { name: 'note', type: 'text', admin: { description: 'Human-readable hours when a source gives prose instead of a parseable value.' } },
        { name: 'sourceUrl', type: 'text', validate: validateOptionalUrl },
        { name: 'verifiedAt', type: 'date' },
      ],
    },
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
            description: 'Rights-cleared or venue-supplied menu images uploaded to Harlem Might.',
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
