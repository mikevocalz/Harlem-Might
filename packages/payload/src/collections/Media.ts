import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CollectionConfig } from 'payload';
import { validateOptionalUrl } from '../fields/provenance';

// staticDir must be absolute: Payload's default resolves against process.cwd(),
// which is apps/web when Next serves the API — not this package's media dir.
const staticDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../media');

export const Media: CollectionConfig = {
  slug: 'media',
  access: { read: () => true },
  upload: {
    staticDir,
    adminThumbnail: ({ doc }) => (typeof doc.url === 'string' ? doc.url : ''),
    bulkUpload: true,
  },
  fields: [
    { name: 'alt', type: 'text', required: true },
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Hero', value: 'hero' },
        { label: 'Gallery', value: 'gallery' },
        { label: 'Historical', value: 'historical' },
        { label: 'Thumbnail', value: 'thumbnail' },
        { label: 'Map pin', value: 'map_pin' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      options: [
        { label: 'Commissioned', value: 'commissioned' },
        { label: 'NYPL Digital Collections', value: 'nypl' },
        { label: 'Library of Congress', value: 'loc' },
        { label: 'Wikimedia Commons', value: 'wikimedia_commons' },
        { label: 'Google Places', value: 'google_places' },
        { label: 'Unsplash', value: 'unsplash' },
        { label: 'Pexels', value: 'pexels' },
        { label: 'Venue supplied', value: 'venue_supplied' },
        { label: 'Other', value: 'other' },
      ],
    },
    { name: 'sourceUrl', type: 'text', validate: validateOptionalUrl },
    { name: 'license', type: 'text' },
    { name: 'licenseUrl', type: 'text', validate: validateOptionalUrl },
    { name: 'creator', type: 'text' },
    { name: 'credit', type: 'text' },
    { name: 'attributionText', type: 'text' },
    { name: 'capturedAt', type: 'text', admin: { description: 'Capture date or era as stated by the source.' } },
    { name: 'ingestedAt', type: 'date' },
    { name: 'placeholderHash', type: 'text' },
    { name: 'dominantColor', type: 'text' },
    { name: 'shareAlike', type: 'checkbox', defaultValue: false },
    { name: 'noDerivatives', type: 'checkbox', defaultValue: false },
  ],
};
