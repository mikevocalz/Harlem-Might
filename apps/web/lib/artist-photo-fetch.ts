import 'server-only';
import { cacheLife } from 'next/cache';
import { fetchPublicPhotoResource } from '@acme/payload/artist-photo-fetch';

/** Cache only already-bounded metadata; no unsafe fetch precedes validation. */
async function photoMetadata(url: string, headers?: Record<string, string>) {
  'use cache';
  cacheLife({ stale: 86400, revalidate: 604800, expire: 1209600 });
  const response = await fetchPublicPhotoResource(url, { headers });
  return { url: response.url, body: await response.text() };
}

/** Keep resolver response methods outside the serializable Next cache entry. */
export async function cachedArtistPhotoFetch(url: string, init?: { headers?: Record<string, string> }) {
  const metadata = await photoMetadata(url, init?.headers);
  return {
    ok: true,
    url: metadata.url,
    async text() { return metadata.body; },
    async json(): Promise<unknown> { return JSON.parse(metadata.body) as unknown; },
  };
}
