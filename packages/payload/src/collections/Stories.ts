import type { CollectionConfig } from 'payload';
import { curatorOnly, publishedOrCurator } from '../access/editorial';
import { slugField, sourcesField, validateOptionalUrl } from '../fields/provenance';

export const Stories: CollectionConfig = {
  slug: 'stories',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', '_status', 'publishedAt', 'updatedAt'],
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
    { name: 'dek', type: 'textarea', admin: { description: 'One or two sentences under the headline.' } },
    {
      // Matches Pages.body. No rich-text editor is configured in
      // payload.config.ts and @payloadcms/richtext-lexical is not installed.
      name: 'body',
      type: 'textarea',
      required: true,
    },
    {
      name: 'places',
      type: 'relationship',
      relationTo: 'places',
      hasMany: true,
      index: true,
      admin: { description: 'Every place this story is about. Each place page links back.' },
    },
    {
      name: 'images',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      admin: { description: 'Lead and inline images. Each image must include a verified source, license, credit and attribution before it can render.' },
    },
    {
      name: 'archive',
      type: 'array',
      admin: { description: 'Archival or commissioned images. Every item needs a credit and a rights basis.' },
      fields: [
        { name: 'media', type: 'upload', relationTo: 'media', required: true },
        { name: 'caption', type: 'text' },
        { name: 'credit', type: 'text', required: true },
        {
          name: 'rights',
          type: 'select',
          required: true,
          options: [
            { label: 'Owned / commissioned', value: 'owned' },
            { label: 'Licensed', value: 'licensed' },
            { label: 'Venue-supplied', value: 'venue_supplied' },
            { label: 'Open licence', value: 'open_license' },
            { label: 'Public domain', value: 'public_domain' },
          ],
        },
        { name: 'rightsHolder', type: 'text' },
        { name: 'license', type: 'text', admin: { description: 'e.g. CC BY 4.0, with version.' } },
        { name: 'sourceUrl', type: 'text', validate: validateOptionalUrl },
      ],
    },
    sourcesField(),
    {
      name: 'author',
      type: 'text',
      required: true,
      admin: { position: 'sidebar', description: 'Byline as printed.' },
    },
    {
      name: 'editorialOwner',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar', description: 'Curator accountable for corrections.' },
    },
    { name: 'publishedAt', type: 'date', admin: { position: 'sidebar' } },
  ],
};
