import type { ContentResult } from '@acme/app/content';

/** Absence is definitive only after the catalogue has answered successfully. */
export function artistPhotoCatalogueStatus(
  catalogue: ContentResult<readonly { name: string }[]>,
  name: string,
): 404 | 503 | null {
  if (catalogue.status !== 'ok') return 503;
  return catalogue.data.some((artist) => artist.name === name) ? null : 404;
}
