import type { CollectionConfig } from 'payload';
import { curatorOnly, publishedOrCurator } from '../access/editorial';
import { validateOptionalUrl } from '../fields/provenance';

/** A curated, sourced Harlem music catalog; no inferred YouTube IDs or unlicensed portraits. */
export const MusicArtists: CollectionConfig = {
  slug: 'music-artists',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'genre', 'connection', '_status', 'updatedAt'] },
  access: { read: publishedOrCurator, create: curatorOnly, update: curatorOnly, delete: curatorOnly },
  versions: { drafts: true },
  fields: [
    { name: 'name', type: 'text', required: true, index: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'genre', type: 'text', required: true, index: true },
    { name: 'era', type: 'text' },
    { name: 'connection', type: 'select', required: true, options: [
      { label: 'Born or raised in Harlem', value: 'born-raised' },
      { label: 'Harlem resident', value: 'resident' },
      { label: 'Harlem music-scene figure', value: 'scene' },
      { label: 'East Harlem / El Barrio', value: 'east-harlem' },
    ] },
    { name: 'shortBio', type: 'textarea', required: true },
    { name: 'biography', type: 'textarea', required: true },
    { name: 'headshot', type: 'upload', relationTo: 'media', admin: { description: 'Only upload imagery with documented rights and credit.' } },
    { name: 'featuredSong', type: 'group', fields: [
      { name: 'title', type: 'text' },
      { name: 'youtubeUrl', type: 'text', validate: (value) => {
        if (!value) return true;
        if (typeof value !== 'string' || !/^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}(?:[&#?].*)?$/.test(value)) return 'Use a verified public YouTube watch/share URL';
        return true;
      } },
      { name: 'verifiedAt', type: 'date' },
    ] },
    { name: 'sources', type: 'array', fields: [
      { name: 'url', type: 'text', required: true, validate: validateOptionalUrl },
      { name: 'description', type: 'text' },
    ] },
    { name: 'editorialNote', type: 'textarea', admin: { description: 'Document disputed origin claims, video embed restrictions, and pending copyright clearance.' } },
  ],
};
