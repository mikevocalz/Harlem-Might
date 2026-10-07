import type { Field, TextFieldSingleValidation } from 'payload';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

/** Optional URL field: empty is fine, anything present must be http(s). */
export const validateOptionalUrl: TextFieldSingleValidation = (value) =>
  !value || isHttpUrl(value) ? true : 'Enter a full http(s) URL.';

/** Required URL field. */
export const validateRequiredUrl: TextFieldSingleValidation = (value) =>
  value && isHttpUrl(value) ? true : 'A full http(s) source URL is required.';

/**
 * Hand-rolled slug, matching Places/Pages. `payload@4.0.0-canary.37` does not
 * export a `slugField()` helper (node_modules/payload/dist/index.d.ts has no
 * such export), so the convention stays a unique, indexed text field.
 */
export const slugField = (): Field => ({
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  index: true,
  admin: { position: 'sidebar', description: 'Lowercase words joined by hyphens. Used in the URL.' },
  validate: (value: null | string | undefined) =>
    value && SLUG_PATTERN.test(value) ? true : 'Use lowercase letters, numbers and single hyphens.',
});

/**
 * Record-level citations. Every factual claim in a walk, story or event should
 * be traceable to one of these.
 */
export const sourcesField = (): Field => ({
  name: 'sources',
  type: 'array',
  // A published walk or story with no sources is an untraceable claim.
  minRows: 1,
  admin: {
    description: 'Where the facts on this record come from. Name the source and link it.',
  },
  fields: [
    { name: 'label', type: 'text', required: true },
    { name: 'url', type: 'text', validate: validateOptionalUrl },
    {
      name: 'accessedAt',
      type: 'date',
      admin: { description: 'When the source was last read.' },
    },
  ],
});
