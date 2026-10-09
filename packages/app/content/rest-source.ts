import type { ContentDocs, ContentQuery, ContentSource } from './readers.ts';

/** The slice of WHATWG `fetch` the REST source calls. */
export type ContentFetch = (url: string, init: { headers: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/**
 * Options for {@linkcode createRestContentSource}.
 */
export interface RestContentSourceOptions {
  /**
   * Payload's REST mount, e.g. `https://harlemmight.com/payload-api`.
   * `undefined` makes every reader answer `unavailable: not-configured`.
   */
  apiUrl: string | undefined;
  /** The fetch to send requests with: global `fetch` on web, nitro-fetch on native. */
  fetch: ContentFetch;
}

/**
 * A {@linkcode ContentSource} over Payload's REST API, for clients that cannot
 * use the Local API (the app, the headset). Requests go out anonymous, so the
 * collections' public read rules apply, the same as the site's Local API reads
 * with `overrideAccess: false`. A non-2xx answer rejects, which the readers
 * turn into `unavailable: query-failed`.
 */
export function createRestContentSource({ apiUrl, fetch }: RestContentSourceOptions): ContentSource {
  const base = apiUrl?.replace(/\/+$/, '');
  return {
    isConfigured: () => Boolean(base),
    async find<TSlug extends keyof ContentDocs>(query: ContentQuery<TSlug>): Promise<ContentDocs[TSlug][]> {
      if (!base) throw new Error('No Payload API URL configured for the REST content source.');
      const url = `${base}/${query.collection}?${restQueryString(query)}`;
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`Payload REST ${query.collection} answered ${response.status}`);
      const body = (await response.json()) as { docs?: ContentDocs[TSlug][] };
      if (!Array.isArray(body.docs)) throw new Error(`Payload REST ${query.collection} returned no docs array`);
      return body.docs;
    },
  };
}

/**
 * Encodes a {@linkcode ContentQuery} in the bracket syntax Payload's REST
 * parser (qs) reads: `where[and][0][slug][equals]=x&select[name]=true`.
 */
export function restQueryString(query: ContentQuery<keyof ContentDocs>): string {
  const pairs: string[] = [];
  const add = (key: string, value: unknown): void => {
    if (value === undefined) return;
    if (value !== null && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) add(`${key}[${k}]`, v);
      return;
    }
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  };
  add('where', query.where);
  add('depth', query.depth);
  add('limit', query.limit);
  add('sort', query.sort);
  for (const field of query.select ?? []) add(`select[${field}]`, true);
  add('draft', false);
  return pairs.join('&');
}
