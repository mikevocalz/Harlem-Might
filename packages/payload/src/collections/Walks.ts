import type { CollectionConfig, TextFieldSingleValidation } from 'payload';
import { curatorOnly, publishedOrCurator } from '../access/editorial';
import { isHttpUrl, slugField, sourcesField } from '../fields/provenance';

// An accessibility note is a factual claim about a body moving through the
// route (steps, slopes, kerb cuts). It never ships without a source.
const requireSourceWithNote: TextFieldSingleValidation = (value, { siblingData }) => {
  const note = (siblingData as { note?: string | null } | undefined)?.note;
  if (note && !value) return 'An accessibility note needs a source URL.';
  return !value || isHttpUrl(value) ? true : 'Enter a full http(s) URL.';
};

export const Walks: CollectionConfig = {
  slug: 'walks',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', '_status', 'distanceMeters', 'durationMinutes', 'updatedAt'],
  },
  access: {
    read: publishedOrCurator,
    create: curatorOnly,
    update: curatorOnly,
    delete: curatorOnly,
  },
  versions: { drafts: true },
  timestamps: true,
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField(),
    {
      name: 'summary',
      type: 'textarea',
      required: true,
      admin: { description: 'The premise: why walk this route, in two or three sentences.' },
    },
    {
      name: 'stops',
      type: 'array',
      required: true,
      minRows: 2,
      admin: {
        description: 'In walking order. Each stop is a catalogue place; its facts live on the place record.',
      },
      fields: [
        {
          name: 'place',
          type: 'relationship',
          relationTo: 'places',
          required: true,
          index: true,
        },
        { name: 'note', type: 'textarea', admin: { description: 'What to look at here, on this walk.' } },
      ],
    },
    {
      name: 'images',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      admin: { description: 'Cover and route images. Each image must include a verified source, license, credit and attribution before it can render.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'distanceMeters', type: 'number', min: 0, required: true },
        {
          name: 'durationMinutes',
          type: 'number',
          min: 0,
          required: true,
          admin: { description: 'Expected time at an easy pace, stops included.' },
        },
      ],
    },
    { name: 'startDescription', type: 'text', required: true, admin: { description: 'Where to begin, e.g. a corner or station exit.' } },
    { name: 'endDescription', type: 'text', required: true },
    {
      name: 'accessibility',
      type: 'group',
      admin: { description: 'Leave empty unless you have a source. Never write "accessible" on its own.' },
      fields: [
        { name: 'note', type: 'textarea' },
        { name: 'sourceUrl', type: 'text', validate: requireSourceWithNote },
        { name: 'verifiedAt', type: 'date' },
      ],
    },
    sourcesField(),
  ],
};
