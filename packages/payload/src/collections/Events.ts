import type { CollectionConfig, DateFieldValidation, TextFieldSingleValidation } from 'payload';
import { curatorOnly, publishedOrCurator } from '../access/editorial';
import { slugField, validateOptionalUrl, validateRequiredUrl } from '../fields/provenance';

export const HARLEM_TIME_ZONE = 'America/New_York';

// Every date field here stores a UTC instant plus a sibling `<name>_tz`
// select (node_modules/payload/dist/fields/config/sanitize.js appends `_tz`).
// Only Harlem's zone is offered, so "tonight" is never computed in UTC.
const harlemTimezone = {
  defaultTimezone: HARLEM_TIME_ZONE,
  supportedTimezones: [{ label: 'New York (Harlem)', value: HARLEM_TIME_ZONE }],
  required: true,
};

const endsAfterStart: DateFieldValidation = (value, { siblingData }) => {
  if (!value) return 'An end time is required. Events without one never appear on Today.';
  const startsAt = (siblingData as { startsAt?: Date | string | null } | undefined)?.startsAt;
  if (startsAt && new Date(value).getTime() <= new Date(startsAt).getTime()) {
    return 'The end time must be after the start time.';
  }
  return true;
};

// A venue is either a catalogue place or a named venue we have not catalogued.
const venueNameWhenNoPlace: TextFieldSingleValidation = (value, { siblingData }) => {
  const place = (siblingData as { place?: unknown } | undefined)?.place;
  return place || value ? true : 'Pick a catalogue place or name the venue.';
};

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'startsAt', 'status', 'place', 'lastVerifiedAt', '_status'],
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
      type: 'row',
      fields: [
        {
          name: 'startsAt',
          type: 'date',
          required: true,
          index: true,
          timezone: harlemTimezone,
          admin: { date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'endsAt',
          type: 'date',
          required: true,
          index: true,
          timezone: harlemTimezone,
          validate: endsAfterStart,
          admin: { date: { pickerAppearance: 'dayAndTime' } },
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'scheduled',
      index: true,
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Postponed', value: 'postponed' },
      ],
    },
    { name: 'place', type: 'relationship', relationTo: 'places', index: true },
    { name: 'venueName', type: 'text', validate: venueNameWhenNoPlace },
    { name: 'venueUrl', type: 'text', validate: validateOptionalUrl },
    {
      name: 'sourceUrl',
      type: 'text',
      required: true,
      validate: validateRequiredUrl,
      admin: { description: 'The listing this event was copied from (usually the venue page).' },
    },
    {
      name: 'fetchedAt',
      type: 'date',
      required: true,
      admin: { position: 'sidebar', description: 'When the listing was first read.', date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'lastVerifiedAt',
      type: 'date',
      required: true,
      admin: { position: 'sidebar', description: 'When someone last checked the listing still says this.', date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'ticketUrl', type: 'text', validate: validateOptionalUrl },
  ],
};
