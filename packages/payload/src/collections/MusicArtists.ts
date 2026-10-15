import type { CollectionConfig } from 'payload';
import { curatorOnly, publishedOrCurator } from '../access/editorial.ts';
import { slugField, validateOptionalUrl } from '../fields/provenance.ts';

/** A curated, sourced Harlem music catalog; no inferred YouTube IDs or unlicensed portraits. */
export const MusicArtists: CollectionConfig = {
  slug: 'music-artists',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'genre', 'connection', '_status', 'updatedAt'] },
  access: { read: publishedOrCurator, create: curatorOnly, update: curatorOnly, delete: curatorOnly },
  versions: { drafts: true },
  fields: [
    { name: 'name', type: 'text', required: true, index: true },
    slugField(),
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
    { name: 'albumArt', type: 'upload', relationTo: 'media', admin: { description: 'Licensed artwork for the vinyl center label.' } },
    { name: 'featuredAlbumTitle', type: 'text' },
    { name: 'xrSceneEnabled', type: 'checkbox', defaultValue: false },
    { name: 'vinylRpm', type: 'select', defaultValue: '33', options: [{ label: '33⅓ RPM', value: '33' }, { label: '45 RPM', value: '45' }] },
    { name: 'spatialTrack', type: 'group', fields: [
      { name: 'url', type: 'text', validate: validateOptionalUrl },
      { name: 'licenseSourceUrl', type: 'text', validate: validateOptionalUrl },
      { name: 'format', type: 'select', defaultValue: 'stereo', options: ['mono', 'stereo', 'ambisonic'].map((value) => ({ label: value, value })) },
    ] },
    { name: 'featuredSong', type: 'group', fields: [
      { name: 'title', type: 'text' },
      { name: 'youtubeUrl', type: 'text', validate: (value: unknown) => {
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
