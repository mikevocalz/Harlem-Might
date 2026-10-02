/**
 * The site's read-only door into the Payload database. The CMS itself lives
 * inside apps/web and serves REST at /payload-api; `createPayloadClient`
 * (packages/payload/index.ts) is the only sanctioned client — it never mounts
 * Payload, never imports the config, and only fetches anon-readable content.
 *
 * `import.meta.env.VITE_*` is inlined at build time, so the base URL is a
 * per-environment fact, not a runtime lookup.
 *
 * SOT: packages/payload/src/payload.config.ts (routes.api) · .env.development.local
 * SOT-KEYWORDS: web-vite payload client rest base url pages collection
 */
import { createPayloadClient } from '@acme/payload';

export const PAYLOAD_API_BASE =
  import.meta.env.VITE_PAYLOAD_API_BASE ?? 'http://localhost:3000/payload-api';

export const payload = createPayloadClient({ baseUrl: PAYLOAD_API_BASE });

/** Shape of the `pages` collection (packages/payload/src/collections/Pages.ts). */
export interface CmsPage {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  body?: string | null;
  published?: boolean | null;
  updatedAt: string;
  createdAt: string;
}

export type CmsStatus =
  | { ok: true }
  | { ok: false; reason: 'offline' | 'error'; detail: string };

/** Fetch published pages, or report why the CMS could not answer. */
export async function listPages(): Promise<{ pages: CmsPage[]; status: CmsStatus }> {
  try {
    const res = await payload.find<CmsPage>(
      'pages',
      'where[published][equals]=true&sort=-updatedAt&limit=50',
    );
    return { pages: res.docs, status: { ok: true } };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      pages: [],
      status: { ok: false, reason: 'offline', detail },
    };
  }
}

/** Fetch one published page by slug; null when missing or when the CMS is down. */
export async function getPage(slug: string): Promise<CmsPage | null> {
  try {
    const res = await payload.find<CmsPage>(
      'pages',
      `where[slug][equals]=${encodeURIComponent(slug)}&where[published][equals]=true&limit=1`,
    );
    return res.docs[0] ?? null;
  } catch {
    return null;
  }
}


export interface CmsMedia {
  id: string;
  url?: string | null;
  alt?: string | null;
}

export interface CmsPlace {
  id: string;
  name: string;
  slug: string;
  kind?: string | null;
  lifecycle?: string | null;
  primaryCategory?: string | null;
  primaryArea?: string | null;
  logo?: string | CmsMedia | null;
  dataQuality?: {
    state?: string | null;
    lastReviewedAt?: string | null;
  } | null;
  updatedAt: string;
  createdAt: string;
}

export async function listPlaces(): Promise<{ places: CmsPlace[]; status: CmsStatus }> {
  try {
    const res = await payload.find<CmsPlace>('places', 'sort=name&limit=200&depth=1');
    return { places: res.docs, status: { ok: true } };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      places: [],
      status: { ok: false, reason: 'offline', detail },
    };
  }
}
