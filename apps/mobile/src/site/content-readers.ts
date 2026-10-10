import { fetch } from 'react-native-nitro-fetch';
import { createContentReaders, createRestContentSource } from '@acme/app/content';
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
    apiUrl: origin ? `${origin}/payload-api` : undefined,
    fetch: (url, init) => fetch(url, init),
  }),
);
