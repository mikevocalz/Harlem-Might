import { placeCatalogueStore } from '@acme/app/features/explore/place-catalogue.store.ts';
import { contentFetch, createContentReaders, createRestContentSource } from '@acme/app/content';
import { siteOrigin } from './site-url';

/**
 * The app's content readers: the same contract the site binds to Payload's
 * Local API, here over the site's REST mount through nitro-fetch (URLSession
 * on iOS, Cronet on Android). Without `EXPO_PUBLIC_APP_URL` every reader
 * answers `unavailable: not-configured`, and screens show "couldn't check".
 */
const origin = siteOrigin();

export const contentReaders = createContentReaders(
  createRestContentSource({
    apiUrl: process.env.EXPO_PUBLIC_PAYLOAD_API_BASE?.trim() || (origin ? `${origin}/payload-api` : undefined),
    fetch: async (url, init) => {
      try {
        const response = await contentFetch(url, init);
        if (!response.ok) console.warn('[content] HTTP request failed', response.status);
        return response;
      } catch (error) {
        const code = error instanceof Error ? error.message.match(/\bERR_[A-Z_]+\b/)?.[0] ?? error.name : 'UnknownError';
        console.warn('[content] Native request failed', code);
        throw error;
      }
    },
  }),
);

placeCatalogueStore.getState().connect(contentReaders);
